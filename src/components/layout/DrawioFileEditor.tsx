import { useCallback, useEffect, useRef, useState } from "react"
import { RotateCcw, X } from "lucide-react"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { FileHistoryEntry } from "@/types"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

const DRAWIO_EMBED_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&dark=0&noSaveBtn=1&noExitBtn=1&saveAndExit=0"

interface DrawioFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit?: boolean
  initialEditing?: boolean
  editSignal?: number
  onRename?: () => void
  onDelete?: () => void
}

export function DrawioFileEditor({ repoSlug, filePath, canEdit = true, initialEditing, editSignal, onRename, onDelete }: DrawioFileEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const xmlRef = useRef("")
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [editing, setEditing] = useState(!!initialEditing)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldSvg, setDiffOldSvg] = useState<string | null>(null)

  const rawFileName = filePath.split("/").pop() ?? ""

  const { content, lastModified, isDraft, draftUpdatedAt, refetch } = useDocumentContent(repoSlug, filePath)
  const { save, saving, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)

  // Keep xmlRef in sync with loaded content
  useEffect(() => {
    if (content !== null && !editing) {
      xmlRef.current = content
    }
  }, [content, editing])

  useEffect(() => {
    if (editSignal && canEdit) setEditing(true)
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildUploadUrl = useCallback(
    (path: string) => `/repos/${encodeURIComponent(repoSlug)}/upload/${path}`,
    [repoSlug],
  )

  const requestSvgExport = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        action: "export",
        format: "svg",
        bg: "#ffffff",
        dark: false,
        keepTheme: false,
      }),
      "https://embed.diagrams.net",
    )
  }, [])

  // Upload SVG companion file + publish draft
  const uploadSvgAndPublish = useCallback(
    async (svgDataUri: string) => {
      try {
        let svgContent: string
        if (svgDataUri.startsWith("data:image/svg+xml;base64,")) {
          svgContent = atob(svgDataUri.replace("data:image/svg+xml;base64,", ""))
        } else if (
          svgDataUri.startsWith("data:image/svg+xml;utf8,") ||
          svgDataUri.startsWith("data:image/svg+xml,")
        ) {
          svgContent = decodeURIComponent(
            svgDataUri.replace(/data:image\/svg\+xml[^,]*,/, ""),
          )
        } else {
          svgContent = svgDataUri
        }
        svgContent = svgContent.replace(
          /color-scheme:\s*light\s+dark/g,
          "color-scheme: light",
        )

        // Upload SVG companion
        const svgFile = new File([svgContent], rawFileName + ".svg", { type: "image/svg+xml" })
        const svgForm = new FormData()
        svgForm.append("file", svgFile)
        await authFetch(buildUploadUrl(filePath + ".svg"), { method: "POST", body: svgForm })

        // Publish the draft
        await publish()
        setEditing(false)
        refetch()
      } catch {
        // errors handled by authFetch
      }
    },
    [filePath, rawFileName, buildUploadUrl, publish, refetch],
  )

  // Ref to hold the publish callback for the message handler
  const uploadSvgAndPublishRef = useRef(uploadSvgAndPublish)
  uploadSvgAndPublishRef.current = uploadSvgAndPublish

  const [, setPendingPublish] = useState(false)

  const handleSave = useCallback(async () => {
    // Request XML export from iframe, then save as draft
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "xml" }),
      "https://embed.diagrams.net",
    )
  }, [])

  const handlePublish = useCallback(async () => {
    // Request XML export, then SVG export, then publish
    setPendingPublish(true)
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "xml" }),
      "https://embed.diagrams.net",
    )
  }, [])

  const handleCancel = useCallback(() => {
    setEditing(false)
  }, [])

  const handleEdit = useCallback(() => {
    if (content != null) xmlRef.current = content
    setEditing(true)
  }, [content])

  const handleDiscardDraft = useCallback(async () => {
    await deleteDraft()
    setEditing(false)
    refetch()
  }, [deleteDraft, refetch])

  const handlePublishView = useCallback(async () => {
    // In view mode with a draft, publish directly (SVG was already generated on last save)
    await publish()
    refetch()
  }, [publish, refetch])

  // Handle postMessage from draw.io iframe
  useEffect(() => {
    if (!editing || !iframeLoaded) return

    const pendingPublishRef = { current: false }

    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://embed.diagrams.net") return
      let msg: { event?: string; xml?: string; data?: string; format?: string }
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data
      } catch {
        return
      }

      if (msg.event === "init") {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ action: "load", xml: xmlRef.current || "" }),
          "https://embed.diagrams.net",
        )
      } else if (msg.event === "save" && msg.xml) {
        // Ctrl+S inside the iframe
        xmlRef.current = msg.xml
        save(msg.xml)
      } else if (msg.event === "export" && msg.format === "xml") {
        xmlRef.current = msg.xml ?? msg.data ?? ""
        save(xmlRef.current)
        // If publishing, continue to SVG export
        setPendingPublish((prev) => {
          if (prev) {
            pendingPublishRef.current = true
            requestSvgExport()
            return false
          }
          return prev
        })
        if (pendingPublishRef.current) return
      } else if (msg.event === "export" && msg.format === "svg" && msg.data) {
        uploadSvgAndPublishRef.current(msg.data)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [editing, iframeLoaded, save, requestSvgExport])

  // SVG preview URL for view mode
  const svgUrl = `/repos/${encodeURIComponent(repoSlug)}/file/${filePath}.svg`
  const [svgBlobUrl, setSvgBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (editing) return
    authFetch(svgUrl)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        setSvgBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return blob ? URL.createObjectURL(blob) : null
        })
      })
      .catch(() => setSvgBlobUrl(null))
    return () => {
      setSvgBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [svgUrl, editing, content])

  const handleSelectCommit = useCallback(
    (entry: FileHistoryEntry) => {
      setSelectedCommit(entry)
      setDiffOldSvg(null)
      // Fetch the old SVG for visual comparison
      fetchFileAtCommit(repoSlug, filePath + ".svg", entry.commit_hash)
        .then((svg) => setDiffOldSvg(svg))
        .catch(() => setDiffOldSvg(null))
    },
    [repoSlug, filePath],
  )

  const handleRestore = useCallback(() => {
    if (!selectedCommit) return
    fetchFileAtCommit(repoSlug, filePath, selectedCommit.commit_hash)
      .then((oldContent) => {
        xmlRef.current = oldContent
        save(oldContent)
        setSelectedCommit(null)
        setDiffOldSvg(null)
        setEditing(true)
      })
      .catch(() => {})
  }, [repoSlug, filePath, selectedCommit, save])

  const handleCloseDiff = useCallback(() => {
    setSelectedCommit(null)
    setDiffOldSvg(null)
  }, [])

  if (content === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  const mainContent = editing ? (
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={rawFileName}
        editing
        isDraft={isDraft}
        lastModified={lastModified}
        saving={saving}
        publishing={publishing}
        onSave={handleSave}
        onPublish={handlePublish}
        onCancel={handleCancel}
      />
      <div className="min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          src={DRAWIO_EMBED_URL}
          className="h-full w-full border-0"
          title="Draw.io Editor"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>
    </div>
  ) : diffOldSvg != null ? (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 pb-3">
        <div className="truncate">
          <h2 className="text-lg font-semibold truncate">
            {rawFileName} — History {selectedCommit && new Date(selectedCommit.date).toLocaleString()}
          </h2>
          {selectedCommit && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {selectedCommit.message} · {selectedCommit.author} · {selectedCommit.commit_hash.slice(0, 7)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && selectedCommit && (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw />
              Restore
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCloseDiff}>
            <X />
            Close
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 px-4 pb-4">
        <div className="grid h-full grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 self-start">Old version</h3>
            <div className="flex-1 flex items-center" dangerouslySetInnerHTML={{ __html: diffOldSvg }} />
          </div>
          <div className="flex flex-col items-center justify-center overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 self-start">Current version</h3>
            {svgBlobUrl && <img src={svgBlobUrl} alt={rawFileName} className="max-h-full max-w-full object-contain" />}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={rawFileName}
        isDraft={isDraft}
        lastModified={lastModified}
        draftUpdatedAt={draftUpdatedAt}
        canEdit={canEdit}
        onEdit={canEdit ? handleEdit : undefined}
        onPublish={canEdit && isDraft ? handlePublishView : undefined}
        onDiscardDraft={canEdit && isDraft ? handleDiscardDraft : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="flex flex-1 items-center justify-center p-6">
        {svgBlobUrl ? (
          <img src={svgBlobUrl} alt={rawFileName} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-muted-foreground text-sm">No preview available</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
      <div className="flex-1 min-w-0">
        {mainContent}
      </div>
      {historyOpen && (
        <>
          <div className="w-px bg-border" />
          <div className="w-72 shrink-0">
            <FileHistoryPanel
              repoSlug={repoSlug}
              filePath={filePath}
              selectedCommit={selectedCommit?.commit_hash ?? null}
              onSelectCommit={handleSelectCommit}
              onClose={() => {
                setHistoryOpen(false)
                setSelectedCommit(null)
                setDiffOldSvg(null)
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
