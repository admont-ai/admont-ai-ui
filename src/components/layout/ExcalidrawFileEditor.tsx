import { type RefObject, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { Excalidraw, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { DiagramSourceHandle, FileHistoryEntry } from "@/types"
import { AiEditBox } from "./AiEditBox"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

interface ExcalidrawFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit?: boolean
  initialEditing?: boolean
  editSignal?: number
  handleRef?: RefObject<DiagramSourceHandle | null>
  onRename?: () => void
  onDelete?: () => void
}

interface Scene {
  elements: readonly OrderedExcalidrawElement[]
  appState: Partial<AppState>
  files: BinaryFiles
}

const EMPTY_SCENE: Scene = { elements: [], appState: {}, files: {} }

/** Strict parse: returns null (rather than falling back to empty) so callers
 * can distinguish "genuinely empty" from "malformed" — used for untrusted
 * AI-produced content, where silently wiping the canvas would be worse than
 * rejecting it. */
function parseScene(json: string): Scene | null {
  if (!json.trim()) return EMPTY_SCENE
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed.elements)) return null
    return {
      elements: parsed.elements,
      appState: parsed.appState ?? {},
      files: parsed.files ?? {},
    }
  } catch {
    return null
  }
}

/** Lenient parse for persisted content — malformed/empty content just starts
 * with a blank canvas rather than surfacing an error. */
function parseSceneOrEmpty(json: string | null): Scene {
  if (json == null) return EMPTY_SCENE
  return parseScene(json) ?? EMPTY_SCENE
}

/** updateScene's appState param is generically typed per-key (Pick<AppState, K>);
 * our persisted/AI-provided appState is a plain loose object, so cast it here
 * once rather than at every call site. */
function pushScene(api: ExcalidrawImperativeAPI | null, scene: Scene) {
  api?.updateScene({ elements: scene.elements, appState: scene.appState as AppState })
}

