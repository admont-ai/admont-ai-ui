import {
  Check,
  ChevronRight,
  File,
  Folder,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DocNode } from "@/types"

export const DRAG_TYPE_FOLDER = "application/x-folder-path"
export const DRAG_TYPE_DOC = "application/x-document-path"
const DRAG_THRESHOLD = 10 // minimum px before drag is considered intentional

/** Module-level flag so drop targets know the drag has exceeded the threshold. */
export let dragIntentional = false
let dragStartPos: { x: number; y: number } | null = null

function displayName(name: string) {
  return name
}

function visibleChildren(children: DocNode[] | undefined, showAll: boolean, orderOverride?: string[]): DocNode[] {
  if (!children) return []
  const filtered = children.filter((child) => {
    if (showAll) return true
    // Content mode: show everything except dot files/folders.
    return !child.name.startsWith(".")
  })
  // If there's a local order override (optimistic reorder), apply it
  if (orderOverride && orderOverride.length > 0) {
    const indexMap = new Map(orderOverride.map((name, i) => [name, i]))
    return filtered.sort((a, b) => {
      const ia = indexMap.get(a.name)
      const ib = indexMap.get(b.name)
      if (ia !== undefined && ib !== undefined) return ia - ib
      if (ia !== undefined) return -1
      if (ib !== undefined) return 1
      return 0 // preserve backend order for items not in override
    })
  }
  // No override — preserve backend order (tree already arrives sorted)
  return filtered
}

export interface FolderActions {
  onCreate: (parentPath: string, name: string) => Promise<void>
  onRename: (folderPath: string, newName: string) => Promise<void>
  onDelete: (folderPath: string) => Promise<void>
  onMove: (folderPath: string, destination: string) => Promise<void>
}

export interface DocumentActions {
  onCreate: (folderPath: string, name: string) => Promise<string>
  onDelete: (docPath: string) => Promise<void>
  onMove: (docPath: string, destination: string) => Promise<void>
}

export type FileUploadHandler = (folderPath: string, file: File) => Promise<void>

type DropZone = "above" | "inside" | "below" | null

function computeDropZone(e: React.DragEvent, isDir: boolean): DropZone {
  const rect = e.currentTarget.getBoundingClientRect()
  const y = e.clientY - rect.top
  const ratio = y / rect.height
  if (isDir) {
    if (ratio < 0.25) return "above"
    if (ratio > 0.75) return "below"
    return "inside"
  }
  return ratio < 0.5 ? "above" : "below"
}

function getParentPath(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
}

function InlineInput({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      className="flex items-center gap-1 flex-1 min-w-0"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = value.trim()
        if (trimmed && trimmed !== initial) onConfirm(trimmed)
        else onCancel()
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel()
        }}
        className="h-5 flex-1 min-w-0 rounded border bg-background px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-xs"
        disabled={!value.trim()}
      >
        <Check />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel}>
        <X />
      </Button>
    </form>
  )
}

function isDescendantOrSelf(draggedPath: string, targetPath: string) {
  return targetPath === draggedPath || targetPath.startsWith(draggedPath + "/")
}

