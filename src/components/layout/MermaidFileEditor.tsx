import { type RefObject, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Eye, Code2, Maximize, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react"
import mermaid from "mermaid"
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { DiagramSourceHandle, FileHistoryEntry } from "@/types"
import { detectDiagramType } from "@/components/mermaid-editor/diagram-detector"
import type { VisualDiagramType } from "@/components/mermaid-editor/types"
import { MermaidVisualEditor } from "@/components/mermaid-editor/MermaidVisualEditor"
import { AiEditBox } from "./AiEditBox"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
})

// Zoom buttons overlaid on the diagram viewer (must live inside TransformWrapper).
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  const btn = "flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
      <button className={btn} title="Zoom in" onClick={() => zoomIn()}>
        <ZoomIn className="size-3.5" />
      </button>
      <button className={btn} title="Zoom out" onClick={() => zoomOut()}>
        <ZoomOut className="size-3.5" />
      </button>
      <button className={btn} title="Reset zoom" onClick={() => resetTransform()}>
        <Maximize className="size-3.5" />
      </button>
    </div>
  )
}

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

  const { content, lastModified, isDraft, draftUpdatedAt, refetch, markDraftSaved } = useDocumentContent(repoSlug, filePath)
  const { save, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)

  // Persist a draft and immediately reflect that one exists, so the discard /
  // publish controls appear as soon as the first autosave lands.
  const saveDraft = useCallback(async (code: string) => {
    await save(code)
    markDraftSaved()
  }, [save, markDraftSaved])

  const autosave = useDebouncedAutosave({
    enabled: editing && canEdit,
    save: saveDraft,
    baseline: content ?? "",
  })

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

  // Whether the visual editor was entered on persisted content (its load-time
  // normalization is NOT a draft-worthy change) versus an unsaved diagram such
  // as an AI result (its normalization IS the change and must be saved).
  const visualBaselineCleanRef = useRef(true)

  // Route the visual editor's emissions: load/normalization on clean content is
  // adopted as the baseline (no draft); genuine user edits are autosaved.
  const handleVisualCodeChange = useCallback((c: string, isInitial: boolean) => {
    setCode(c)
    if (isInitial && visualBaselineCleanRef.current) {
      autosave.markClean(c)
    } else {
      autosave.notifyChange(c)
    }
  }, [autosave])

  // Autosave draft when the text editor content changes.
  const handleTextCodeChange = useCallback((c: string) => {
    setCode(c)
    autosave.notifyChange(c)
  }, [autosave])

  // Only react to editSignal increments after mount (see DrawioFileEditor).
  const lastEditSignal = useRef(editSignal)
  useEffect(() => {
    if (editSignal !== lastEditSignal.current && canEdit) setEditing(true)
    lastEditSignal.current = editSignal
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply an AI-produced diagram source to the open editor.
  const applyAiResult = useCallback((source: string) => {
    codeInitializedRef.current = true
    // The AI source is an unsaved change — even if the visual editor remounts
    // and normalizes it, that normalization must be persisted as a draft.
    visualBaselineCleanRef.current = false
    setCode(source)
    autosave.notifyChange(source)
    const detection = detectDiagramType(source)
    setVisualDiagramType(detection.isVisual ? (detection.type as VisualDiagramType) : null)
    setVisualEditorKey((k) => k + 1)
    if (canEdit) setEditing(true)
  }, [canEdit, autosave])

  // Expose the diagram source to the AI assistant side panel (ask context).
  useImperativeHandle(handleRef, () => ({
    getSource: () => (editing ? code : (content ?? "")),
    setSource: applyAiResult,
  }), [editing, code, content, applyAiResult])

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

  const handlePublish = useCallback(async () => {
    if (!code.trim()) return
    // Flush any pending autosave, then persist the current code.
    await autosave.flush()
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
  }, [code, filePath, rawFileName, save, publish, buildUploadUrl, refetch, autosave])

  const handlePublishView = useCallback(async () => {
    await publish()
    refetch()
  }, [publish, refetch])

  const handleCancel = useCallback(async () => {
    // Edits were autosaved as a draft; flush the last ones before exiting.
    await autosave.flush()
    setEditing(false)
    // Reload so the viewer shows the latest saved draft.
    refetch()
  }, [autosave, refetch])

  const handleEdit = useCallback(() => {
    if (content != null) setCode(content)
    // Entering the editor on the persisted file: any normalization the visual
    // editor performs on load is not a user edit.
    visualBaselineCleanRef.current = true
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
        // Switching modes is not an edit: adopt the visual editor's load-time
        // normalization of the current code as the baseline.
        visualBaselineCleanRef.current = true
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
    // Persisted directly here, so it is already the clean baseline.
    save(diffOldContent)
    markDraftSaved()
    autosave.markClean(diffOldContent)
    visualBaselineCleanRef.current = true
    setSelectedCommit(null)
    setDiffOldContent(null)
    setEditing(true)
  }, [selectedCommit, diffOldContent, save, markDraftSaved, autosave])

  const handleCloseDiff = useCallback(() => {
    setSelectedCommit(null)
    setDiffOldContent(null)
    setDiffOldHtml("")
    setDiffCurrentHtml("")
  }, [])

  if (content === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  // Visual/Text mode toggle, styled to match the markdown view toggle
  // (icon-only buttons in the header's right slot).
  const toggleBtn = "flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-100"
  const editorToggle = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        title="Visual"
        aria-label="Visual editor"
        onClick={() => canSwitchToVisual && handleToggleMode()}
        disabled={editorMode === "visual" || !canSwitchToVisual}
        className={`${toggleBtn} ${editorMode === "visual" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground disabled:text-muted-foreground/40"}`}
      >
        <Eye className="size-4" />
      </button>
      <button
        type="button"
        title="Text"
        aria-label="Text editor"
        onClick={handleToggleMode}
        disabled={editorMode === "text"}
        className={`${toggleBtn} ${editorMode === "text" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"}`}
      >
        <Code2 className="size-4" />
      </button>
    </div>
  )

  const mainContent = editing ? (
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={rawFileName}
        filePath={filePath}
        editing
        isDraft={isDraft}
        lastModified={lastModified}
        publishing={publishing}
        saveStatus={autosave.status}
        onPublish={handlePublish}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onCancel={handleCancel}
        rightSlot={editorToggle}
      />
      <div className="relative min-h-0 flex-1 p-4">
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
              onChange={(e) => handleTextCodeChange(e.target.value)}
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
        <AiEditBox
          fileType="mermaid"
          getDiagramSource={() => code}
          onDiagramResult={applyAiResult}
        />
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
        filePath={filePath}
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {previewHtml ? (
          <TransformWrapper minScale={0.2} maxScale={8} wheel={{ step: 0.1 }}>
            <ZoomControls />
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", cursor: "grab" }}
              contentStyle={{ width: "100%", height: "100%" }}
            >
              <div
                className="flex h-full w-full items-center justify-center p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <p className="p-6 text-muted-foreground text-sm">Empty diagram</p>
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
