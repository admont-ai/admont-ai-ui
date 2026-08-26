import { RotateCcw, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePanelRef } from "react-resizable-panels"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocuments } from "@/hooks/use-documents"
import { usePdfExport } from "@/hooks/use-pdf-export"
import { hasPermission } from "@/hooks/use-file-permission"
import { useDocumentMutations } from "@/hooks/use-document-mutations"
import { useDocumentSave } from "@/hooks/use-document-save"
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave"
import { useRepos } from "@/hooks/use-repos"
import { useAuth } from "@/contexts/auth-context"
import { useAiLog } from "@/hooks/use-ai-log"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { DiagramSourceHandle, FileHistoryEntry } from "@/types"
import { ImageFileEditor } from "./ImageFileEditor"
import { LoginPanel } from "@/components/auth/LoginPanel"
import { AiAssistantPanel } from "./AiAssistantPanel"
import { AiEditBox } from "./AiEditBox"
import { SpreadsheetViewer } from "./SpreadsheetViewer"
import { ConfluenceImportDialog } from "./ConfluenceImportDialog"
import { DrawioFileEditor } from "./DrawioFileEditor"
import { LaTeXFileEditor } from "./LaTeXFileEditor"
import { AdminPanel } from "./AdminDialog"
import { Header } from "./Header"
import { MarkdownEditor, ViewModeToggle, type MarkdownEditorHandle, type MarkdownViewState } from "./MarkdownEditor"
import { EditorHeader } from "./EditorHeader"
import { MermaidFileEditor } from "./MermaidFileEditor"
import { ExcalidrawFileEditor } from "./ExcalidrawFileEditor"
import { TextFileEditor } from "./TextFileEditor"
import { VideoFilePlayer } from "./VideoFilePlayer"
import { Sidebar } from "./Sidebar"
import { ExportPdfDialog } from "./ExportPdfDialog"
import { FileHistoryPanel } from "./FileHistoryPanel"

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"])
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv"])

function isImageFile(path: string): boolean {
  const dot = path.lastIndexOf(".")
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase())
}

function isDrawioFile(path: string): boolean {
  return path.toLowerCase().endsWith(".drawio")
}

function isSpreadsheetFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith(".xlsx") || lower.endsWith(".csv")
}

function isMermaidFile(path: string): boolean {
  return path.toLowerCase().endsWith(".mmd")
}

function isExcalidrawFile(path: string): boolean {
  return path.toLowerCase().endsWith(".excalidraw")
}

function isLatexFile(path: string): boolean {
  return path.toLowerCase().endsWith(".tex")
}

function isMarkdownFile(path: string): boolean {
  return path.toLowerCase().endsWith(".md")
}

function isVideoFile(path: string): boolean {
  const dot = path.lastIndexOf(".")
  if (dot < 0) return false
  return VIDEO_EXTENSIONS.has(path.slice(dot).toLowerCase())
}

/** Parse /{repo}/{filePath...} from the current URL, ignoring reserved paths */
function parseLocationPath(): { repo: string; file: string } {
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+/, "")
  if (!path || path.startsWith("auth/")) return { repo: "", file: "" }
  const slashIdx = path.indexOf("/")
  if (slashIdx < 0) return { repo: path, file: "" }
  return { repo: path.substring(0, slashIdx), file: path.substring(slashIdx + 1) }
}

