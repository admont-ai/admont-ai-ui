import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/use-document-content"
import { useDocumentSave } from "@/hooks/use-document-save"
import { fetchFileAtCommit } from "@/hooks/use-file-history"
import type { FileHistoryEntry } from "@/types"
import { EditorHeader } from "./EditorHeader"
import { FileHistoryPanel } from "./FileHistoryPanel"
import { ModelSelector } from "./ModelSelector"
import { useAiLog } from "@/hooks/use-ai-log"

// ── MathJax setup (CDN-based, configured once) ──────────────────────────
const MATHJAX_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"

interface MathJaxInstance {
  typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
  typesetClear?: (elements: HTMLElement[]) => void
  startup: { defaultReady: () => void; ready?: () => void }
  tex?: Record<string, unknown>
  options?: Record<string, unknown>
}

const mjWindow = window as unknown as Window & { MathJax?: MathJaxInstance | Record<string, unknown> }

let mathjaxReady: Promise<void> | null = null

function ensureMathJax(): Promise<void> {
  if (mathjaxReady) return mathjaxReady
  mathjaxReady = new Promise<void>((resolve) => {
    if ((mjWindow.MathJax as MathJaxInstance | undefined)?.typesetPromise) {
      resolve()
      return
    }
    mjWindow.MathJax = {
      tex: { inlineMath: [["$", "$"], ["\\(", "\\)"]], displayMath: [["$$", "$$"], ["\\[", "\\]"]], processEscapes: true, processEnvironments: true },
      options: { skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"] },
      startup: { ready: () => { (mjWindow.MathJax as MathJaxInstance).startup.defaultReady(); resolve() } },
    }
    const script = document.createElement("script")
    script.src = MATHJAX_URL
    script.async = true
    document.head.appendChild(script)
  })
  return mathjaxReady
}

// ── Lightweight LaTeX-to-HTML parser ─────────────────────────────────────

function latexToHtml(source: string): string {
  let s = source

  // Strip preamble commands
  s = s.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}\s*/g, "")
  s = s.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}\s*/g, "")
  s = s.replace(/\\begin\{document\}\s*/g, "")
  s = s.replace(/\\end\{document\}\s*/g, "")
  s = s.replace(/\\title\{[^}]*\}\s*/g, "")
  s = s.replace(/\\author\{[^}]*\}\s*/g, "")
  s = s.replace(/\\date\{[^}]*\}\s*/g, "")
  s = s.replace(/\\maketitle\s*/g, "")

  // Protect math environments from further processing
  const mathHoles: string[] = []
  const placeholder = (i: number) => `%%MATH${i}%%`

  // Display math environments: equation, align, gather, multline, etc.
  s = s.replace(/\\begin\{(equation|align|align\*|gather|gather\*|multline|multline\*|eqnarray|eqnarray\*)\}[\s\S]*?\\end\{\1\}/g, (m) => {
    mathHoles.push(m)
    return placeholder(mathHoles.length - 1)
  })
  // \[...\] and $$...$$
  s = s.replace(/\\\[[\s\S]*?\\\]/g, (m) => { mathHoles.push(m); return placeholder(mathHoles.length - 1) })
  s = s.replace(/\$\$[\s\S]*?\$\$/g, (m) => { mathHoles.push(m); return placeholder(mathHoles.length - 1) })
  // Inline: \(...\) and $...$
  s = s.replace(/\\\([\s\S]*?\\\)/g, (m) => { mathHoles.push(m); return placeholder(mathHoles.length - 1) })
  s = s.replace(/(?<![\\$])\$(?!\$)(.+?)\$/g, (m) => { mathHoles.push(m); return placeholder(mathHoles.length - 1) })

  // Escape HTML entities in the remaining text
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Sectioning
  s = s.replace(/\\section\{([^}]*)\}/g, "<h2>$1</h2>")
  s = s.replace(/\\subsection\{([^}]*)\}/g, "<h3>$1</h3>")
  s = s.replace(/\\subsubsection\{([^}]*)\}/g, "<h4>$1</h4>")

  // Inline formatting
  s = s.replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
  s = s.replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
  s = s.replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>")
  s = s.replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>")
  s = s.replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>")

  // Links
  s = s.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<a href="$1">$2</a>')

  // Lists
  s = s.replace(/\\begin\{itemize\}/g, "<ul>")
  s = s.replace(/\\end\{itemize\}/g, "</ul>")
  s = s.replace(/\\begin\{enumerate\}/g, "<ol>")
  s = s.replace(/\\end\{enumerate\}/g, "</ol>")
  s = s.replace(/\\item\s*/g, "<li>")

  // Close <li> tags before next <li> or list end
  s = s.replace(/<li>([\s\S]*?)(?=<li>|<\/ul>|<\/ol>)/g, "<li>$1</li>")

  // Environments
  s = s.replace(/\\begin\{quote\}/g, "<blockquote>")
  s = s.replace(/\\end\{quote\}/g, "</blockquote>")
  s = s.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, "<pre><code>$1</code></pre>")
  s = s.replace(/\\begin\{center\}/g, '<div style="text-align:center">')
  s = s.replace(/\\end\{center\}/g, "</div>")

  // Line breaks
  s = s.replace(/\\\\(?:\s*)/g, "<br>")
  s = s.replace(/\\newline/g, "<br>")

  // Paragraph breaks (double newlines)
  s = s.replace(/\n{2,}/g, "</p><p>")
  s = `<p>${s}</p>`
  // Clean up empty paragraphs
  s = s.replace(/<p>\s*<\/p>/g, "")

  // Restore math placeholders
  for (let i = 0; i < mathHoles.length; i++) {
    s = s.replace(placeholder(i), mathHoles[i])
  }

  return s
}

