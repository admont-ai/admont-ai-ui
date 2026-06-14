import { useCallback, useEffect, useRef, useState } from "react"
import { RotateCcw, X } from "lucide-react"
import type { editor } from "monaco-editor"

import { Button } from "@/components/ui/button"
import { SharedMonacoEditor } from "./SharedMonacoEditor"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { FileHistoryEntry } from "@/types"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".json": "json",
  ".jsonc": "json",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "html",
  ".htm": "html",
  ".xml": "xml",
  ".svg": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "ini",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ps1": "powershell",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".dockerfile": "dockerfile",
  ".lua": "lua",
  ".php": "php",
  ".r": "r",
  ".pl": "perl",
  ".scala": "scala",
  ".clj": "clojure",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hs": "haskell",
  ".dart": "dart",
  ".tf": "hcl",
  ".proto": "protobuf",
}

function getLanguage(filePath: string): string {
  const name = filePath.split("/").pop()?.toLowerCase() ?? ""
  if (name === "dockerfile") return "dockerfile"
  if (name === "makefile" || name === "gnumakefile") return "makefile"
  const dot = name.lastIndexOf(".")
  if (dot < 0) return "plaintext"
  return EXT_LANGUAGE_MAP[name.slice(dot)] ?? "plaintext"
}

interface TextFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit: boolean
  initialEditing?: boolean
  editSignal?: number
  onCursorChange?: (pos: { line: number; column: number }) => void
  onRename?: () => void
  onDelete?: () => void
}

export function TextFileEditor({ repoSlug, filePath, canEdit, initialEditing, editSignal, onCursorChange, onRename, onDelete }: TextFileEditorProps) {
  const [editing, setEditing] = useState(!!initialEditing)
  const [code, setCode] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldContent, setDiffOldContent] = useState<string | null>(null)
  const [restoredContent, setRestoredContent] = useState<string | null>(null)
  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const codeRef = useRef(code)
  codeRef.current = code

  const { content, lastModified, isDraft, draftUpdatedAt, refetch } = useDocumentContent(repoSlug, filePath)
  const { save, saving, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)

  const language = getLanguage(filePath)

  useEffect(() => {
    if (content !== null && !editing) {
      setCode(content)
    }
  }, [content, editing])

  useEffect(() => {
    if (editSignal && canEdit) setEditing(true)
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    await save(codeRef.current)
    setEditing(false)
    refetch()
  }, [save, refetch])

  const handlePublish = useCallback(async () => {
    if (editing) {
      await save(codeRef.current)
    }
    await publish()
    setEditing(false)
    refetch()
  }, [editing, save, publish, refetch])

  const handleDiscardDraft = useCallback(async () => {
    await deleteDraft()
    setEditing(false)
    refetch()
  }, [deleteDraft, refetch])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setRestoredContent(null)
  }, [])

  const handleEdit = useCallback(() => {
    if (restoredContent != null) {
      setCode(restoredContent)
    } else if (content != null) {
      setCode(content)
    }
    setEditing(true)
  }, [content, restoredContent])

  const handleSelectCommit = useCallback(
    (entry: FileHistoryEntry) => {
      setSelectedCommit(entry)
      setDiffOldContent(null)
      fetchFileAtCommit(repoSlug, filePath, entry.commit_hash)
        .then((oldContent) => setDiffOldContent(oldContent))
        .catch(() => setDiffOldContent(null))
    },
    [repoSlug, filePath],
  )

  const handleRestore = useCallback(() => {
    if (!selectedCommit) return
    fetchFileAtCommit(repoSlug, filePath, selectedCommit.commit_hash)
      .then((oldContent) => {
        setRestoredContent(oldContent)
        setCode(oldContent)
        setSelectedCommit(null)
        setDiffOldContent(null)
        setEditing(true)
      })
      .catch(() => {})
  }, [repoSlug, filePath, selectedCommit])

  const handleCloseDiff = useCallback(() => {
    setSelectedCommit(null)
    setDiffOldContent(null)
  }, [])

  const rawFileName = filePath.split("/").pop() ?? ""

  const handleEditorRef = useCallback((ed: editor.IStandaloneCodeEditor | null) => {
    monacoRef.current = ed
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
        saving={saving}
        publishing={publishing}
        onSave={handleSave}
        onPublish={handlePublish}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onCancel={handleCancel}
      />
      <SharedMonacoEditor
        language={language}
        value={code}
        onChange={setCode}
        onCursorChange={onCursorChange}
        onEditorRef={handleEditorRef}
      />
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
      <SharedMonacoEditor
        language={language}
        value={content}
        diffOriginal={diffOldContent}
        readOnly
        onEditorRef={handleEditorRef}
      />
    </div>
  ) : (
    <div className="flex h-full flex-col [&>header]:mb-0">
      <EditorHeader
        fileName={rawFileName}
        filePath={filePath}
        isDraft={isDraft}
        lastModified={lastModified}
        draftUpdatedAt={draftUpdatedAt}
        canEdit={canEdit}
        onEdit={canEdit ? handleEdit : undefined}
        onPublish={canEdit ? handlePublish : undefined}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
      />
      <SharedMonacoEditor
        language={language}
        value={content}
        readOnly
        onCursorChange={onCursorChange}
        onEditorRef={handleEditorRef}
      />
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
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