export function AppLayout() {
  const sidebarRef = usePanelRef()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const diagramRef = useRef<DiagramSourceHandle>(null)
  // Rich-text/source toggle controls surfaced by the active markdown editor,
  // rendered in the editor header.
  const [mdViewState, setMdViewState] = useState<MarkdownViewState | null>(null)
  const { user, permissions, isAuthenticated } = useAuth()
  const { repos, loading: reposLoading, refresh: refreshRepos } = useRepos(isAuthenticated)

  // Initialise from URL deep link
  const initialPath = useRef(parseLocationPath())
  const [selectedRepoSlug, setSelectedRepoSlug] = useState(initialPath.current.repo)
  const [selectedFilePath, setSelectedFilePath] = useState(initialPath.current.file)

  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldMarkdown, setDiffOldMarkdown] = useState<string | null>(null)
  const [restoredMarkdown, setRestoredMarkdown] = useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [adminOpen, setAdminOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiSelectedText, setAiSelectedText] = useState("")
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | null>(null)
  const { aiAvailable } = useAiLog()

  // PDF export
  const { exportCurrentDocument, exportFolder, progress: pdfProgress } = usePdfExport(selectedRepoSlug)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfFolderName, setPdfFolderName] = useState("")
  const pdfCancelRef = useRef<AbortController | null>(null)
  const { tree: docTree } = useDocuments(selectedRepoSlug)

  // When true the next URL sync will pushState instead of replaceState
  const pushNextRef = useRef(false)
  // Guard to skip state updates triggered by popstate itself
  const isPopstateRef = useRef(false)

  // Auto-select first repo on initial load (only if URL didn't specify one)
  useEffect(() => {
    if (!selectedRepoSlug && repos.length > 0) {
      setSelectedRepoSlug(repos[0].slug)
    }
  }, [repos, selectedRepoSlug])

  // Sync URL bar with current selection
  useEffect(() => {
    if (isPopstateRef.current) {
      isPopstateRef.current = false
      return
    }
    const urlPath = selectedRepoSlug
      ? selectedFilePath
        ? `/${encodeURIComponent(selectedRepoSlug)}/${selectedFilePath}`
        : `/${encodeURIComponent(selectedRepoSlug)}`
      : "/"
    if (decodeURIComponent(window.location.pathname) !== decodeURIComponent(urlPath)) {
      if (pushNextRef.current) {
        window.history.pushState(null, "", urlPath)
      } else {
        window.history.replaceState(null, "", urlPath)
      }
    }
    pushNextRef.current = false
  }, [selectedRepoSlug, selectedFilePath])

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const { repo, file } = parseLocationPath()
      isPopstateRef.current = true
      setSelectedRepoSlug(repo)
      setSelectedFilePath(file)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const {
    content,
    lastModified,
    isDraft,
    draftUpdatedAt,
    permission: filePermission,
    fileInfo,
    error: contentError,
    refetch,
    markDraftSaved,
    lockedByPendingDraft,
    pendingDraftOwnerName,
    pendingDraftOwnerEmail,
    pendingDraftUpdatedAt,
  } = useDocumentContent(
    selectedRepoSlug,
    selectedFilePath
  )

  // Derive editing capability from the file-level permission returned by
  // fileinfo, additionally gated on another user's pending draft (the
  // backend enforces this too — this just keeps the UI from offering an
  // action that would 403). lockedByPendingDraft is already false for repo
  // admins and for the draft's own owner (backend never reports someone's
  // own draft as "pending" to themselves).
  const canEdit = hasPermission(filePermission, "contributor") && !lockedByPendingDraft
  const canDeleteFile = hasPermission(filePermission, "content_manager") && !lockedByPendingDraft

  // The agentic assistant created/updated files: refresh the tree and the
  // open document if it was touched.
  const handleAgentFilesChanged = useCallback((paths: string[]) => {
    setSidebarRefreshKey((k) => k + 1)
    if (selectedFilePath && paths.includes(selectedFilePath)) {
      refetch()
    }
  }, [selectedFilePath, refetch])

  const { save, publish, publishing, deleteDraft } = useDocumentSave(
    selectedRepoSlug,
    selectedFilePath
  )

  // Persist a draft and immediately reflect that one exists, so the discard /
  // publish controls appear as soon as the first autosave lands.
  const saveDraft = useCallback(async (markdown: string) => {
    await save(markdown)
    markDraftSaved()
  }, [save, markDraftSaved])

  // Debounced autosave for the markdown editor: drafts persist automatically
  // while editing, so there is no manual save-draft button.
  const mdAutosave = useDebouncedAutosave({
    enabled: editing && canEdit && isMarkdownFile(selectedFilePath),
    save: saveDraft,
    baseline: restoredMarkdown ?? content ?? "",
  })

  const [editOnLoad, setEditOnLoad] = useState(false)
  const [editSignal, setEditSignal] = useState(0)

  // Reset edit mode and close history when the selected file changes
  useEffect(() => {
    if (editOnLoad) {
      setEditing(true)
      setEditOnLoad(false)
    } else {
      setEditing(false)
    }
    setHistoryOpen(false)
    setSelectedCommit(null)
    setDiffOldMarkdown(null)
    setRestoredMarkdown(null)
    setCursorPosition(null)
  }, [selectedFilePath]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateFile = useCallback((path: string) => {
    setEditOnLoad(true)
    setSelectedFilePath(path)
  }, [])

  const handleFileDoubleClick = useCallback((path: string) => {
    if (!canEdit) return
    if (path === selectedFilePath) {
      if (isMarkdownFile(path)) {
        setEditing(true)
      } else {
        setEditSignal((s) => s + 1)
      }
    } else {
      setEditOnLoad(true)
      setSelectedFilePath(path)
    }
  }, [canEdit, selectedFilePath])

  const handleRepoChange = useCallback((repoSlug: string) => {
    setSelectedRepoSlug(repoSlug)
    setSelectedFilePath("")
  }, [])

  const handleSearchSelect = useCallback((repoSlug: string, filePath: string) => {
    pushNextRef.current = true
    setSelectedRepoSlug(repoSlug)
    setSelectedFilePath(filePath)
  }, [])

  const refreshSidebar = useCallback(() => {
    setSidebarRefreshKey((k) => k + 1)
  }, [])

  const { deleteDocument, renameDocument } = useDocumentMutations(selectedRepoSlug, refreshSidebar)

  const [renamingFile, setRenamingFile] = useState(false)

  const handleDeleteFile = useCallback(async () => {
    if (!selectedFilePath) return
    await deleteDocument(selectedFilePath)
    setSelectedFilePath("")
  }, [selectedFilePath, deleteDocument])

  const handleRenameFile = useCallback(async (newName: string) => {
    if (!selectedFilePath) return
    const newPath = await renameDocument(selectedFilePath, newName)
    setSelectedFilePath(newPath)
    setRenamingFile(false)
  }, [selectedFilePath, renameDocument])

  const handlePublish = useCallback(async () => {
    // Flush any pending autosave so the published draft has the latest edits.
    if (editing) await mdAutosave.flush()
    await publish()
    setEditing(false)
    refetch()
    refreshSidebar()
  }, [editing, mdAutosave, publish, refetch, refreshSidebar])

  const handleDiscardDraft = useCallback(async () => {
    await deleteDraft()
    setEditing(false)
    refetch()
    refreshSidebar()
  }, [deleteDraft, refetch, refreshSidebar])

  const handleDiagramSaved = useCallback(async () => {
    const newContent = editorRef.current?.getMarkdown() ?? ""
    await save(newContent)
    refetch()
    refreshSidebar()
  }, [save, refetch, refreshSidebar])

  const handleCancel = useCallback(async () => {
    // Persist the last edits (they were autosaved as a draft anyway) before exiting.
    await mdAutosave.flush()
    setEditing(false)
    setRestoredMarkdown(null)
    refetch()
  }, [mdAutosave, refetch])

  const handleExportCurrentPdf = useCallback(() => {
    const file = selectedFilePath.split("/").pop() ?? ""
    const name = file.endsWith(".md") ? file.slice(0, -3) : file
    exportCurrentDocument(name)
  }, [selectedFilePath, exportCurrentDocument])

  const handleExportFolderPdf = useCallback(
    (folderPath: string) => {
      if (!docTree) return
      const name = folderPath ? folderPath.split("/").pop() ?? folderPath : "Content"
      setPdfFolderName(name)
      setPdfDialogOpen(true)
      const controller = new AbortController()
      pdfCancelRef.current = controller
      exportFolder(folderPath, docTree, { onCancel: controller.signal }).finally(() => {
        setPdfDialogOpen(false)
        pdfCancelRef.current = null
      })
    },
    [docTree, exportFolder],
  )

  const handleCancelPdfExport = useCallback(() => {
    pdfCancelRef.current?.abort()
    setPdfDialogOpen(false)
  }, [])

  const handleSelectCommit = useCallback(
    (entry: FileHistoryEntry) => {
      setSelectedCommit(entry)
      setDiffOldMarkdown(null)
      fetchFileAtCommit(selectedRepoSlug, selectedFilePath, entry.commit_hash)
        .then((oldContent) => setDiffOldMarkdown(oldContent))
        .catch(() => setDiffOldMarkdown(null))
    },
    [selectedRepoSlug, selectedFilePath],
  )

  const handleRestore = useCallback(
    () => {
      if (!selectedCommit) return
      fetchFileAtCommit(selectedRepoSlug, selectedFilePath, selectedCommit.commit_hash)
        .then((oldContent) => {
          setRestoredMarkdown(oldContent)
          setSelectedCommit(null)
          setDiffOldMarkdown(null)
          setEditing(true)
        })
        .catch(() => {})
    },
    [selectedRepoSlug, selectedFilePath, selectedCommit],
  )

  const handleCloseDiff = useCallback(() => {
    setSelectedCommit(null)
    setDiffOldMarkdown(null)
  }, [])

  const handleAiToggle = useCallback(() => {
    if (!aiPanelOpen) {
      // Capture selection when opening
      let sel: string
      if (editing) {
        editorRef.current?.saveSelection()
        sel = editorRef.current?.getSelectionMarkdown() ?? ""
      } else {
        sel = window.getSelection()?.toString() ?? ""
      }
      setAiSelectedText(sel)
    }
    setAiPanelOpen((prev) => !prev)
  }, [editing, aiPanelOpen])

  const rawFileName = selectedFilePath.split("/").pop() ?? ""
  const fileName = rawFileName.endsWith(".md") ? rawFileName.slice(0, -3) : rawFileName

  return (
    <div className="flex h-svh flex-col">
      <Header
        sidebarRef={sidebarRef}
        repos={repos}
        reposLoading={reposLoading}
        selectedRepo={selectedRepoSlug}
        onRepoChange={handleRepoChange}
        onSearchSelect={handleSearchSelect}
        onAiAssistant={aiAvailable ? handleAiToggle : undefined}
        onAdmin={() => setAdminOpen(true)}
      />
      {adminOpen ? (
        <AdminPanel onClose={() => { setAdminOpen(false); refreshRepos() }} />
      ) : (
      <ResizablePanelGroup
        orientation="vertical"
        className="flex-1 overflow-hidden"
      >
        <ResizablePanel id="main" defaultSize="100%" minSize="30%">
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={{ sidebar: 20, content: 80 }}
          >
            {repos.length > 0 && (
              <>
                <ResizablePanel
                  id="sidebar"
                  panelRef={sidebarRef}
                  collapsible
                  defaultSize="20%"
                  minSize="15%"
                  maxSize="40%"
                  className="min-w-0"
                >
                  <Sidebar
                    repoSlug={selectedRepoSlug}
                    selectedFilePath={selectedFilePath}
                    onFileSelect={setSelectedFilePath}
                    onCreateFile={handleCreateFile}
                    onFileDoubleClick={handleFileDoubleClick}
                    refreshKey={sidebarRefreshKey}
                    filePermission={filePermission}
                    onExportFolderPdf={handleExportFolderPdf}
                    onImportConfluence={() => setImportOpen(true)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}
            <ResizablePanel id="content" defaultSize="80%" className="min-w-0">
              <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel id="doc" defaultSize="100%" minSize="40%">
                  <main className="h-full overflow-y-auto pt-3">
                    {!user ? (
                      <LoginPanel />
                    ) : !reposLoading && repos.length === 0 ? (
                      <div className="flex h-full justify-center px-6 pt-[30vh]">
                        <div className="text-center space-y-3">
                          <h2 className="text-3xl font-bold">Welcome to Admont-AI</h2>
                          <p className="text-lg text-muted-foreground">
                            {permissions.repo_admin
                              ? "No document repositories configured."
                              : "Sorry but you don't have access to any document repository. Please contact the administrator."}
                          </p>
                        </div>
                      </div>
                    ) : selectedFilePath && isImageFile(selectedFilePath) ? (
                      <ImageFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && isVideoFile(selectedFilePath) ? (
                      <VideoFilePlayer
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                      />
                    ) : selectedFilePath && isDrawioFile(selectedFilePath) ? (
                      <DrawioFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        handleRef={diagramRef}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && isMermaidFile(selectedFilePath) ? (
                      <MermaidFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        handleRef={diagramRef}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && isExcalidrawFile(selectedFilePath) ? (
                      <ExcalidrawFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        handleRef={diagramRef}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && isLatexFile(selectedFilePath) ? (
                      <LaTeXFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && isSpreadsheetFile(selectedFilePath) ? (
                      <SpreadsheetViewer
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        handleRef={diagramRef}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath && !isMarkdownFile(selectedFilePath) ? (
                      <TextFileEditor
                        key={selectedFilePath}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        canEdit={canEdit}
                        initialEditing={editOnLoad}
                        editSignal={editSignal}
                        onCursorChange={setCursorPosition}
                        onRename={canEdit ? () => setRenamingFile(true) : undefined}
                        onDelete={canDeleteFile ? handleDeleteFile : undefined}
                      />
                    ) : selectedFilePath ? (
                      contentError ? (
                        <p className="px-6 text-destructive">{contentError}</p>
                      ) : content === null ? (
                        <p className="px-6 text-muted-foreground">Loading…</p>
                      ) : editing ? (
                        <div className="flex flex-col -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
                          <EditorHeader
                            fileName={fileName}
                            filePath={selectedFilePath}
                            editing
                            isDraft={isDraft}
                            lastModified={lastModified}
                            pendingDraftOwnerName={pendingDraftOwnerName}
                            pendingDraftOwnerEmail={pendingDraftOwnerEmail}
                            pendingDraftUpdatedAt={pendingDraftUpdatedAt}
                            publishing={publishing}
                            saveStatus={mdAutosave.status}
                            onPublish={handlePublish}
                            onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
                            onCancel={handleCancel}
                            rightSlot={mdViewState && (
                              <ViewModeToggle
                                viewMode={mdViewState.viewMode}
                                onChange={mdViewState.onChange}
                                showDiff={mdViewState.showDiff}
                                className="flex items-center gap-0.5"
                              />
                            )}
                          />
                          <div className="relative min-h-0 flex-1">
                            <MarkdownEditor
                              key={restoredMarkdown != null ? "restored" : "edit"}
                              ref={editorRef}
                              markdown={restoredMarkdown ?? content}
                              repoSlug={selectedRepoSlug}
                              filePath={selectedFilePath}
                              repos={repos}
                              onDiagramSaved={handleDiagramSaved}
                              onNavigate={handleSearchSelect}
                              onViewState={setMdViewState}
                              onChange={mdAutosave.notifyChange}
                            />
                            {aiAvailable && <AiEditBox editorRef={editorRef} />}
                          </div>
                        </div>
                      ) : diffOldMarkdown != null ? (
                        <div className="flex flex-col -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
                          <header className="flex items-center justify-between border-b px-6 py-1.5">
                            <div className="truncate">
                              <h2 className="text-lg font-semibold truncate">
                                {fileName} — History {selectedCommit && new Date(selectedCommit.date).toLocaleString()}
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
                          <div className="min-h-0 flex-1">
                            <MarkdownEditor
                              markdown={diffOldMarkdown}
                              diffMarkdown={content}
                              readOnly
                              repoSlug={selectedRepoSlug}
                              filePath={selectedFilePath}
                              onNavigate={handleSearchSelect}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
                          <EditorHeader
                            fileName={fileName}
                            filePath={selectedFilePath}
                            isDraft={isDraft}
                            lastModified={lastModified}
                            draftUpdatedAt={draftUpdatedAt}
                            pendingDraftOwnerName={pendingDraftOwnerName}
                            pendingDraftOwnerEmail={pendingDraftOwnerEmail}
                            pendingDraftUpdatedAt={pendingDraftUpdatedAt}
                            canEdit={canEdit}
                            fileInfo={fileInfo}
                            onEdit={canEdit ? () => setEditing(true) : undefined}
                            onPublish={canEdit ? handlePublish : undefined}
                            onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
                            onShowHistory={() => setHistoryOpen(true)}
                            onRename={canEdit ? () => setRenamingFile(true) : undefined}
                            onDelete={canDeleteFile ? handleDeleteFile : undefined}
                            onExportPdf={handleExportCurrentPdf}
                            rightSlot={mdViewState && (
                              <ViewModeToggle
                                viewMode={mdViewState.viewMode}
                                onChange={mdViewState.onChange}
                                showDiff={mdViewState.showDiff}
                                className="flex items-center gap-0.5"
                              />
                            )}
                          />
                          <div className="min-h-0 flex-1">
                            <MarkdownEditor
                              key={`view-${selectedFilePath}`}
                              ref={editorRef}
                              markdown={content}
                              readOnly
                              repoSlug={selectedRepoSlug}
                              filePath={selectedFilePath}
                              onNavigate={handleSearchSelect}
                              onViewState={setMdViewState}
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <p className="px-6 text-muted-foreground">
                        Select a file to view its content.
                      </p>
                    )}
                  </main>
                </ResizablePanel>
                {historyOpen && selectedFilePath && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="history" defaultSize="30%" minSize="15%" maxSize="50%">
                      <FileHistoryPanel
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        selectedCommit={selectedCommit?.commit_hash ?? null}
                        onSelectCommit={handleSelectCommit}
                        onClose={() => {
                          setHistoryOpen(false)
                          setSelectedCommit(null)
                          setDiffOldMarkdown(null)
                        }}
                      />
                    </ResizablePanel>
                  </>
                )}
                {aiPanelOpen && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="ai-panel" defaultSize="35%" minSize="15%" maxSize="50%">
                      <AiAssistantPanel
                        editorRef={editorRef}
                        diagramRef={diagramRef}
                        selectedText={aiSelectedText}
                        repos={repos}
                        repoSlug={selectedRepoSlug}
                        filePath={selectedFilePath}
                        onClose={() => setAiPanelOpen(false)}
                        onNavigate={handleSearchSelect}
                        onFilesChanged={handleAgentFilesChanged}
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
      )}
      {cursorPosition && (
        <div className="border-t bg-muted flex items-center px-4 py-1 text-sm text-muted-foreground">
          <span className="ml-auto tabular-nums">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        </div>
      )}
      <RenameDialog
        open={renamingFile}
        onOpenChange={setRenamingFile}
        currentName={rawFileName}
        onRename={handleRenameFile}
      />
      <ExportPdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        folderName={pdfFolderName}
        progress={pdfProgress}
        onCancel={handleCancelPdfExport}
      />
      <ConfluenceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        repos={repos}
        defaultRepoSlug={selectedRepoSlug}
        onDone={refreshSidebar}
      />
    </div>
  )
}

function RenameDialog({
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
          className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
