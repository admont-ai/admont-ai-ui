import { useCallback, useEffect, useRef, useState } from "react"
import { PenTool, Save, X } from "lucide-react"
import {
  usePublisher,
  useCellValue,
  activeEditor$,
  insertImage$,
  $isImageNode,
} from "@mdxeditor/editor"
import { $getNodeByKey } from "lexical"
import type { NodeKey } from "lexical"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface DrawioEditRequest {
  nodeKey: NodeKey
  src: string
}

interface DrawioEditorDialogProps {
  repoSlug: string
  filePath: string
  editRequest: DrawioEditRequest | null
  onEditHandled: () => void
  onDiagramSaved?: () => void
}

const DRAWIO_EMBED_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&dark=0&noSaveBtn=1&noExitBtn=1&saveAndExit=0"

/** Extract the diagram name from a .drawio.svg URL */
function extractNameFromSrc(src: string): string | null {
  try {
    const pathname = src.startsWith("http")
      ? new URL(src).pathname
      : src.split("?")[0]
    const filename = pathname.split("/").pop() ?? ""
    if (!filename.toLowerCase().endsWith(".drawio.svg")) return null
    return filename.slice(0, -".drawio.svg".length)
  } catch {
    return null
  }
}

export function DrawioEditorDialog({
  repoSlug,
  filePath,
  editRequest,
  onEditHandled,
  onDiagramSaved,
}: DrawioEditorDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [xml, setXml] = useState("")
  const [svgData, setSvgData] = useState("")

  const [saving, setSaving] = useState(false)
  const [editingNodeKey, setEditingNodeKey] = useState<NodeKey | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const xmlRef = useRef("")

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

  // Keep ref in sync with state for use in message handler
  useEffect(() => {
    xmlRef.current = xml
  }, [xml])

  const requestSvgExport = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "svg", bg: "#ffffff", dark: false, keepTheme: false }),
      "https://embed.diagrams.net",
    )
  }, [])

  // External save: request XML export, then SVG export in the message handler
  const handleExternalSave = useCallback(() => {
    setSaving(true)
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "xml" }),
      "https://embed.diagrams.net",
    )
  }, [])

  const handleExit = useCallback(() => {
    setOpen(false)
  }, [])

  // Handle postMessage from draw.io iframe
  useEffect(() => {
    if (!open) return

    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://embed.diagrams.net") return

      let msg: { event?: string; xml?: string; data?: string; format?: string }
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data
      } catch {
        return
      }

      if (msg.event === "init") {
        // Editor is ready — load existing XML or start empty
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ action: "load", xml: xmlRef.current || "" }),
          "https://embed.diagrams.net",
        )
      } else if (msg.event === "save" && msg.xml) {
        // Ctrl+S inside the iframe
        setXml(msg.xml)
        xmlRef.current = msg.xml
        setSaving(true)
        requestSvgExport()
      } else if (msg.event === "export" && msg.format === "xml") {
        // Response to external save XML export request
        const rawXml = msg.xml ?? msg.data ?? ""
        setXml(rawXml)
        xmlRef.current = rawXml
        requestSvgExport()
      } else if (msg.event === "export" && msg.format === "svg" && msg.data) {
        setSvgData(msg.data)
      } else if (msg.event === "exit") {
        setOpen(false)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [open, requestSvgExport])

  const loadDrawioSource = useCallback(
    async (diagramName: string) => {
      try {
        const url = buildDocumentUrl(`${diagramName}.drawio`)
        const res = await authFetch(url, { method: "GET" })
        if (res.ok) {
          const text = await res.text()
          setXml(text)
          xmlRef.current = text
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
    setXml("")
    xmlRef.current = ""
    setSvgData("")
    setOpen(true)
    onEditHandled()
    loadDrawioSource(diagramName)
  }, [editRequest, onEditHandled, loadDrawioSource])

  const handleOpen = useCallback(() => {
    setName("")
    setXml("")
    xmlRef.current = ""
    setSvgData("")
    setEditingNodeKey(null)
    setOpen(true)
  }, [])

  const handleSave = useCallback(
    async (svg: string) => {
      const trimmedName = name.trim()
      if (!trimmedName || !svg) return
      try {
        // The SVG data from draw.io is a data URI — extract the SVG content
        let svgContent: string
        if (svg.startsWith("data:image/svg+xml;base64,")) {
          svgContent = atob(svg.replace("data:image/svg+xml;base64,", ""))
        } else if (svg.startsWith("data:image/svg+xml;utf8,") || svg.startsWith("data:image/svg+xml,")) {
          svgContent = decodeURIComponent(svg.replace(/data:image\/svg\+xml[^,]*,/, ""))
        } else {
          svgContent = svg
        }

        // Force light color scheme so light-dark() CSS functions resolve to light values
        svgContent = svgContent.replace(
          /color-scheme:\s*light\s+dark/g,
          "color-scheme: light",
        )

        // Upload SVG
        const svgFile = new File([svgContent], `${trimmedName}.drawio.svg`, {
          type: "image/svg+xml",
        })
        const svgFormData = new FormData()
        svgFormData.append("file", svgFile)
        const svgRes = await authFetch(
          buildUploadUrl(`${trimmedName}.drawio.svg`),
          { method: "POST", body: svgFormData },
        )
        if (!svgRes.ok) throw new Error("SVG upload failed")
        await svgRes.json()

        // Upload .drawio XML source
        const drawioFile = new File([xmlRef.current], `${trimmedName}.drawio`, {
          type: "application/xml",
        })
        const drawioFormData = new FormData()
        drawioFormData.append("file", drawioFile)
        await authFetch(buildUploadUrl(`${trimmedName}.drawio`), {
          method: "POST",
          body: drawioFormData,
        })

        // Use relative path with cache-bust so the browser fetches the fresh SVG
        const relativePath = `assets/${trimmedName}.drawio.svg`
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
    },
    [
      name,
      buildUploadUrl,
      insertImage,
      editingNodeKey,
      editor,
      onDiagramSaved,
    ],
  )

  // When svgData is set, trigger the save flow
  useEffect(() => {
    if (!svgData) return
    handleSave(svgData)
    setSvgData("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgData])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Draw.io Diagram"
        onClick={handleOpen}
        className="[&_svg]:size-4 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        <PenTool />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent showCloseButton={false} className="flex h-[100dvh] max-w-none flex-col rounded-none border-0 p-6 sm:max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isEditing ? "Edit Draw.io Diagram" : "Insert Draw.io Diagram"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button size="icon-sm" onClick={handleExternalSave} disabled={saving || !name.trim()} title="Save">
                  <Save />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={handleExit} title="Exit">
                  <X />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-1">
            <label htmlFor="drawio-name" className="text-sm font-medium">
              Diagram name
            </label>
            <input
              id="drawio-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-diagram"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          <div className="min-h-0 flex-1">
            <iframe
              ref={iframeRef}
              src={DRAWIO_EMBED_URL}
              className="h-full w-full border-0"
              title="Draw.io Editor"
            />
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}