export function ExcalidrawFileEditor({ repoSlug, filePath, canEdit = true, initialEditing, editSignal, handleRef, onRename, onDelete }: ExcalidrawFileEditorProps) {
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const sceneRef = useRef<Scene>(EMPTY_SCENE)
  const [editing, setEditing] = useState(!!initialEditing)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldSvg, setDiffOldSvg] = useState<string | null>(null)

  const rawFileName = filePath.split("/").pop() ?? ""

  const { content, lastModified, isDraft, draftUpdatedAt, refetch, markDraftSaved, pendingDraftOwnerName, pendingDraftOwnerEmail, pendingDraftUpdatedAt } = useDocumentContent(repoSlug, filePath)
  const { save, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)

  const serializeScene = useCallback((scene: Scene) => serializeAsJSON(scene.elements, scene.appState, scene.files, "local"), [])

  // Persist a draft and immediately reflect that one exists, so the discard /
  // publish controls appear as soon as the first autosave lands.
  const saveDraft = useCallback(async (json: string) => {
    await save(json)
    markDraftSaved()
  }, [save, markDraftSaved])

  const autosave = useDebouncedAutosave({
    enabled: editing && canEdit,
    save: saveDraft,
    baseline: content ?? "",
  })

  // Keep sceneRef in sync with loaded content (mirrors DrawioFileEditor's
  // xmlRef sync), and push it into the live view-mode instance when content
  // changes while not editing (e.g. after a view-mode publish).
  useEffect(() => {
    if (content === null) return
    if (!editing || sceneRef.current.elements.length === 0) {
      sceneRef.current = parseSceneOrEmpty(content)
    }
    if (!editing) {
      pushScene(excalidrawApiRef.current, sceneRef.current)
    }
  }, [content, editing])

  // editSignal is a monotonically increasing counter owned by AppLayout; a
  // freshly mounted editor must only react to increments after mount, not to
  // the value left over from a double-click on a previous file.
  const lastEditSignal = useRef(editSignal)
  useEffect(() => {
    if (editSignal !== lastEditSignal.current && canEdit) setEditing(true)
    lastEditSignal.current = editSignal
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply an AI-produced diagram source: push it into the open canvas, or
  // switch to edit mode (whose mount reads sceneRef fresh) so the user can
  // review and save/publish.
  const applyAiResult = useCallback((source: string) => {
    const scene = parseScene(source)
    if (!scene) {
      toast.error("The AI returned invalid diagram data.")
      return
    }
    sceneRef.current = scene
    if (editing) {
      pushScene(excalidrawApiRef.current, scene)
    } else if (canEdit) {
      setEditing(true)
    }
  }, [editing, canEdit])

  // Expose the diagram source to the AI assistant side panel (ask context).
  useImperativeHandle(handleRef, () => ({
    getSource: () => serializeScene(sceneRef.current),
    setSource: applyAiResult,
  }), [serializeScene, applyAiResult])

  const buildUploadUrl = useCallback(
    (path: string) => `/repos/${encodeURIComponent(repoSlug)}/upload/${path}`,
    [repoSlug],
  )

  // Export SVG companion + publish
  const uploadSvgAndPublish = useCallback(async () => {
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

      const svgFile = new File([svgContent], rawFileName + ".svg", { type: "image/svg+xml" })
      const svgForm = new FormData()
      svgForm.append("file", svgFile)
      await authFetch(buildUploadUrl(filePath + ".svg"), { method: "POST", body: svgForm })

      await publish()
      setEditing(false)
      refetch()
    } catch {
      // errors handled by authFetch
    }
  }, [filePath, rawFileName, buildUploadUrl, publish, refetch])

  const handlePublish = useCallback(async () => {
    await saveDraft(serializeScene(sceneRef.current))
    await uploadSvgAndPublish()
  }, [saveDraft, serializeScene, uploadSvgAndPublish])

  const handleCancel = useCallback(() => {
    setEditing(false)
    // Pick up any draft saved during the editing session so the view shows
    // the latest state instead of the stale pre-edit content.
    refetch()
  }, [refetch])

  const handleEdit = useCallback(() => {
    setEditing(true)
  }, [])

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

  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    sceneRef.current = { elements, appState, files }
    if (editing) {
      autosave.notifyChange(serializeScene(sceneRef.current))
    }
  }, [editing, autosave, serializeScene])

  // SVG companion (generated on publish, used for markdown embeds) — only
  // fetched for the history diff view.
  const svgUrl = `/repos/${encodeURIComponent(repoSlug)}/file/${filePath}.svg`
  const [svgBlobUrl, setSvgBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (editing || !selectedCommit) return
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
  }, [svgUrl, editing, content, selectedCommit])

  const handleSelectCommit = useCallback(
    (entry: FileHistoryEntry) => {
      setSelectedCommit(entry)
      setDiffOldSvg(null)
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
        const scene = parseSceneOrEmpty(oldContent)
        sceneRef.current = scene
        pushScene(excalidrawApiRef.current, scene)
        void saveDraft(oldContent)
        setSelectedCommit(null)
        setDiffOldSvg(null)
        setEditing(true)
      })
      .catch(() => {})
  }, [repoSlug, filePath, selectedCommit, saveDraft])

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
        filePath={filePath}
        editing
        isDraft={isDraft}
        lastModified={lastModified}
        pendingDraftOwnerName={pendingDraftOwnerName}
        pendingDraftOwnerEmail={pendingDraftOwnerEmail}
        pendingDraftUpdatedAt={pendingDraftUpdatedAt}
        publishing={publishing}
        saveStatus={autosave.status}
        onPublish={handlePublish}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onCancel={handleCancel}
      />
      <div className="relative min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawApiRef.current = api }}
          initialData={() => ({ elements: sceneRef.current.elements, appState: sceneRef.current.appState, files: sceneRef.current.files })}
          onChange={handleChange}
        />
        <AiEditBox
          fileType="excalidraw"
          getDiagramSource={() => serializeScene(sceneRef.current)}
          onDiagramResult={applyAiResult}
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
        filePath={filePath}
        isDraft={isDraft}
        lastModified={lastModified}
        draftUpdatedAt={draftUpdatedAt}
        pendingDraftOwnerName={pendingDraftOwnerName}
        pendingDraftOwnerEmail={pendingDraftOwnerEmail}
        pendingDraftUpdatedAt={pendingDraftUpdatedAt}
        canEdit={canEdit}
        onEdit={canEdit ? handleEdit : undefined}
        onPublish={canEdit && isDraft ? handlePublishView : undefined}
        onDiscardDraft={canEdit && isDraft ? handleDiscardDraft : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawApiRef.current = api }}
          initialData={() => ({ elements: sceneRef.current.elements, appState: sceneRef.current.appState, files: sceneRef.current.files })}
          viewModeEnabled
        />
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
                setDiffOldSvg(null)
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
