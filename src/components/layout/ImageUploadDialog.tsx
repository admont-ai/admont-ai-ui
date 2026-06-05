import { useCallback, useEffect, useRef, useState } from "react"
import { ImageUp, Folder, FileImage, FileVideo, ChevronRight } from "lucide-react"
import {
  useCellValues,
  usePublisher,
} from "@mdxeditor/editor"
import {
  imageDialogState$,
  imageUploadHandler$,
  saveImage$,
  closeImageDialog$,
  insertImage$,
} from "@mdxeditor/editor"

import { authFetch } from "@/lib/auth-fetch"
import type { DocNode, RepoTree } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MermaidEditRequest } from "./MermaidEditorDialog"
import type { DrawioEditRequest } from "./DrawioEditorDialog"

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico",
])

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv",
])

function isImageFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

function isVideoFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return VIDEO_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

function isMediaFile(name: string): boolean {
  return isImageFile(name) || isVideoFile(name)
}

function convertToDocNode(name: string, tree: RepoTree): DocNode {
  const children: DocNode[] = []
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith("/")) {
      children.push(convertToDocNode(key.slice(1), value as RepoTree))
    } else {
      children.push({ name: key, type: "file" })
    }
  }
  return { name, type: "directory", children }
}

function getRelativePath(fromDir: string, toPath: string): string {
  const fromParts = fromDir.split("/").filter(Boolean)
  const toParts = toPath.split("/").filter(Boolean)
  let common = 0
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++
  }
  const ups = fromParts.length - common
  const remaining = toParts.slice(common)
  return [...Array(ups).fill(".."), ...remaining].join("/")
}

interface ImageUploadDialogProps {
  repoSlug: string
  filePath: string
  onMermaidEdit?: (request: MermaidEditRequest) => void
  onDrawioEdit?: (request: DrawioEditRequest) => void
}

type Tab = "upload" | "server"

