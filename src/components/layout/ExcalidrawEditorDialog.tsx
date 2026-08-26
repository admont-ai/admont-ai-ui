import { useCallback, useEffect, useRef, useState } from "react"
import { Shapes, Save, X } from "lucide-react"
import {
  usePublisher,
  useCellValue,
  activeEditor$,
  insertImage$,
  $isImageNode,
} from "@mdxeditor/editor"
import { $getNodeByKey } from "lexical"
import type { NodeKey } from "lexical"
import { Excalidraw, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ExcalidrawEditRequest {
  nodeKey: NodeKey
  src: string
}

interface ExcalidrawEditorDialogProps {
  repoSlug: string
  filePath: string
  editRequest: ExcalidrawEditRequest | null
  onEditHandled: () => void
  onDiagramSaved?: () => void
}

/** Extract the diagram name from a .excalidraw.svg URL */
function extractNameFromSrc(src: string): string | null {
  try {
    const pathname = src.startsWith("http")
      ? new URL(src).pathname
      : src.split("?")[0]
    const filename = pathname.split("/").pop() ?? ""
    if (!filename.toLowerCase().endsWith(".excalidraw.svg")) return null
    return filename.slice(0, -".excalidraw.svg".length)
  } catch {
    return null
  }
}

export function ExcalidrawEditorDialog({
  repoSlug,
  filePath,
  editRequest,
  onEditHandled,
  onDiagramSaved,
}: ExcalidrawEditorDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingNodeKey, setEditingNodeKey] = useState<NodeKey | null>(null)

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const sceneRef = useRef<{ elements: readonly OrderedExcalidrawElement[]; appState: Partial<AppState>; files: BinaryFiles }>({ elements: [], appState: {}, files: {} })
  const [editorKey, setEditorKey] = useState(0)

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

  const loadExcalidrawSource = useCallback(
    async (diagramName: string) => {
      try {
        const url = buildDocumentUrl(`${diagramName}.excalidraw`)
        const res = await authFetch(url, { method: "GET" })
        if (res.ok) {
          const text = await res.text()
          const parsed = JSON.parse(text)
          sceneRef.current = {
            elements: Array.isArray(parsed.elements) ? parsed.elements : [],
            appState: parsed.appState ?? {},
            files: parsed.files ?? {},
          }
          setEditorKey((k) => k + 1)
          return true
        }
      } catch {
        // no-op — will start with empty diagram
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
    setEditingNodeKey(editRequest.nodeKey)
    sceneRef.current = { elements: [], appState: {}, files: {} }
    setEditorKey((k) => k + 1)
    setOpen(true)
    onEditHandled()
    loadExcalidrawSource(diagramName)
  }, [editRequest, onEditHandled, loadExcalidrawSource])

  const handleOpen = useCallback(() => {
    setName("")
    sceneRef.current = { elements: [], appState: {}, files: {} }
    setEditingNodeKey(null)
    setEditorKey((k) => k + 1)
    setOpen(true)
  }, [])

  const handleExit = useCallback(() => {
    setOpen(false)
  }, [])

  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    sceneRef.current = { elements, appState, files }
  }, [])

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setSaving(true)
    try {
      const scene = sceneRef.current
      const svgElement = await exportToSvg({
        elements: scene.elements,
        appState: { ...scene.appState, exportBackground: true, viewBackgroundColor: "#ffffff" },
        files: scene.files,
      })
      let svgContent = new XMLSerializer().serializeToString(svgElement)
      svgContent = svgContent.replace(
        /color-scheme:\s*light\s+dark/g,
        "color-scheme: light",
      )

      // Upload SVG
      const svgFile = new File([svgContent], `${trimmedName}.excalidraw.svg`, {
        type: "image/svg+xml",
      })
      const svgFormData = new FormData()
      svgFormData.append("file", svgFile)
      const svgRes = await authFetch(
        buildUploadUrl(`${trimmedName}.excalidraw.svg`),
        { method: "POST", body: svgFormData },
      )
      if (!svgRes.ok) throw new Error("SVG upload failed")
      await svgRes.json()

      // Upload .excalidraw JSON source
      const jsonContent = serializeAsJSON(scene.elements, scene.appState, scene.files, "local")
      const excalidrawFile = new File([jsonContent], `${trimmedName}.excalidraw`, {
        type: "application/json",
      })
      const excalidrawFormData = new FormData()
      excalidrawFormData.append("file", excalidrawFile)
      await authFetch(buildUploadUrl(`${trimmedName}.excalidraw`), {
        method: "POST",
        body: excalidrawFormData,
      })

      // Use relative path with cache-bust so the browser fetches the fresh SVG
      const relativePath = `assets/${trimmedName}.excalidraw.svg`
      const cacheBustedUrl = relativePath + "?t=" + Date.now()

      // Update existing image node or insert new one
      if (editingNodeKey && editor) {
        editor.update(() => {
          const node = $getNodeByKey(editingNodeKey)
          if (node && $isImageNode(node)) {
            node.setSrc(cacheBustedUrl)
          }
        })
      } else {
        insertImage({ src: cacheBustedUrl, altText: trimmedName })
      }

      setOpen(false)
      // Delay so the Lexical editor can flush the insertImage update
      // before onDiagramSaved reads getMarkdown()
      setTimeout(() => onDiagramSaved?.(), 0)
    } catch {
      // errors are already toasted by authFetch
    } finally {
      setSaving(false)
    }
  }, [
    name,
    buildUploadUrl,
    insertImage,
    editingNodeKey,
    editor,
    onDiagramSaved,
  ])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Excalidraw Diagram"
        onClick={handleOpen}
        className="[&_svg]:size-4 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        <Shapes />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent showCloseButton={false} className="flex h-[100dvh] max-w-none flex-col rounded-none border-0 p-6 sm:max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isEditing ? "Edit Excalidraw Diagram" : "Insert Excalidraw Diagram"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button size="icon-sm" onClick={handleSave} disabled={saving || !name.trim()} title="Save">
                  <Save />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={handleExit} title="Exit">
                  <X />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-1">
            <label htmlFor="excalidraw-name" className="text-sm font-medium">
              Diagram name
            </label>
            <input
              id="excalidraw-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-diagram"
              className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          <div className="min-h-0 flex-1">
            {open && (
              <Excalidraw
                key={editorKey}
                excalidrawAPI={(api) => { excalidrawApiRef.current = api }}
                initialData={() => ({ elements: sceneRef.current.elements, appState: sceneRef.current.appState, files: sceneRef.current.files })}
                onChange={handleChange}
              />
            )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}
