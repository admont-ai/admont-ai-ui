import { type RefObject, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Eye, Code2, RotateCcw, X } from "lucide-react"
import mermaid from "mermaid"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { DiagramSourceHandle, FileHistoryEntry } from "@/types"
import { detectDiagramType } from "@/components/mermaid-editor/diagram-detector"
import type { VisualDiagramType } from "@/components/mermaid-editor/types"
import { MermaidVisualEditor } from "@/components/mermaid-editor/MermaidVisualEditor"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
})

interface MermaidFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit?: boolean
  initialEditing?: boolean
  editSignal?: number
  handleRef?: RefObject<DiagramSourceHandle | null>
  onRename?: () => void
  onDelete?: () => void
}

export function MermaidFileEditor({ repoSlug, filePath, canEdit = true, initialEditing, editSignal, handleRef, onRename, onDelete }: MermaidFileEditorProps) {
  const [code, setCode] = useState("")
  const [editing, setEditing] = useState(!!initialEditing)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewError, setPreviewError] = useState("")
  const [editorMode, setEditorMode] = useState<"visual" | "text">("text")
  const [visualDiagramType, setVisualDiagramType] = useState<VisualDiagramType | null>(null)
  const [visualEditorKey, setVisualEditorKey] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldContent, setDiffOldContent] = useState<string | null>(null)
  const [diffOldHtml, setDiffOldHtml] = useState("")
  const [diffCurrentHtml, setDiffCurrentHtml] = useState("")

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const renderIdRef = useRef(0)
  const rawFileName = filePath.split("/").pop() ?? ""

  const { content, lastModified, isDraft, draftUpdatedAt, refetch } = useDocumentContent(repoSlug, filePath)
  const { save, saving, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)

  // Initialize code from content. The first load also syncs in edit mode —
  // a freshly created file mounts directly in edit mode and would otherwise
  // show an empty editor until a reload.
  const codeInitializedRef = useRef(false)
  useEffect(() => {
    if (content === null) return
    if (!editing || !codeInitializedRef.current) {
      codeInitializedRef.current = true
      setCode(content)
      const detection = detectDiagramType(content)
      if (detection.isVisual) {
        setVisualDiagramType(detection.type as VisualDiagramType)
      } else {
        setVisualDiagramType(null)
      }
    }
  }, [content, editing])

  // Only react to editSignal increments after mount (see DrawioFileEditor).
  const lastEditSignal = useRef(editSignal)
  useEffect(() => {
    if (editSignal !== lastEditSignal.current && canEdit) setEditing(true)
    lastEditSignal.current = editSignal
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose the diagram source to the AI assistant.
  useImperativeHandle(handleRef, () => ({
    getSource: () => (editing ? code : (content ?? "")),
    setSource: (source: string) => {
      codeInitializedRef.current = true
      setCode(source)
      const detection = detectDiagramType(source)
      setVisualDiagramType(detection.isVisual ? (detection.type as VisualDiagramType) : null)
      setVisualEditorKey((k) => k + 1)
      if (canEdit) setEditing(true)
    },
  }), [editing, code, content, canEdit])

  const buildUploadUrl = useCallback(
    (path: string) => `/repos/${encodeURIComponent(repoSlug)}/upload/${path}`,
    [repoSlug],
  )

  const renderPreview = useCallback(async (source: string) => {
    renderIdRef.current += 1
    const thisId = renderIdRef.current
    try {
      const { svg } = await mermaid.render(`mermaid-file-preview-${thisId}`, source)
      setPreviewHtml(svg)
      setPreviewError("")
    } catch {
      setPreviewError("Invalid mermaid syntax")
      document.getElementById(`dmermaid-file-preview-${thisId}`)?.remove()
    }
  }, [])

  // Preview in both view mode and text edit mode
  useEffect(() => {
    if (!code.trim()) return
    if (editing && editorMode !== "text") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => renderPreview(code), editing ? 500 : 100)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [code, editing, renderPreview, editorMode])

  const handleSave = useCallback(async () => {
    await save(code)
  }, [save, code])

  const handlePublish = useCallback(async () => {
    if (!code.trim()) return
    // Save draft first
    await save(code)
    // Render final SVG
    renderIdRef.current += 1
    const { svg: svgString } = await mermaid.render(
      `mermaid-file-final-${renderIdRef.current}`,
      code,
    )
    // Upload SVG companion
    const svgPath = filePath.replace(/\.mmd$/i, ".svg")
    const svgFileName = rawFileName.replace(/\.mmd$/i, ".svg")
    const svgFile = new File([svgString], svgFileName, { type: "image/svg+xml" })
    const svgForm = new FormData()
    svgForm.append("file", svgFile)
    await authFetch(buildUploadUrl(svgPath), { method: "POST", body: svgForm })
    // Publish
    await publish()
    setEditing(false)
    refetch()
  }, [code, filePath, rawFileName, save, publish, buildUploadUrl, refetch])

  const handlePublishView = useCallback(async () => {
    await publish()
    refetch()
  }, [publish, refetch])

  const handleCancel = useCallback(() => {
    setEditing(false)
    if (content !== null) setCode(content)
  }, [content])

  const handleEdit = useCallback(() => {
    if (content != null) setCode(content)
    const detection = detectDiagramType(content ?? "")
    if (detection.isVisual) {
      setVisualDiagramType(detection.type as VisualDiagramType)
      setEditorMode("visual")
      setVisualEditorKey((k) => k + 1)
    } else {
      setEditorMode("text")
    }
    setEditing(true)
  }, [content])

  const handleDiscardDraft = useCallback(async () => {
    await deleteDraft()
    setEditing(false)
    refetch()
  }, [deleteDraft, refetch])

  const handleToggleMode = useCallback(() => {
    if (editorMode === "visual") {
      setEditorMode("text")
    } else {
      const detection = detectDiagramType(code)
      if (detection.isVisual) {
        setVisualDiagramType(detection.type as VisualDiagramType)
        setEditorMode("visual")
        setVisualEditorKey((k) => k + 1)
      }
    }
  }, [editorMode, code])

  const canSwitchToVisual =
    visualDiagramType !== null || detectDiagramType(code).isVisual

  const handleSelectCommit = useCallback(
    (entry: FileHistoryEntry) => {
      setSelectedCommit(entry)
      setDiffOldContent(null)
      setDiffOldHtml("")
      setDiffCurrentHtml("")
      fetchFileAtCommit(repoSlug, filePath, entry.commit_hash)
        .then(async (oldContent) => {
          setDiffOldContent(oldContent)
          renderIdRef.current += 1
          try {
            const { svg: oldSvg } = await mermaid.render(`mermaid-diff-old-${renderIdRef.current}`, oldContent)
            setDiffOldHtml(oldSvg)
          } catch { /* ignore */ }
          renderIdRef.current += 1
          try {
            const { svg: curSvg } = await mermaid.render(`mermaid-diff-cur-${renderIdRef.current}`, content ?? "")
            setDiffCurrentHtml(curSvg)
          } catch { /* ignore */ }
        })
        .catch(() => setDiffOldContent(null))
    },
    [repoSlug, filePath, content],
  )

  const handleRestore = useCallback(() => {
    if (!selectedCommit || !diffOldContent) return
    setCode(diffOldContent)
    save(diffOldContent)
    setSelectedCommit(null)
    setDiffOldContent(null)
    setEditing(true)
  }, [selectedCommit, diffOldContent, save])

  const handleCloseDiff = useCallback(() => {
    setSelectedCommit(null)
    setDiffOldContent(null)
    setDiffOldHtml("")
    setDiffCurrentHtml("")
  }, [])

  if (content === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  const editorToggle = (
    <div className="flex items-center gap-1">
      <Button
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
  )

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
      >
        {editorToggle}
      </EditorHeader>
      <div className="min-h-0 flex-1 p-4">
        {editorMode === "visual" && visualDiagramType ? (
          <MermaidVisualEditor
            key={visualEditorKey}
            initialCode={code}
            diagramType={visualDiagramType}
            onCodeChange={setCode}
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
                <p className="text-muted-foreground text-sm">Preview will appear here...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : diffOldContent != null ? (
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
          <div className="flex flex-col overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Old version</h3>
            {diffOldHtml ? (
              <div className="flex flex-1 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: diffOldHtml }} />
            ) : (
              <p className="text-muted-foreground text-sm">Rendering…</p>
            )}
          </div>
          <div className="flex flex-col overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Current version</h3>
            {diffCurrentHtml ? (
              <div className="flex flex-1 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: diffCurrentHtml }} />
            ) : (
              <p className="text-muted-foreground text-sm">Rendering…</p>
            )}
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
        {previewHtml ? (
          <div
            className="[&_svg]:max-h-full [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">Empty diagram</p>
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
                setDiffOldContent(null)
                setDiffOldHtml("")
                setDiffCurrentHtml("")
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
