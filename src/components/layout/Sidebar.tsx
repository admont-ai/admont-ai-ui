import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronsDownUp, ChevronsUpDown, Copy, EllipsisVertical, Eye, EyeOff, FileDown, FilePlus, Folder, FolderPlus, Import, Loader2, Lock, Pencil, RefreshCw, Trash2, Upload, Users } from "lucide-react"


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useDocumentMutations } from "@/hooks/use-document-mutations"
import { useDocuments } from "@/hooks/use-documents"
import { useFolderOrder } from "@/hooks/use-folder-order"
import { useFolders } from "@/hooks/use-folders"
import { authFetch } from "@/lib/auth-fetch"
import { hasPermission, useFilePermission, type PermissionLevel } from "@/hooks/use-file-permission"
import { DRAG_TYPE_FOLDER, DRAG_TYPE_DOC, dragIntentional, FileTree } from "./FileTree"
import { NewDocumentDialog } from "./NewDocumentDialog"
import { GroupsDialog } from "./GroupsDialog"
import { PermissionsDialog } from "./PermissionsDialog"
import { UploadFileDialog } from "./UploadFileDialog"

export function Sidebar({
  repoSlug,
  selectedFilePath,
  onFileSelect,
  onCreateFile,
  onFileDoubleClick,
  refreshKey,
  filePermission = "none",
  onExportFolderPdf,
  onImportConfluence,
}: {
  repoSlug: string
  selectedFilePath: string
  onFileSelect: (path: string) => void
  onCreateFile: (path: string) => void
  onFileDoubleClick?: (path: string) => void
  refreshKey?: number
  filePermission?: PermissionLevel
  onExportFolderPdf?: (folderPath: string) => void
  onImportConfluence?: () => void
}) {
  const [expandSignal, setExpandSignal] = useState(0)
  const [treeExpanded, setTreeExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [selectedFolderPath, setSelectedFolderPath] = useState("")
  const [selectionType, setSelectionType] = useState<"file" | "folder">(selectedFilePath ? "file" : "folder")
  const [addingFileInFolder, setAddingFileInFolder] = useState<string | null>(null)
  const [addingFolderInFolder, setAddingFolderInFolder] = useState<string | null>(null)
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [deletingFile, setDeletingFile] = useState(false)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const lastClickedPathRef = useRef<string | null>(null)
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null)
  const [rootDropOver, setRootDropOver] = useState(false)
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [permissionsPath, setPermissionsPath] = useState<string | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const { tree, loading: docsLoading, refresh: refreshDocs } = useDocuments(repoSlug)
  const { orderMap, saveOrder } = useFolderOrder(repoSlug, refreshDocs)

  // Fetch permission for the selected folder (append / for folders; root uses ".")
  const folderInfoPath = selectedFolderPath ? selectedFolderPath + "/" : "."
  const { permission: folderPermission } = useFilePermission(repoSlug, folderInfoPath)
  const { permission: rootPermission } = useFilePermission(repoSlug, ".")
  const isRepoManager = rootPermission === "manager"

  // Effective permission for the currently-focused item (file or folder)
  const effectivePermission: PermissionLevel = selectionType === "file" ? filePermission : folderPermission
  const canUpdate = hasPermission(effectivePermission, "contributor")
  const canDelete = hasPermission(effectivePermission, "content_manager")
  // For creating files/folders inside a folder, use the folder's permission
  const canCreateInFolder = hasPermission(folderPermission, "contributor")

  useEffect(() => {
    if (refreshKey) refreshDocs()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const { createFolder, updateFolder, deleteFolder, moveFolder } = useFolders(repoSlug, refreshDocs)
  const { createDocument, deleteDocument, moveDocument, renameDocument } = useDocumentMutations(repoSlug, refreshDocs)

  // When a file is selected externally (search, URL), switch to file selection
  useEffect(() => {
    if (selectedFilePath) setSelectionType("file")
  }, [selectedFilePath])

  // Correct selectedFilePath when the backend auto-appends .md to the filename
  useEffect(() => {
    if (!tree || !selectedFilePath) return
    const parts = selectedFilePath.split("/")
    let node = tree
    for (const part of parts) {
      const child = node.children?.find((c) => c.name === part)
      if (child) { node = child; continue }
      // Path not found — check if .md-suffixed version exists
      const mdChild = node.children?.find((c) => c.name === part + ".md")
      if (mdChild) {
        const corrected = [...parts.slice(0, parts.indexOf(part)), mdChild.name].join("/")
        onFileSelect(corrected)
      }
      break
    }
  }, [tree, selectedFilePath, onFileSelect])

  const getVisiblePaths = useCallback((): string[] => {
    if (!treeContainerRef.current) return []
    const elements = treeContainerRef.current.querySelectorAll("[data-tree-path]")
    return Array.from(elements).map((el) => el.getAttribute("data-tree-path")!).filter(Boolean)
  }, [])

  const selectRange = useCallback((fromPath: string, toPath: string) => {
    const paths = getVisiblePaths()
    const fromIdx = paths.indexOf(fromPath)
    const toIdx = paths.indexOf(toPath)
    if (fromIdx < 0 || toIdx < 0) return
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    setMultiSelected((prev) => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) next.add(paths[i])
      return next
    })
  }, [getVisiblePaths])

  const handleMultiSelect = useCallback((path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
    if (e?.shiftKey && lastClickedPathRef.current) {
      selectRange(lastClickedPathRef.current, path)
      lastClickedPathRef.current = path
      return true
    }
    if (e && (e.ctrlKey || e.metaKey)) {
      setMultiSelected((prev) => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      })
      lastClickedPathRef.current = path
      return true
    }
    lastClickedPathRef.current = path
    return false
  }, [selectRange])

  const handleFileSelect = useCallback((path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
    if (handleMultiSelect(path, e)) return
    setMultiSelected(new Set())
    if (path) setSelectionType("file")
    onFileSelect(path)
  }, [onFileSelect, handleMultiSelect])

  const handleFolderSelect = useCallback((path: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
    if (handleMultiSelect(path, e)) return
    setMultiSelected(new Set())
    setSelectedFolderPath(path)
    setSelectionType("folder")
  }, [handleMultiSelect])

  // Auto-select README.md when the tree loads and no file is selected
  useEffect(() => {
    if (!tree || selectedFilePath) return
    const hasReadme = tree.children?.some(
      (child) => child.type === "file" && child.name.toLowerCase() === "readme.md"
    )
    if (hasReadme) {
      const readme = tree.children!.find(
        (child) => child.type === "file" && child.name.toLowerCase() === "readme.md"
      )!
      onFileSelect(readme.name)
    }
  }, [tree, selectedFilePath, onFileSelect])

  const handleCreateDocument = async (folderPath: string, name: string, content = "") => {
    const path = await createDocument(folderPath, name, content)
    onCreateFile(path)
    return path
  }

  const handleDeleteDocument = async (docPath: string) => {
    await deleteDocument(docPath)
    if (selectedFilePath === docPath) {
      onFileSelect("")
    }
  }

  const handleMoveDocument = async (docPath: string, destination: string) => {
    await moveDocument(docPath, destination)
    if (selectedFilePath === docPath) {
      const fileName = docPath.split("/").pop() ?? ""
      const newPath = destination ? `${destination}/${fileName}` : fileName
      onFileSelect(newPath)
    }
  }

  const handleDeleteSelectedFolder = useCallback(async () => {
    if (!selectedFolderPath) return
    await deleteFolder(selectedFolderPath)
    setSelectedFolderPath("")
    setDeletingFolder(false)
  }, [selectedFolderPath, deleteFolder])

  const handleDeleteSelectedFile = useCallback(async () => {
    if (!selectedFilePath) return
    await handleDeleteDocument(selectedFilePath)
    setDeletingFile(false)
  }, [selectedFilePath, handleDeleteDocument])

  const handleBulkDelete = useCallback(async () => {
    if (multiSelected.size === 0) return
    setBulkDeleting(true)
    try {
      const res = await authFetch(`/repos/${encodeURIComponent(repoSlug)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: Array.from(multiSelected) }),
      })
      if (res.ok) {
        if (multiSelected.has(selectedFilePath)) {
          onFileSelect("")
        }
        setMultiSelected(new Set())
        setDeletingBulk(false)
        refreshDocs()
      }
    } catch {
      // handled by authFetch
    } finally {
      setBulkDeleting(false)
    }
  }, [multiSelected, repoSlug, selectedFilePath, onFileSelect, refreshDocs])

  const handleRenameFile = useCallback(async (newName: string) => {
    if (!renamingFilePath) return
    const newPath = await renameDocument(renamingFilePath, newName)
    if (selectedFilePath === renamingFilePath) {
      onFileSelect(newPath)
    }
    setRenamingFilePath(null)
  }, [renamingFilePath, selectedFilePath, renameDocument, onFileSelect])

  const handleFileUpload = useCallback(async (folderPath: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const uploadPath = folderPath ? `${folderPath}/${file.name}` : file.name
    const url = `/repos/${encodeURIComponent(repoSlug)}/upload/${uploadPath}`
    const res = await authFetch(url, { method: "POST", body: formData })
    if (res.ok) {
      await res.json()
      refreshDocs()
    }
  }, [repoSlug, refreshDocs])

  const handleReorder = useCallback((parentPath: string, orderedNames: string[]) => {
    saveOrder(parentPath, orderedNames)
  }, [saveOrder])

  const handleCopyPath = useCallback(() => {
    const path = selectionType === "folder" ? selectedFolderPath : selectedFilePath
    if (path) navigator.clipboard.writeText(path)
  }, [selectionType, selectedFolderPath, selectedFilePath])

  const deletingFolderName = selectedFolderPath.split("/").pop() ?? ""
  const deletingFileName = selectedFilePath.split("/").pop() ?? ""

  const handleContentDragOver = useCallback((e: React.DragEvent) => {
    if (!dragIntentional) return
    const hasFolder = e.dataTransfer.types.includes(DRAG_TYPE_FOLDER)
    const hasDoc = e.dataTransfer.types.includes(DRAG_TYPE_DOC)
    if (!hasFolder && !hasDoc) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    setRootDropOver(true)
  }, [])

  const handleContentDragLeave = useCallback(() => {
    setRootDropOver(false)
  }, [])

  const handleContentDrop = useCallback((e: React.DragEvent) => {
    setRootDropOver(false)
    if (!dragIntentional) return

    const folderPath = e.dataTransfer.getData(DRAG_TYPE_FOLDER)
    if (folderPath) {
      e.preventDefault()
      if (!folderPath.includes("/")) return // already at root
      moveFolder(folderPath, "")
      return
    }

    const docPath = e.dataTransfer.getData(DRAG_TYPE_DOC)
    if (docPath) {
      e.preventDefault()
      if (!docPath.includes("/")) return // already at root
      handleMoveDocument(docPath, "")
    }
  }, [moveFolder, handleMoveDocument])

  // Clear multi-selection on Escape
  useEffect(() => {
    if (multiSelected.size === 0) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMultiSelected(new Set())
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [multiSelected.size])

  return (
    <nav className="flex h-full flex-col overflow-hidden bg-muted pt-1.5 pb-4 pl-2 pr-1">
      {repoSlug && (
        <>
          <div className="mb-1.5 flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={refreshDocs}
              disabled={docsLoading}
              title="Reload documents"
            >
              <RefreshCw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowAll((v) => !v)}
              title={showAll ? "Show only content files" : "Show all files"}
            >
              {showAll ? <Eye /> : <EyeOff />}
            </Button>
            {canCreateInFolder && (
              <>
                <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setNewDocDialogOpen(true)}
                  title="New document"
                >
                  <FilePlus />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setAddingFolderInFolder(selectedFolderPath)}
                  title="New folder"
                >
                  <FolderPlus />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  disabled={selectionType === "file" && !selectedFilePath}
                  title="Actions"
                >
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Rename / Copy path only for non-root selections */}
                {(selectionType === "file" ? !!selectedFilePath : !!selectedFolderPath) && (
                  <>
                    {canUpdate && (
                      <DropdownMenuItem
                        onClick={() => {
                          if (selectionType === "folder" && selectedFolderPath) {
                            setRenamingFolderPath(selectedFolderPath)
                          } else if (selectionType === "file" && selectedFilePath) {
                            setRenamingFilePath(selectedFilePath)
                          }
                        }}
                      >
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleCopyPath}>
                      <Copy />
                      Copy path
                    </DropdownMenuItem>
                  </>
                )}
                {canCreateInFolder && (
                  <>
                    <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                      <Upload />
                      Upload file
                    </DropdownMenuItem>
                    {onImportConfluence && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Import />
                          Import
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={onImportConfluence}>
                            Confluence Space
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                  </>
                )}
                {isRepoManager && (
                  <DropdownMenuItem
                    onClick={() => {
                      const path = selectionType === "folder" ? selectedFolderPath : selectedFilePath
                      setPermissionsPath(path)
                    }}
                  >
                    <Lock />
                    Permissions
                  </DropdownMenuItem>
                )}
                {selectionType === "folder" && onExportFolderPdf && (
                  <DropdownMenuItem onClick={() => onExportFolderPdf(selectedFolderPath)}>
                    <FileDown />
                    Export as PDF
                  </DropdownMenuItem>
                )}
                {isRepoManager && selectionType === "folder" && !selectedFolderPath && (
                  <DropdownMenuItem onClick={() => setGroupsOpen(true)}>
                    <Users />
                    Groups
                  </DropdownMenuItem>
                )}
                {multiSelected.size > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeletingBulk(true)}
                    >
                      <Trash2 />
                      Delete {multiSelected.size} items
                    </DropdownMenuItem>
                  </>
                ) : canDelete && (selectionType === "file" ? !!selectedFilePath : !!selectedFolderPath) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (selectionType === "folder") {
                          setDeletingFolder(true)
                        } else {
                          setDeletingFile(true)
                        }
                      }}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <hr className="border-border" />
        </>
      )}

      {multiSelected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-xs shrink-0">
          {bulkDeleting ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Deleting {multiSelected.size} items…</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">{multiSelected.size} selected</span>
              <button
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => setMultiSelected(new Set())}
              >
                Clear
              </button>
              <button
                className="text-destructive hover:text-destructive/80 font-medium"
                onClick={() => setDeletingBulk(true)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <div ref={treeContainerRef} className="flex-1 overflow-y-auto pt-3">
        <div
          className="flex items-center"
          onDragOver={canCreateInFolder ? handleContentDragOver : undefined}
          onDragLeave={canCreateInFolder ? handleContentDragLeave : undefined}
          onDrop={canCreateInFolder ? handleContentDrop : undefined}
        >
          <button
            type="button"
            className={cn(
              "flex flex-1 min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm font-medium",
              selectionType === "folder" && selectedFolderPath === "" && "bg-neutral-600 text-white dark:bg-neutral-500",
            )}
            onClick={() => handleFolderSelect("")}
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">Content</span>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const next = !treeExpanded
              setTreeExpanded(next)
              setExpandSignal((s) => next ? Math.abs(s) + 1 : -(Math.abs(s) + 1))
            }}
            title={treeExpanded ? "Collapse all" : "Expand all"}
          >
            {treeExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
          </Button>
        </div>
        {rootDropOver && (
          <div className="mx-1 my-0.5 rounded border-2 border-dashed border-primary/60 bg-primary/10 py-1 text-center text-xs text-muted-foreground">
            Move here
          </div>
        )}
        {docsLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {tree && (
          <FileTree
            root={tree}
            repoSlug={repoSlug}
            selectedFilePath={selectedFilePath}
            onFileSelect={handleFileSelect}
            onFileDoubleClick={onFileDoubleClick}
            expandSignal={expandSignal}
            showAll={showAll}
            selectionType={selectionType}
            selectedFolderPath={selectedFolderPath}
            onFolderSelect={handleFolderSelect}
            multiSelected={multiSelected}
            addingFileInFolder={addingFileInFolder}
            onAddingFileInFolderChange={setAddingFileInFolder}
            addingFolderInFolder={addingFolderInFolder}
            onAddingFolderInFolderChange={setAddingFolderInFolder}
            renamingFolderPath={renamingFolderPath}
            onRenamingFolderPathChange={setRenamingFolderPath}
            folderActions={canCreateInFolder ? {
              onCreate: createFolder,
              onRename: updateFolder,
              onDelete: deleteFolder,
              onMove: moveFolder,
            } : undefined}
            documentActions={canCreateInFolder ? {
              onCreate: handleCreateDocument,
              onDelete: handleDeleteDocument,
              onMove: handleMoveDocument,
            } : undefined}
            onFileUpload={canCreateInFolder ? handleFileUpload : undefined}
            orderMap={orderMap}
            onReorder={handleReorder}
          />
        )}
      </div>

      <NewDocumentDialog
        open={newDocDialogOpen}
        onOpenChange={setNewDocDialogOpen}
        folderPath={selectedFolderPath}
        onCreate={handleCreateDocument}
      />

      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        repoSlug={repoSlug}
        folderPath={selectedFolderPath}
        onUploaded={refreshDocs}
      />

      <AlertDialog open={deletingFolder} onOpenChange={(v) => !v && setDeletingFolder(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingFolderName}</strong>? This will delete all files and subfolders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSelectedFolder}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingFile} onOpenChange={(v) => !v && setDeletingFile(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingFileName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSelectedFile}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingBulk} onOpenChange={(v) => !v && setDeletingBulk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {multiSelected.size} items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete these {multiSelected.size} files and folders? This action cannot be undone.
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 text-xs">
                {Array.from(multiSelected).map((p) => (
                  <li key={p} className="truncate">{p}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RenameFileDialog
        open={renamingFilePath !== null}
        onOpenChange={(v) => !v && setRenamingFilePath(null)}
        currentName={renamingFilePath?.split("/").pop() ?? ""}
        onRename={handleRenameFile}
      />
      <PermissionsDialog
        open={permissionsPath !== null}
        onOpenChange={(v) => { if (!v) setPermissionsPath(null) }}
        repoSlug={repoSlug}
        path={permissionsPath ?? ""}
        onSaved={refreshDocs}
      />
      <GroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        repoSlug={repoSlug}
        onSaved={refreshDocs}
      />
    </nav>
  )
}

function RenameFileDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (newName: string) => Promise<void>
}) {
  const [name, setName] = useState(currentName)

  useEffect(() => {
    if (open) setName(currentName)
  }, [open, currentName])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== currentName) {
      onRename(trimmed)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || name.trim() === currentName}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