export function ImageUploadDialog({
  repoSlug,
  filePath,
  onMermaidEdit,
  onDrawioEdit,
}: ImageUploadDialogProps) {
  const [state, imageUploadHandler] = useCellValues(
    imageDialogState$,
    imageUploadHandler$
  )
  const saveImage = usePublisher(saveImage$)
  const closeDialog = usePublisher(closeImageDialog$)
  const insertImage = usePublisher(insertImage$)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [altText, setAltText] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [tab, setTab] = useState<Tab>("upload")
  const [serverTree, setServerTree] = useState<DocNode | null>(null)
  const [serverLoading, setServerLoading] = useState(false)

  const dir = filePath.includes("/")
    ? filePath.substring(0, filePath.lastIndexOf("/") + 1)
    : ""

  // When image dialog opens in editing mode for an .svg, redirect to appropriate editor
  useEffect(() => {
    if (state.type !== "editing") return
    const src = state.initialValues.src
    if (!src) return
    const pathname = src.split("?")[0].toLowerCase()

    if (pathname.endsWith(".drawio.svg") && onDrawioEdit) {
      closeDialog()
      onDrawioEdit({ nodeKey: state.nodeKey, src })
    } else if (pathname.endsWith(".svg") && onMermaidEdit) {
      closeDialog()
      onMermaidEdit({ nodeKey: state.nodeKey, src })
    }
  }, [state, onMermaidEdit, onDrawioEdit, closeDialog])

  const selectFile = useCallback((file: File | null) => {
    setSelectedFile(file)
    if (file) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
  }, [])

  const reset = useCallback(() => {
    setSelectedFile(null)
    setPreview(null)
    setAltText("")
    setDragOver(false)
    setTab("upload")
    setServerTree(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleClose = useCallback(() => {
    closeDialog()
    reset()
  }, [closeDialog, reset])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(e.target.files?.[0] ?? null)
    },
    [selectFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) selectFile(file)
  }, [selectFile])

  const handleSave = useCallback(() => {
    if (!selectedFile) return
    const dt = new DataTransfer()
    dt.items.add(selectedFile)
    saveImage({
      file: dt.files,
      altText: altText || selectedFile.name,
    })
    reset()
  }, [selectedFile, altText, saveImage, reset])

  // Fetch server files when switching to server tab
  const fetchServerFiles = useCallback(async () => {
    if (!repoSlug) return
    setServerLoading(true)
    try {
      const res = await authFetch(`/repos/${encodeURIComponent(repoSlug)}`)
      if (!res.ok) return
      const data = (await res.json()) as RepoTree
      setServerTree(convertToDocNode(repoSlug, data))
    } catch {
      // handled by authFetch
    } finally {
      setServerLoading(false)
    }
  }, [repoSlug])

  const handleTabChange = useCallback(
    (t: Tab) => {
      setTab(t)
      if (t === "server" && !serverTree) fetchServerFiles()
    },
    [serverTree, fetchServerFiles],
  )

  const handleServerFileSelect = useCallback(
    (fullPath: string) => {
      const relativeSrc = getRelativePath(dir, fullPath)
      const fileName = fullPath.split("/").pop() ?? relativeSrc
      insertImage({ src: relativeSrc, altText: fileName })
      handleClose()
    },
    [dir, insertImage, handleClose],
  )

  if (state.type === "inactive") return null

  // Don't render the image dialog if this is an SVG being redirected to a diagram editor
  if (state.type === "editing") {
    const pathname = state.initialValues.src?.split("?")[0].toLowerCase()
    if (pathname?.endsWith(".drawio.svg") || pathname?.endsWith(".svg")) {
      return null
    }
  }

  const isEditing = state.type === "editing"

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit media" : "Insert media"}
          </DialogTitle>
        </DialogHeader>

        {!isEditing && imageUploadHandler && (
          <div className="flex gap-1 border-b pb-1">
            <button
              type="button"
              onClick={() => handleTabChange("upload")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                tab === "upload"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("server")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                tab === "server"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Server
            </button>
          </div>
        )}

        <div className="space-y-4">
          {imageUploadHandler && !isEditing && (
            <div className="h-72">
              {tab === "upload" && (
                <div className="flex h-full flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {preview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`group relative w-full overflow-hidden rounded-md border-2 ${dragOver ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {selectedFile?.type.startsWith("video/") ? (
                        <video src={preview} className="max-h-48 w-full object-contain" />
                      ) : (
                        <img src={preview} alt="Preview" className="max-h-48 w-full object-contain" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="text-sm font-medium text-white">
                          Change file
                        </span>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors ${dragOver ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"}`}
                    >
                      <ImageUp className="text-muted-foreground size-8" />
                      <span className="text-muted-foreground text-sm font-medium">
                        Drop a file here or click to browse
                      </span>
                    </button>
                  )}
                  {selectedFile && (
                    <p className="text-muted-foreground truncate text-xs">
                      {selectedFile.name}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="img-alt" className="text-sm font-medium">
                      Alt text
                    </label>
                    <input
                      id="img-alt"
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Describe the image"
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  </div>
                </div>
              )}

              {tab === "server" && (
                <ServerFileBrowser
                  tree={serverTree}
                  loading={serverLoading}
                  repoSlug={repoSlug}
                  onSelect={handleServerFileSelect}
                />
              )}
            </div>
          )}

          {isEditing && (
            <div className="space-y-1.5">
              <label htmlFor="img-alt" className="text-sm font-medium">
                Alt text
              </label>
              <input
                id="img-alt"
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {(tab === "upload" || isEditing) && (
            <Button onClick={handleSave} disabled={!selectedFile}>
              {isEditing ? "Save" : "Insert"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ServerFileBrowser({
  tree,
  loading,
  repoSlug,
  onSelect,
}: {
  tree: DocNode | null
  loading: boolean
  repoSlug: string
  onSelect: (fullPath: string) => void
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
  }
  if (!tree?.children?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No files found</p>
  }

  return (
    <div className="h-full overflow-y-auto rounded-md border">
      <FolderContents
        nodes={tree.children}
        parentPath=""
        repoSlug={repoSlug}
        onSelect={onSelect}
      />
    </div>
  )
}

function FolderContents({
  nodes,
  parentPath,
  repoSlug,
  onSelect,
}: {
  nodes: DocNode[]
  parentPath: string
  repoSlug: string
  onSelect: (fullPath: string) => void
}) {
  // Sort: folders first, then files, alphabetically
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  // Filter: only show directories and media files
  const filtered = sorted.filter(
    (n) => n.type === "directory" || isMediaFile(n.name),
  )

  if (!filtered.length) return null

  return (
    <ul className="text-sm">
      {filtered.map((node) => {
        const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
        if (node.type === "directory") {
          return (
            <FolderItem
              key={fullPath}
              node={node}
              fullPath={fullPath}
              repoSlug={repoSlug}
              onSelect={onSelect}
            />
          )
        }
        return (
          <li key={fullPath}>
            <button
              type="button"
              onClick={() => onSelect(fullPath)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
            >
              {isVideoFile(node.name) ? (
                <FileVideo className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileImage className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function FolderItem({
  node,
  fullPath,
  repoSlug,
  onSelect,
}: {
  node: DocNode
  fullPath: string
  repoSlug: string
  onSelect: (fullPath: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Only render folder if it has media descendants
  const hasMedia = hasMediaDescendants(node)
  if (!hasMedia) return null

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-medium hover:bg-muted/50 transition-colors"
      >
        <ChevronRight
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.children && (
        <div className="pl-4">
          <FolderContents
            nodes={node.children}
            parentPath={fullPath}
            repoSlug={repoSlug}
            onSelect={onSelect}
          />
        </div>
      )}
    </li>
  )
}

function hasMediaDescendants(node: DocNode): boolean {
  if (node.type === "file") return isMediaFile(node.name)
  return node.children?.some(hasMediaDescendants) ?? false
}