function TreeNode({
  node,
  depth = 0,
  parentPath = "",
  allSiblingNodes,
  repoSlug,
  selectedFilePath,
  onFileSelect,
  onFileDoubleClick,
  folderActions,
  documentActions,
  onFileUpload,
  expandSignal,
  showAll,
  selectionType,
  selectedFolderPath,
  onFolderSelect,
  multiSelected,
  addingFileInFolder,
  onAddingFileInFolderChange,
  addingFolderInFolder,
  onAddingFolderInFolderChange,
  renamingFolderPath,
  onRenamingFolderPathChange,
  orderMap,
  onReorder,
}: {
  node: DocNode
  depth?: number
  parentPath?: string
  siblingNodes: DocNode[]
  allSiblingNodes: DocNode[]
  repoSlug?: string
  selectedFilePath?: string
  onFileSelect?: (path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => void
  onFileDoubleClick?: (path: string) => void
  folderActions?: FolderActions
  documentActions?: DocumentActions
  onFileUpload?: FileUploadHandler
  expandSignal: number
  showAll: boolean
  selectionType: "file" | "folder"
  selectedFolderPath: string
  onFolderSelect: (path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => void
  multiSelected?: Set<string>
  addingFileInFolder: string | null
  onAddingFileInFolderChange: (v: string | null) => void
  addingFolderInFolder: string | null
  onAddingFolderInFolderChange: (v: string | null) => void
  renamingFolderPath: string | null
  onRenamingFolderPathChange: (v: string | null) => void
  orderMap: Map<string, string[]>
  onReorder: (parentPath: string, orderedNames: string[]) => void
}) {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name
  const isDir = node.type === "directory"
  const isMultiSelected = multiSelected?.has(currentPath) ?? false
  const isSelected = !isDir && selectionType === "file" && selectedFilePath === currentPath
  const isFolderSelected = isDir && selectionType === "folder" && selectedFolderPath === currentPath
  const containsSelected = isDir && !!selectedFilePath && selectedFilePath.startsWith(currentPath + "/")
  const isRenaming = isDir && renamingFolderPath === currentPath
  const isAddingFile = isDir && addingFileInFolder === currentPath
  const isAddingFolder = isDir && addingFolderInFolder === currentPath

  const [expanded, setExpanded] = useState(containsSelected)

  useEffect(() => {
    if (expandSignal === 0) return
    setExpanded(expandSignal > 0)
  }, [expandSignal])

  // Auto-expand when the selected file is a descendant
  useEffect(() => {
    if (containsSelected) setExpanded(true)
  }, [containsSelected])

  // Auto-expand when adding items to this folder
  useEffect(() => {
    if (isAddingFile || isAddingFolder) setExpanded(true)
  }, [isAddingFile, isAddingFolder])

  const [dropZone, setDropZone] = useState<DropZone>(null)

  const handleDragStart = (e: React.DragEvent) => {
    dragIntentional = false
    dragStartPos = { x: e.clientX, y: e.clientY }
    if (isDir) {
      e.dataTransfer.setData(DRAG_TYPE_FOLDER, currentPath)
    } else {
      e.dataTransfer.setData(DRAG_TYPE_DOC, currentPath)
    }
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    dragIntentional = false
    dragStartPos = null
  }

  const handleDragOver = (e: React.DragEvent) => {
    // Native file from OS — only folders accept uploads
    if (e.dataTransfer.types.includes("Files") && onFileUpload && isDir) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "copy"
      setDropZone("inside")
      return
    }

    // Internal drag — check threshold
    if (!dragIntentional && dragStartPos && e.clientX !== 0 && e.clientY !== 0) {
      const dx = e.clientX - dragStartPos.x
      const dy = e.clientY - dragStartPos.y
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragIntentional = true
      }
    }
    if (!dragIntentional) return
    const hasFolder = e.dataTransfer.types.includes(DRAG_TYPE_FOLDER)
    const hasDoc = e.dataTransfer.types.includes(DRAG_TYPE_DOC)
    if (!hasFolder && !hasDoc) return
    if (hasFolder && !folderActions) return
    if (hasDoc && !documentActions) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    setDropZone(computeDropZone(e, isDir))
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setDropZone(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.stopPropagation()
    const zone = dropZone
    setDropZone(null)

    // Native file from OS
    if (isDir) {
      const nativeFile = e.dataTransfer.files?.[0]
      if (nativeFile && onFileUpload) {
        e.preventDefault()
        onFileUpload(currentPath, nativeFile)
        return
      }
    }

    if (!dragIntentional) return

    const folderPath = e.dataTransfer.getData(DRAG_TYPE_FOLDER)
    const docPath = e.dataTransfer.getData(DRAG_TYPE_DOC)
    const draggedPath = folderPath || docPath
    if (!draggedPath) return

    e.preventDefault()

    // Determine if this is a reorder (same parent, above/below zone)
    const draggedParent = getParentPath(draggedPath)

    if (zone === "above" || zone === "below") {
      // Reorder: dragged item and target share the same parent
      if (draggedParent === parentPath) {
        const draggedName = draggedPath.split("/").pop()!
        if (draggedName === node.name) return // dropped on self
        // Compute new order from the full (unfiltered) children list
        const allNames = allSiblingNodes.map((c) => c.name).filter((n) => n !== draggedName)
        const targetIdx = allNames.indexOf(node.name)
        if (targetIdx < 0) return
        const insertIdx = zone === "above" ? targetIdx : targetIdx + 1
        allNames.splice(insertIdx, 0, draggedName)
        onReorder(parentPath, allNames)
        return
      }
      // Different parent — treat as move to this item's parent directory
      if (folderPath && folderActions) {
        if (isDescendantOrSelf(folderPath, parentPath)) return
        folderActions.onMove(folderPath, parentPath)
      } else if (docPath && documentActions) {
        documentActions.onMove(docPath, parentPath)
      }
      return
    }

    // zone === "inside" — move into this folder (only for directories)
    if (!isDir) return
    if (folderPath && folderActions) {
      if (isDescendantOrSelf(folderPath, currentPath)) return
      if (draggedParent === currentPath) return
      folderActions.onMove(folderPath, currentPath)
    } else if (docPath && documentActions) {
      const docParent = getParentPath(docPath)
      if (docParent === currentPath) return
      documentActions.onMove(docPath, currentPath)
    }
  }

  return (
    <li>
      {isRenaming && folderActions ? (
        <div
          className="flex items-center px-1.5 py-1"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          <Folder className="size-3.5 shrink-0 mr-1.5" />
          <InlineInput
            initial={node.name}
            onConfirm={(newName) => {
              folderActions.onRename(currentPath, newName)
              onRenamingFolderPathChange(null)
              const parent = getParentPath(currentPath)
              onFolderSelect(parent ? `${parent}/${newName}` : newName)
            }}
            onCancel={() => onRenamingFolderPathChange(null)}
          />
        </div>
      ) : (
        <>
          <div
            className="group relative flex items-center"
            draggable={(isDir && !!folderActions) || (!isDir && !!documentActions)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dropZone === "above" && (
              <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-10 pointer-events-none" />
            )}
            {dropZone === "below" && (
              <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary z-10 pointer-events-none" />
            )}
            {isDir ? (
              <button
                type="button"
                data-tree-path={currentPath}
                className={cn(
                  "flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm",
                  (isFolderSelected || isMultiSelected) && "bg-neutral-600 text-white font-medium dark:bg-neutral-500",
                  dropZone === "inside" && "bg-primary/10",
                )}
                style={{ paddingLeft: `${depth * 12 + 6}px` }}
                onClick={(e) => onFolderSelect(currentPath, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey })}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 transition-transform cursor-pointer",
                    expanded && "rotate-90",
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                />
                <Folder className="size-3.5 shrink-0" />
                <span className="truncate">{node.name}</span>
              </button>
            ) : (
              <a
                href={repoSlug ? `/${encodeURIComponent(repoSlug)}/${currentPath}` : undefined}
                data-tree-path={currentPath}
                className={cn(
                  "flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm no-underline",
                  "text-muted-foreground",
                  (isSelected || isMultiSelected) && "bg-neutral-600 text-white font-medium dark:bg-neutral-500",
                )}
                style={{ paddingLeft: `${depth * 12 + 6}px` }}
                onClick={(e) => {
                  e.preventDefault()
                  onFileSelect?.(currentPath, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey })
                }}
                onDoubleClick={() => onFileDoubleClick?.(currentPath)}
              >
                <span className="size-3.5 shrink-0" />
                <File className="size-3.5 shrink-0" />
                <span className="truncate">{displayName(node.name)}</span>
              </a>
            )}
          </div>
        </>
      )}
      {isDir && expanded && (() => {
        const children = visibleChildren(node.children, showAll, orderMap.get(currentPath))
        return (
        <ul>
          {children.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              parentPath={currentPath}
              siblingNodes={children}
              allSiblingNodes={node.children ?? []}
              repoSlug={repoSlug}
              selectedFilePath={selectedFilePath}
              onFileSelect={onFileSelect}
              onFileDoubleClick={onFileDoubleClick}
              folderActions={folderActions}
              documentActions={documentActions}
              onFileUpload={onFileUpload}
              expandSignal={expandSignal}
              showAll={showAll}
              selectionType={selectionType}
              selectedFolderPath={selectedFolderPath}
              onFolderSelect={onFolderSelect}
              multiSelected={multiSelected}
              addingFileInFolder={addingFileInFolder}
              onAddingFileInFolderChange={onAddingFileInFolderChange}
              addingFolderInFolder={addingFolderInFolder}
              onAddingFolderInFolderChange={onAddingFolderInFolderChange}
              renamingFolderPath={renamingFolderPath}
              onRenamingFolderPathChange={onRenamingFolderPathChange}
              orderMap={orderMap}
              onReorder={onReorder}
            />
          ))}
          {isAddingFile && (
            <li
              className="flex items-center px-1.5 py-1"
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
            >
              <File className="size-3.5 shrink-0 mr-1.5" />
              <InlineInput
                initial=""
                onConfirm={(name) => {
                  documentActions?.onCreate(currentPath, name)
                  onAddingFileInFolderChange(null)
                }}
                onCancel={() => onAddingFileInFolderChange(null)}
              />
            </li>
          )}
          {isAddingFolder && (
            <li
              className="flex items-center px-1.5 py-1"
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
            >
              <Folder className="size-3.5 shrink-0 mr-1.5" />
              <InlineInput
                initial=""
                onConfirm={(name) => {
                  folderActions?.onCreate(currentPath, name)
                  onAddingFolderInFolderChange(null)
                }}
                onCancel={() => onAddingFolderInFolderChange(null)}
              />
            </li>
          )}
        </ul>
        )
      })()}
    </li>
  )
}

