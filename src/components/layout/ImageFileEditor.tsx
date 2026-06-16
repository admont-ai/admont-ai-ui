import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize, ZoomIn, ZoomOut } from "lucide-react"
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch"

import { authFetch } from "@/lib/auth-fetch"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

// Zoom buttons overlaid on the image viewer (must live inside TransformWrapper).
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  const btn = "flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
      <button className={btn} title="Zoom in" onClick={() => zoomIn(0.2)}>
        <ZoomIn className="size-3.5" />
      </button>
      <button className={btn} title="Zoom out" onClick={() => zoomOut(0.2)}>
        <ZoomOut className="size-3.5" />
      </button>
      <button className={btn} title="Reset zoom" onClick={() => resetTransform()}>
        <Maximize className="size-3.5" />
      </button>
    </div>
  )
}

interface ImageFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit: boolean
  initialEditing?: boolean
  editSignal?: number
  onRename?: () => void
  onDelete?: () => void
}

function isSvg(path: string): boolean {
  return path.toLowerCase().endsWith(".svg")
}

function imageFormat(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase()
  if (ext === "jpg") return "jpeg"
  return ext
}

const LIGHT_THEME: Record<string, string> = {
  "common.bi.image": "",
  "common.bisize.width": "0px",
  "common.bisize.height": "0px",
  "common.backgroundImage": "none",
  "common.backgroundColor": "#f5f5f5",
  "common.border": "1px solid #ddd",

  "header.backgroundImage": "none",
  "header.backgroundColor": "#fff",
  "header.border": "0px",

  "menu.normalIcon.color": "#555",
  "menu.activeIcon.color": "#1a1a1a",
  "menu.disabledIcon.color": "#ccc",
  "menu.hoverIcon.color": "#333",
  "menu.iconSize.width": "24px",
  "menu.iconSize.height": "24px",

  "submenu.backgroundColor": "#f5f5f5",
  "submenu.partition.color": "#ccc",
  "submenu.normalIcon.color": "#555",
  "submenu.activeIcon.color": "#1a1a1a",
  "submenu.iconSize.width": "32px",
  "submenu.iconSize.height": "32px",
  "submenu.normalLabel.color": "#666",
  "submenu.normalLabel.fontWeight": "normal",
  "submenu.activeLabel.color": "#1a1a1a",
  "submenu.activeLabel.fontWeight": "normal",

  "checkbox.border": "1px solid #ccc",
  "checkbox.backgroundColor": "#fff",

  "range.pointer.color": "#337ab7",
  "range.bar.color": "#ccc",
  "range.subbar.color": "#337ab7",
  "range.disabledPointer.color": "#d9d9d9",
  "range.disabledBar.color": "#e8e8e8",
  "range.disabledSubbar.color": "#d9d9d9",
  "range.value.color": "#333",
  "range.value.fontWeight": "normal",
  "range.value.fontSize": "11px",
  "range.value.border": "1px solid #ccc",
  "range.value.backgroundColor": "#fff",
  "range.title.color": "#333",
  "range.title.fontWeight": "normal",

  "colorpicker.button.border": "1px solid #ccc",
  "colorpicker.title.color": "#333",
}

export function ImageFileEditor({ repoSlug, filePath, canEdit, initialEditing, editSignal, onRename, onDelete }: ImageFileEditorProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(!!initialEditing)
  const [, setSaving] = useState(false)

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<InstanceType<typeof import("tui-image-editor").default> | null>(null)

  const rawFileName = filePath.split("/").pop() ?? ""
  const svg = isSvg(filePath)

  const fileUrl = `/repos/${encodeURIComponent(repoSlug)}/file/${filePath}`
  const uploadUrl = `/repos/${encodeURIComponent(repoSlug)}/upload/${filePath}`

  // Fetch the image as a blob URL
  const fetchImage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(fileUrl)
      if (!res.ok) { setLoading(false); return }
      const blob = await res.blob()
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [fileUrl])

  useEffect(() => {
    fetchImage()
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [fetchImage])

  // Only react to editSignal increments after mount (see DrawioFileEditor).
  const lastEditSignal = useRef(editSignal)
  useEffect(() => {
    if (editSignal !== lastEditSignal.current && canEdit && !isSvg(filePath)) setEditing(true)
    lastEditSignal.current = editSignal
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise/destroy TUI Image Editor when entering/leaving edit mode
  useEffect(() => {
    if (!editing || !blobUrl || !editorContainerRef.current) return

    let destroyed = false
    let editor: InstanceType<typeof import("tui-image-editor").default> | null = null

    ;(async () => {
      const { default: ImageEditor } = await import("tui-image-editor")
      if (destroyed || !editorContainerRef.current) return

      editor = new ImageEditor(editorContainerRef.current, {
        includeUI: {
          loadImage: {
            path: blobUrl,
            name: rawFileName,
          },
          theme: LIGHT_THEME,
          menuBarPosition: "bottom",
        },
        cssMaxWidth: editorContainerRef.current.clientWidth,
        cssMaxHeight: editorContainerRef.current.clientHeight,
        usageStatistics: false,
      })

      editorInstanceRef.current = editor
    })()

    return () => {
      destroyed = true
      if (editor) {
        editor.destroy()
      }
      editorInstanceRef.current = null
    }
  }, [editing, blobUrl, rawFileName])

  const handleSave = useCallback(async () => {
    const editor = editorInstanceRef.current
    if (!editor) return

    setSaving(true)
    try {
      const format = imageFormat(filePath)
      const dataUrl = editor.toDataURL({ format, quality: 0.92 })
      const blob = await fetch(dataUrl).then((r) => r.blob())
      const file = new File([blob], rawFileName, { type: `image/${format}` })
      const form = new FormData()
      form.append("file", file)
      await authFetch(uploadUrl, { method: "POST", body: form })
      // Re-fetch the updated image and exit edit mode
      await fetchImage()
      setEditing(false)
    } catch {
      // errors handled by authFetch
    } finally {
      setSaving(false)
    }
  }, [filePath, rawFileName, uploadUrl, fetchImage])

  const handleCancel = useCallback(() => {
    setEditing(false)
  }, [])

  const [historyOpen, setHistoryOpen] = useState(false)

  if (loading && !blobUrl) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  const mainContent = editing ? (
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={rawFileName}
        filePath={filePath}
        editing
        canEdit={canEdit}
        onSave={handleSave}
        onCancel={handleCancel}
      />
      <div ref={editorContainerRef} className="min-h-0 flex-1" />
    </div>
  ) : (
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={rawFileName}
        filePath={filePath}
        canEdit={canEdit && !svg}
        onEdit={canEdit && !svg ? () => setEditing(true) : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {blobUrl && (
          <TransformWrapper minScale={0.2} maxScale={8} wheel={{ step: 0.04 }} centerOnInit>
            <ZoomControls />
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", cursor: "grab" }}
              contentStyle={{ width: "100%", height: "100%" }}
            >
              <div className="flex h-full w-full items-center justify-center p-6">
                <img
                  src={blobUrl}
                  alt={rawFileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
      <div className="flex-1 min-w-0 bg-editor">
        {mainContent}
      </div>
      {historyOpen && (
        <>
          <div className="w-px bg-border" />
          <div className="w-72 shrink-0">
            <FileHistoryPanel
              repoSlug={repoSlug}
              filePath={filePath}
              selectedCommit={null}
              onSelectCommit={() => {}}
              onClose={() => setHistoryOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