// ── LatexPreview component ───────────────────────────────────────────────

function LatexPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = html
    if (!html) return
    let cancelled = false
    ensureMathJax().then(() => {
      if (cancelled) return
      const MJ = mjWindow.MathJax as MathJaxInstance | undefined
      if (MJ?.typesetClear) MJ.typesetClear([el])
      MJ?.typesetPromise?.([el])
    })
    return () => { cancelled = true }
  }, [html])

  return <div ref={ref} />
}

interface LaTeXFileEditorProps {
  repoSlug: string
  filePath: string
  canEdit: boolean
  initialEditing?: boolean
  editSignal?: number
  onRename?: () => void
  onDelete?: () => void
}

export function LaTeXFileEditor({ repoSlug, filePath, canEdit, initialEditing, editSignal, onRename, onDelete }: LaTeXFileEditorProps) {
  const [editing, setEditing] = useState(!!initialEditing)
  const [code, setCode] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<FileHistoryEntry | null>(null)
  const [diffOldContent, setDiffOldContent] = useState<string | null>(null)
  const [restoredContent, setRestoredContent] = useState<string | null>(null)
  const [debouncedCode, setDebouncedCode] = useState("")

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const { content, lastModified, isDraft, draftUpdatedAt, refetch, pendingDraftOwnerName, pendingDraftOwnerEmail, pendingDraftUpdatedAt } = useDocumentContent(repoSlug, filePath)
  const { save, saving, publish, publishing, deleteDraft } = useDocumentSave(repoSlug, filePath)
  const { models, modelsLoading, selectedModel, setSelectedModel } = useAiLog()

  // Initialize editor content when entering edit mode or when content loads.
  // The first load also syncs in edit mode — a freshly created file mounts
  // directly in edit mode and would otherwise show an empty editor.
  const codeInitializedRef = useRef(false)
  useEffect(() => {
    if (content === null) return
    if (!editing || !codeInitializedRef.current) {
      codeInitializedRef.current = true
      setCode(content)
      setDebouncedCode(content)
    }
  }, [content, editing])

  // Only react to editSignal increments after mount (see DrawioFileEditor).
  const lastEditSignal = useRef(editSignal)
  useEffect(() => {
    if (editSignal !== lastEditSignal.current && canEdit) setEditing(true)
    lastEditSignal.current = editSignal
  }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce preview updates in edit mode
  useEffect(() => {
    if (!editing) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedCode(code), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [code, editing])

  const previewHtml = useMemo(() => {
    const source = editing ? debouncedCode : (content ?? "")
    if (!source.trim()) return ""
    return latexToHtml(source)
  }, [editing, debouncedCode, content])

  const diffOldHtml = useMemo(() => {
    if (diffOldContent == null) return ""
    return latexToHtml(diffOldContent)
  }, [diffOldContent])

  const diffCurrentHtml = useMemo(() => {
    if (diffOldContent == null || content == null) return ""
    return latexToHtml(content)
  }, [diffOldContent, content])

  const handleSave = useCallback(async () => {
    await save(code)
    setEditing(false)
    refetch()
  }, [save, code, refetch])

  const handlePublish = useCallback(async () => {
    if (editing) {
      await save(code)
    }
    await publish()
    setEditing(false)
    refetch()
  }, [editing, save, code, publish, refetch])

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
      setDebouncedCode(restoredContent)
    } else if (content != null) {
      setCode(content)
      setDebouncedCode(content)
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
        setDebouncedCode(oldContent)
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
  const fileName = rawFileName.endsWith(".tex") ? rawFileName.slice(0, -4) : rawFileName

  if (content === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  const mainContent = editing ? (
    // Edit mode: side-by-side textarea + preview
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={fileName}
        filePath={filePath}
        editing
        isDraft={isDraft}
        lastModified={lastModified}
        pendingDraftOwnerName={pendingDraftOwnerName}
        pendingDraftOwnerEmail={pendingDraftOwnerEmail}
        pendingDraftUpdatedAt={pendingDraftUpdatedAt}
        saving={saving}
        publishing={publishing}
        onSave={handleSave}
        onPublish={handlePublish}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onCancel={handleCancel}
      >
        <ModelSelector models={models} loading={modelsLoading} value={selectedModel} onValueChange={setSelectedModel} />
      </EditorHeader>
      <div className="mb-4" />
      <div className="min-h-0 flex-1 px-4 pb-4">
        <div className="grid h-full grid-cols-2 gap-4">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="text-foreground border-input h-full w-full resize-none rounded-md border bg-[#f5f5f5] p-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            placeholder="Enter LaTeX code..."
          />
          <div className="border-input overflow-auto rounded-md border bg-[#f5f5f5] p-3">
            {previewHtml ? (
              <LatexPreview html={previewHtml} />
            ) : (
              <p className="text-muted-foreground text-sm">Preview will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : diffOldContent != null ? (
    // Diff mode: side-by-side rendered comparison
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-center justify-between border-b px-6 pb-3">
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
      <div className="min-h-0 flex-1 px-4 pb-4">
        <div className="grid h-full grid-cols-2 gap-4">
          <div className="overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Old version</h3>
            <LatexPreview html={diffOldHtml} />
          </div>
          <div className="overflow-auto rounded-md border bg-[#f5f5f5] p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Current version</h3>
            <LatexPreview html={diffCurrentHtml} />
          </div>
        </div>
      </div>
    </div>
  ) : (
    // View mode: header + rendered preview
    <div className="flex h-full flex-col">
      <EditorHeader
        fileName={fileName}
        filePath={filePath}
        isDraft={isDraft}
        lastModified={lastModified}
        draftUpdatedAt={draftUpdatedAt}
        pendingDraftOwnerName={pendingDraftOwnerName}
        pendingDraftOwnerEmail={pendingDraftOwnerEmail}
        pendingDraftUpdatedAt={pendingDraftUpdatedAt}
        canEdit={canEdit}
        onEdit={canEdit ? handleEdit : undefined}
        onPublish={canEdit ? handlePublish : undefined}
        onDiscardDraft={canEdit ? handleDiscardDraft : undefined}
        onShowHistory={() => setHistoryOpen(true)}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-editor px-6">
        {previewHtml ? (
          <LatexPreview html={previewHtml} />
        ) : (
          <p className="text-muted-foreground text-sm">Empty document</p>
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
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