export function FileTree({
  root,
  repoSlug,
  selectedFilePath,
  onFileSelect,
  onFileDoubleClick,
  folderActions,
  documentActions,
  onFileUpload,
  expandSignal,
  showAll,
  selectionType,
  selectedFolderPath,
  onFolderSelect,
  multiSelected,
  addingFileInFolder,
  onAddingFileInFolderChange,
  addingFolderInFolder,
  onAddingFolderInFolderChange,
  renamingFolderPath,
  onRenamingFolderPathChange,
  orderMap,
  onReorder,
}: {
  root: DocNode
  repoSlug?: string
  selectedFilePath?: string
  onFileSelect?: (path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => void
  onFileDoubleClick?: (path: string) => void
  folderActions?: FolderActions
  documentActions?: DocumentActions
  onFileUpload?: FileUploadHandler
  expandSignal: number
  showAll: boolean
  selectionType: "file" | "folder"
  selectedFolderPath: string
  onFolderSelect: (path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => void
  multiSelected?: Set<string>
  addingFileInFolder: string | null
  onAddingFileInFolderChange: (v: string | null) => void
  addingFolderInFolder: string | null
  onAddingFolderInFolderChange: (v: string | null) => void
  renamingFolderPath: string | null
  onRenamingFolderPathChange: (v: string | null) => void
  orderMap: Map<string, string[]>
  onReorder: (parentPath: string, orderedNames: string[]) => void
}) {
  const [dropOver, setDropOver] = useState(false)

  const handleRootDragOver = (e: React.DragEvent) => {
    // Native file from OS
    if (e.dataTransfer.types.includes("Files") && onFileUpload) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      setDropOver(true)
      return
    }

    if (!dragIntentional && dragStartPos && e.clientX !== 0 && e.clientY !== 0) {
      const dx = e.clientX - dragStartPos.x
      const dy = e.clientY - dragStartPos.y
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragIntentional = true
      }
    }
    if (!dragIntentional) return
    const hasFolder = e.dataTransfer.types.includes(DRAG_TYPE_FOLDER)
    const hasDoc = e.dataTransfer.types.includes(DRAG_TYPE_DOC)
    if (!hasFolder && !hasDoc) return
    if (hasFolder && !folderActions) return
    if (hasDoc && !documentActions) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropOver(true)
  }

  const handleRootDragLeave = () => {
    setDropOver(false)
  }

  const handleRootDrop = (e: React.DragEvent) => {
    setDropOver(false)

    // Native file from OS
    const nativeFile = e.dataTransfer.files?.[0]
    if (nativeFile && onFileUpload) {
      e.preventDefault()
      onFileUpload("", nativeFile)
      return
    }

    if (!dragIntentional) return

    const folderPath = e.dataTransfer.getData(DRAG_TYPE_FOLDER)
    if (folderPath && folderActions) {
      e.preventDefault()
      if (!folderPath.includes("/")) return
      folderActions.onMove(folderPath, "")
      return
    }

    const docPath = e.dataTransfer.getData(DRAG_TYPE_DOC)
    if (docPath && documentActions) {
      e.preventDefault()
      if (!docPath.includes("/")) return
      documentActions.onMove(docPath, "")
    }
  }

  const isAddingRootFile = addingFileInFolder === ""
  const isAddingRootFolder = addingFolderInFolder === ""

  return (
    <div>
      <ul className="text-sm">
        {(() => {
          const rootChildren = visibleChildren(root.children, showAll, orderMap.get(""))
          return rootChildren.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              depth={0}
              siblingNodes={rootChildren}
              allSiblingNodes={root.children ?? []}
              repoSlug={repoSlug}
              selectedFilePath={selectedFilePath}
              onFileSelect={onFileSelect}
              onFileDoubleClick={onFileDoubleClick}
              folderActions={folderActions}
              documentActions={documentActions}
              onFileUpload={onFileUpload}
              expandSignal={expandSignal}
              showAll={showAll}
              selectionType={selectionType}
              selectedFolderPath={selectedFolderPath}
              onFolderSelect={onFolderSelect}
              multiSelected={multiSelected}
              addingFileInFolder={addingFileInFolder}
              onAddingFileInFolderChange={onAddingFileInFolderChange}
              addingFolderInFolder={addingFolderInFolder}
              onAddingFolderInFolderChange={onAddingFolderInFolderChange}
              renamingFolderPath={renamingFolderPath}
              onRenamingFolderPathChange={onRenamingFolderPathChange}
              orderMap={orderMap}
              onReorder={onReorder}
            />
          ))
        })()}
        {isAddingRootFile && (
          <li
            className="flex items-center px-1.5 py-1"
            style={{ paddingLeft: "6px" }}
          >
            <File className="size-3.5 shrink-0 mr-1.5" />
            <InlineInput
              initial=""
              onConfirm={(name) => {
                documentActions?.onCreate("", name)
                onAddingFileInFolderChange(null)
              }}
              onCancel={() => onAddingFileInFolderChange(null)}
            />
          </li>
        )}
        {isAddingRootFolder && (
          <li
            className="flex items-center px-1.5 py-1"
            style={{ paddingLeft: "6px" }}
          >
            <Folder className="size-3.5 shrink-0 mr-1.5" />
            <InlineInput
              initial=""
              onConfirm={(name) => {
                folderActions?.onCreate("", name)
                onAddingFolderInFolderChange(null)
              }}
              onCancel={() => onAddingFolderInFolderChange(null)}
            />
          </li>
        )}
      </ul>
      <div
        className="min-h-6 flex-1"
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {dropOver && (
          <div className="mx-1 my-0.5 rounded border-2 border-dashed border-primary/60 bg-primary/10 py-1 text-center text-xs text-muted-foreground">
            Move to root
          </div>
        )}
      </div>
    </div>
  )
}
