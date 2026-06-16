import { useCallback, useEffect, useRef, useState } from "react"
import { Workflow, Eye, Code2, Save, X } from "lucide-react"
import {
  usePublisher,
  useCellValue,
  activeEditor$,
  insertImage$,
  $isImageNode,
} from "@mdxeditor/editor"
import { $getNodeByKey } from "lexical"
import type { NodeKey } from "lexical"
import mermaid from "mermaid"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { detectDiagramType } from "@/components/mermaid-editor/diagram-detector"
import type { VisualDiagramType } from "@/components/mermaid-editor/types"
import { MermaidVisualEditor } from "@/components/mermaid-editor/MermaidVisualEditor"

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  // Use SVG <text> instead of <foreignObject> with HTML labels.
  // <foreignObject> content is not rendered when the SVG is loaded
  // via an <img> tag (browser security restriction).
  htmlLabels: false,
  flowchart: { htmlLabels: false },
})

export interface MermaidEditRequest {
  nodeKey: NodeKey
  src: string
}

interface MermaidEditorDialogProps {
  repoSlug: string
  filePath: string
  editRequest: MermaidEditRequest | null
  onEditHandled: () => void
  onDiagramSaved?: () => void
}

const DEFAULT_CODE = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]`

type EditorMode = "visual" | "text"

/** Extract the diagram name from an SVG URL, e.g. ".../foo.svg" -> "foo" */
function extractNameFromSrc(src: string): string | null {
  try {
    const pathname = src.startsWith("http")
      ? new URL(src).pathname
      : src.split("?")[0]
    const filename = pathname.split("/").pop() ?? ""
    const lower = filename.toLowerCase()
    // Reject .drawio.svg — those belong to the draw.io editor
    if (lower.endsWith(".drawio.svg")) return null
    if (!lower.endsWith(".svg")) return null
    return filename.slice(0, -4)
  } catch {
    return null
  }
}

export function MermaidEditorDialog({
  repoSlug,
  filePath,
  editRequest,
  onEditHandled,
  onDiagramSaved,
}: MermaidEditorDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [width, setWidth] = useState<string>("")
  const [code, setCode] = useState(DEFAULT_CODE)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewError, setPreviewError] = useState("")
  const [inserting, setInserting] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>("visual")
  const [visualDiagramType, setVisualDiagramType] = useState<VisualDiagramType | null>("flowchart")
  const [visualEditorKey, setVisualEditorKey] = useState(0)

  const [editingNodeKey, setEditingNodeKey] = useState<NodeKey | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const renderIdRef = useRef(0)

  const editor = useCellValue(activeEditor$)
  const insertImage = usePublisher(insertImage$)

  const isEditing = editingNodeKey !== null

  const dir = filePath.includes("/")
    ? filePath.substring(0, filePath.lastIndexOf("/") + 1)
    : ""
  const assetDir = `${dir}assets/`

  const buildUploadUrl = useCallback(
    (filename: string) =>
      `/repos/${encodeURIComponent(repoSlug)}/upload/${assetDir}${filename}`,
    [repoSlug, assetDir],
  )

  const buildDocumentUrl = useCallback(
    (filename: string) =>
      `/repos/${encodeURIComponent(repoSlug)}/file/${assetDir}${filename}`,
    [repoSlug, assetDir],
  )

  const renderPreview = useCallback(async (source: string) => {
    renderIdRef.current += 1
    const thisId = renderIdRef.current

    try {
      const { svg } = await mermaid.render(`mermaid-preview-${thisId}`, source)
      setPreviewHtml(svg)
      setPreviewError("")
    } catch {
      setPreviewError("Invalid mermaid syntax")
      document.getElementById(`dmermaid-preview-${thisId}`)?.remove()
    }
  }, [])

  // Debounced live preview (text mode only)
  useEffect(() => {
    if (!open || editorMode !== "text") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      renderPreview(code)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [code, open, renderPreview, editorMode])

  const loadMmdSource = useCallback(
    async (diagramName: string) => {
      try {
        const url = buildDocumentUrl(`${diagramName}.mmd`)
        const res = await authFetch(url, { method: "GET" })
        if (res.ok) {
          const text = await res.text()
          setCode(text)
          // Detect diagram type and set mode
          const detection = detectDiagramType(text)
          if (detection.isVisual) {
            setVisualDiagramType(detection.type as VisualDiagramType)
            setEditorMode("visual")
            setVisualEditorKey((k) => k + 1)
          } else {
            setVisualDiagramType(null)
            setEditorMode("text")
          }
          return true
        }
      } finally {
        // no-op
      }
      return false
    },
    [buildDocumentUrl],
  )

  // Handle edit requests from ImageUploadDialog
  useEffect(() => {
    if (!editRequest) return
    const diagramName = extractNameFromSrc(editRequest.src)
    if (!diagramName) return

    setName(diagramName)
    setWidth("")
    setEditingNodeKey(editRequest.nodeKey)
    setCode(DEFAULT_CODE)
    setPreviewHtml("")
    setPreviewError("")
    setOpen(true)
    onEditHandled()
    loadMmdSource(diagramName)

    // Read the current width from the image node
    if (editor) {
      editor.getEditorState().read(() => {
        const node = $getNodeByKey(editRequest.nodeKey)
        if (node && $isImageNode(node)) {
          const w = node.getWidth()
          setWidth(typeof w === "number" ? String(w) : "")
        }
      })
    }
  }, [editRequest, onEditHandled, loadMmdSource, editor])

  const detectAndSetMode = useCallback((mermaidCode: string) => {
    const detection = detectDiagramType(mermaidCode)
    if (detection.isVisual) {
      setVisualDiagramType(detection.type as VisualDiagramType)
      setEditorMode("visual")
    } else {
      setVisualDiagramType(null)
      setEditorMode("text")
    }
  }, [])

  const handleOpen = useCallback(() => {
    setName("")
    setWidth("")
    setCode(DEFAULT_CODE)
    setPreviewHtml("")
    setPreviewError("")
    setEditingNodeKey(null)
    detectAndSetMode(DEFAULT_CODE)
    setVisualEditorKey((k) => k + 1)
    setOpen(true)
  }, [detectAndSetMode])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleToggleMode = useCallback(() => {
    if (editorMode === "visual") {
      // Switch to text mode — code is already synced via onCodeChange
      setEditorMode("text")
    } else {
      // Switch to visual mode — re-detect and re-initialize
      const detection = detectDiagramType(code)
      if (detection.isVisual) {
        setVisualDiagramType(detection.type as VisualDiagramType)
        setEditorMode("visual")
        setVisualEditorKey((k) => k + 1)
      }
    }
  }, [editorMode, code])

  const handleVisualCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
  }, [])

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !code.trim()) return
    setInserting(true)
    try {
      // Render final SVG
      renderIdRef.current += 1
      let svgString = (await mermaid.render(
        `mermaid-final-${renderIdRef.current}`,
        code,
      )).svg

      // Inject width into SVG if specified (replace existing width attribute to avoid duplicates)
      const parsedWidth = width ? parseInt(width, 10) : undefined
      if (parsedWidth) {
        svgString = svgString.replace(/ width="[^"]*"/, ` width="${parsedWidth}"`)
      }

      // Upload SVG
      const svgFile = new File([svgString], `${trimmedName}.svg`, {
        type: "image/svg+xml",
      })
      const svgFormData = new FormData()
      svgFormData.append("file", svgFile)
      const svgRes = await authFetch(buildUploadUrl(`${trimmedName}.svg`), {
        method: "POST",
        body: svgFormData,
      })
      if (!svgRes.ok) throw new Error("SVG upload failed")
      await svgRes.json()

      // Upload .mmd source
      const mmdFile = new File([code], `${trimmedName}.mmd`, {
        type: "text/plain",
      })
      const mmdFormData = new FormData()
      mmdFormData.append("file", mmdFile)
      await authFetch(buildUploadUrl(`${trimmedName}.mmd`), {
        method: "POST",
        body: mmdFormData,
      })

      // Use relative path with cache-bust so the browser fetches the fresh SVG
      const relativePath = `assets/${trimmedName}.svg`
      const cacheBustedUrl = relativePath + "?t=" + Date.now()

      // Update existing image node or insert new one
      if (editingNodeKey && editor) {
        editor.update(() => {
          const node = $getNodeByKey(editingNodeKey)
          if (node && $isImageNode(node)) {
            node.setSrc(cacheBustedUrl)
            node.setWidthAndHeight(parsedWidth ?? "inherit", "inherit")
          }
        })
      } else {
        insertImage({ src: cacheBustedUrl, altText: trimmedName, width: parsedWidth })
      }

      handleClose()
      // Delay so the Lexical editor can flush the insertImage update
      // before onDiagramSaved reads getMarkdown()
      setTimeout(() => onDiagramSaved?.(), 0)
    } catch {
      // errors are already toasted by authFetch
    } finally {
      setInserting(false)
    }
  }, [name, code, width, buildUploadUrl, insertImage, handleClose, editingNodeKey, editor, onDiagramSaved])

  const canSwitchToVisual = visualDiagramType !== null || detectDiagramType(code).isVisual

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Mermaid Diagram"
        onClick={handleOpen}
        className="[&_svg]:size-4 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        <Workflow />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent showCloseButton={false} className="flex h-[100dvh] max-w-none flex-col rounded-none border-0 p-6 sm:max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isEditing ? "Edit Mermaid Diagram" : "Insert Mermaid Diagram"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={editorMode === "visual" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => canSwitchToVisual && handleToggleMode()}
                    disabled={editorMode === "visual" || !canSwitchToVisual}
                    className="gap-1 text-xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Visual
                  </Button>
                  <Button
                    type="button"
                    variant={editorMode === "text" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={handleToggleMode}
                    disabled={editorMode === "text"}
                    className="gap-1 text-xs"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    Text
                  </Button>
                </div>
                <Button size="icon-sm" onClick={handleSave} disabled={!name.trim() || !code.trim() || inserting} title="Save">
                  <Save />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={handleClose} title="Exit">
                  <X />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_120px] gap-4">
            <div className="space-y-1">
              <label htmlFor="mermaid-name" className="text-sm font-medium">
                Diagram name
              </label>
              <input
                id="mermaid-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-diagram"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mermaid-width" className="text-sm font-medium">
                Width (px)
              </label>
              <input
                id="mermaid-width"
                type="number"
                min="50"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="Auto"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {editorMode === "visual" && visualDiagramType ? (
              <MermaidVisualEditor
                key={visualEditorKey}
                initialCode={code}
                diagramType={visualDiagramType}
                onCodeChange={handleVisualCodeChange}
              />
            ) : (
              <div className="grid h-full grid-cols-2 gap-4">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  className="bg-muted text-foreground border-input h-full w-full resize-none rounded-md border p-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  placeholder="Enter mermaid code..."
                />
                <div className="border-input overflow-auto rounded-md border p-3">
                  {previewError ? (
                    <p className="text-destructive text-sm">{previewError}</p>
                  ) : previewHtml ? (
                    <div
                      className="flex h-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Preview will appear here...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}
