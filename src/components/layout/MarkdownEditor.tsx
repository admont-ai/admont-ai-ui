import { ArrowDown, ArrowUp, Code, FileText, GitCompare, Link, List, Replace, Search, X } from "lucide-react"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  imagePlugin,
  toolbarPlugin,
  frontmatterPlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  sandpackPlugin,
  searchPlugin,
  ConditionalContents,
  InsertCodeBlock,
  ChangeCodeMirrorLanguage,
  InsertImage,
  InsertFrontmatter,
  InsertAdmonition,
  InsertSandpack,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  InsertTable,
  ListsToggle,
  Separator as ToolbarSeparator,
  useCellValue,
  usePublisher,
  activeEditor$,
  linkDialogState$,
  useEditorSearch,
  useCodeBlockEditorContext,
  type CodeBlockEditorDescriptor,
} from "@mdxeditor/editor"
import { $getSelection, $setSelection, $getNodeByKey, $isRangeSelection, $createTextNode, $insertNodes, $isTextNode } from "lexical"
import type { BaseSelection, LexicalEditor } from "lexical"
import { LinkNode, $isLinkNode, $createLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link"
import "@mdxeditor/editor/style.css"
import type { editor } from "monaco-editor"
import { SharedMonacoEditor } from "./SharedMonacoEditor"

// CSS Highlight API styles for search plugin
const searchHighlightCSS = document.createElement("style")
searchHighlightCSS.textContent = `
  ::highlight(MdxSearch) {
    background-color: #fde68a;
    color: inherit;
  }
  ::highlight(MdxFocusSearch) {
    background-color: #f97316;
    color: white;
  }
`
if (!document.head.querySelector("[data-mdx-search-highlight]")) {
  searchHighlightCSS.setAttribute("data-mdx-search-highlight", "")
  document.head.appendChild(searchHighlightCSS)
}
import { SpellCheckPlugin } from "./SpellCheckPlugin"

// Fallback editor for code blocks whose language is not in the CodeMirror
// language map. Without it, MDXEditor fails to parse the entire document
// ("Parsing of the following markdown structure failed: {type: code}").
const fallbackCodeBlockDescriptor: CodeBlockEditorDescriptor = {
  match: () => true,
  priority: -10,
  Editor: (props) => {
    const cb = useCodeBlockEditorContext()
    return (
      <div onKeyDown={(e) => e.nativeEvent.stopImmediatePropagation()} className="my-2 rounded-md border bg-muted/30">
        {props.language && (
          <div className="border-b px-3 py-1 font-mono text-xs text-muted-foreground">{props.language}</div>
        )}
        <textarea
          defaultValue={props.code}
          onChange={(e) => cb.setCode(e.target.value)}
          rows={Math.min(20, props.code.split("\n").length + 1)}
          className="w-full resize-y bg-transparent px-3 py-2 font-mono text-sm focus:outline-none"
        />
      </div>
    )
  },
}

// Patch LinkNode.sanitizeUrl to preserve relative wiki paths.
// Lexical's default formatUrl() prepends "https://" to URLs like
// "Getting%20Started/Introduction.md", breaking in-repo navigation.
const _origSanitize = LinkNode.prototype.sanitizeUrl
LinkNode.prototype.sanitizeUrl = function (url: string) {
  // If URL already has a protocol, use the original sanitizer (blocks javascript: etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return _origSanitize.call(this, url)
  }
  // Relative / absolute paths — leave as-is
  return url
}
import "katex/dist/katex.min.css"
import { authFetch } from "@/lib/auth-fetch"
import { ImageUploadDialog } from "./ImageUploadDialog"
import { DRAG_TYPE_DOC } from "./FileTree"
import { mathPlugin } from "@/plugins/mathPlugin"
import { videoPlugin } from "@/plugins/videoPlugin"
import { MermaidEditorDialog, type MermaidEditRequest } from "./MermaidEditorDialog"
import { DrawioEditorDialog, type DrawioEditRequest } from "./DrawioEditorDialog"
import { InsertLinkDialog } from "./InsertLinkDialog"
import type { Repo } from "@/types"

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico",
])

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv",
])

function isMediaFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  const ext = name.slice(dot).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
}


function getRelativePath(fromDir: string, toPath: string): string {
  const fromParts = fromDir.split("/").filter(Boolean)
  const toParts = toPath.split("/").filter(Boolean)
  let common = 0
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++
  }
  const ups = fromParts.length - common
  const remaining = toParts.slice(common)
  return [...Array(ups).fill(".."), ...remaining].join("/")
}

/** Resolve a relative path against a base directory, handling `..` and `.` segments */
function resolveRelativePath(fromDir: string, relativePath: string): string {
  const parts = fromDir.split("/").filter(Boolean)
  for (const seg of relativePath.split("/")) {
    if (seg === "..") parts.pop()
    else if (seg !== "." && seg !== "") parts.push(seg)
  }
  return parts.join("/")
}

function isExternalUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url)
}

/**
 * Bridge between MDXEditor's built-in link dialog state and our custom
 * InsertLinkDialog. When the built-in dialog enters "edit" mode (user clicked
 * the edit button on the link preview popover), we intercept it, close the
 * built-in dialog, and fire a callback with the link data so our custom
 * dialog can open pre-populated.
 */
function LinkEditBridge({
  onEditLink,
}: {
  onEditLink: (data: { url: string; title: string; text: string; linkNodeKey: string }) => void
}) {
  const state = useCellValue(linkDialogState$)
  const setDialogState = usePublisher(linkDialogState$)

  useEffect(() => {
    if (state.type === "edit") {
      const { url, title, text, linkNodeKey } = state as {
        url: string
        title: string
        text: string
        linkNodeKey: string
      }
      // Close the built-in dialog
      setDialogState({ type: "inactive" })
      // Open our custom dialog with existing link data
      onEditLink({ url: url ?? "", title: title ?? "", text: text ?? "", linkNodeKey: linkNodeKey ?? "" })
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}




function LexicalEditorCapture({ targetRef, onEditor }: { targetRef: { current: LexicalEditor | null }; onEditor?: (editor: LexicalEditor | null) => void }) {
  const editor = useCellValue(activeEditor$)
  useEffect(() => {
    targetRef.current = editor ?? null
    onEditor?.(editor ?? null)
    // Disable browser spellcheck on the contentEditable element
    const rootEl = editor?.getRootElement()
    if (rootEl) {
      rootEl.setAttribute("spellcheck", "false")
    }
  }, [editor, targetRef, onEditor])
  return null
}

function generateToc(markdown: string): string {
  const lines = markdown.split("\n")
  const tocEntries: string[] = []
  let inCodeBlock = false

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (!match) continue

    const level = match[1].length
    const text = match[2].replace(/[*_`~[\]]/g, "").trim()
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
    const indent = "  ".repeat(level - 1)
    tocEntries.push(`${indent}- [${text}](#${slug})`)
  }

  if (tocEntries.length === 0) return ""
  return `## Table of Contents\n\n${tocEntries.join("\n")}\n\n`
}

function SearchToolbar() {
  const { search, setSearch, isSearchOpen, openSearch, closeSearch, next, prev, total, cursor, replace: replaceOne, replaceAll } = useEditorSearch()
  const [replaceText, setReplaceText] = useState("")
  const [showReplace, setShowReplace] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [barPos, setBarPos] = useState<{ top: number; right: number } | null>(null)

  const handleReplace = useCallback(() => {
    if (!total) return
    if (cursor === 0) { next(); setTimeout(() => replaceOne(replaceText), 100) }
    else replaceOne(replaceText)
  }, [total, cursor, next, replaceOne, replaceText])

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setBarPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
      }
    }
  }, [isSearchOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="Find and replace"
        className={`pointer-events-auto flex items-center justify-center rounded p-1.5 transition-colors [&_svg]:size-4 ${isSearchOpen ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
        onClick={() => isSearchOpen ? (closeSearch(), setSearch(null)) : openSearch()}
      >
        <Search />
      </button>
      {isSearchOpen && barPos && createPortal(
        <div className="fixed z-[9999] rounded-lg border bg-popover shadow-lg p-2 space-y-1.5" style={{ width: 340, top: barPos.top, right: barPos.right }}>
      <div className="flex items-center gap-1">
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) { prev() } else { next() } }
            if (e.key === "Escape") { e.preventDefault(); closeSearch(); setSearch(null) }
          }}
          placeholder="Find…"
          className="flex-1 min-w-0 rounded border bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-12 text-center">
          {search ? `${cursor}/${total}` : ""}
        </span>
        <button type="button" title="Previous" onClick={prev} disabled={!total} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 [&_svg]:size-3.5">
          <ArrowUp />
        </button>
        <button type="button" title="Next" onClick={next} disabled={!total} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 [&_svg]:size-3.5">
          <ArrowDown />
        </button>
        <button type="button" title="Toggle replace" onClick={() => setShowReplace(!showReplace)} className={`rounded p-1 transition-colors [&_svg]:size-3.5 ${showReplace ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
          <Replace />
        </button>
        <button type="button" title="Close" onClick={() => { closeSearch(); setSearch(null) }} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5">
          <X />
        </button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleReplace() }
              if (e.key === "Escape") { e.preventDefault(); closeSearch(); setSearch(null) }
            }}
            placeholder="Replace…"
            className="flex-1 min-w-0 rounded border bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="button" title="Replace" onClick={() => replaceOne(replaceText)} disabled={!total} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
            Replace
          </button>
          <button type="button" title="Replace all" onClick={() => replaceAll(replaceText)} disabled={!total} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
            All
          </button>
        </div>
      )}
    </div>,
    document.body,
  )}
    </>
  )
}


function InsertTocButton({ editorRef }: { editorRef: React.RefObject<MDXEditorMethods | null> }) {
  return (
    <button
      type="button"
      title="Insert table of contents"
      className="flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
      onClick={() => {
        const editor = editorRef.current
        if (!editor) return
        const md = editor.getMarkdown()
        const toc = generateToc(md)
        if (!toc) return

        // Remove existing TOC if present, then prepend new one
        const tocPattern = /^## Table of Contents\n\n(?:\s*- \[.*?\]\(#.*?\)\n)*\n*/
        const cleaned = md.replace(tocPattern, "")
        editor.setMarkdown(toc + cleaned)
      }}
    >
      <List />
    </button>
  )
}

type ViewMode = "rich-text" | "source" | "diff"

function ViewModeToggle({
  viewMode,
  onChange,
  showDiff,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  showDiff: boolean
}) {
  const modes: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: "rich-text", label: "Rich Text", icon: <FileText className="h-3.5 w-3.5" /> },
    { value: "source", label: "Source", icon: <Code className="h-3.5 w-3.5" /> },
  ]
  if (showDiff) {
    modes.push({ value: "diff", label: "Diff", icon: <GitCompare className="h-3.5 w-3.5" /> })
  }

  return (
    <div className="flex items-center gap-0.5 border-b bg-background px-2 py-1">
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            viewMode === m.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  )
}

export interface MarkdownEditorHandle {
  getMarkdown: () => string
  getSelectionMarkdown: () => string
  insertMarkdown: (markdown: string) => void
  setMarkdown: (markdown: string) => void
  focus: () => void
  saveSelection: () => void
  restoreSelection: () => Promise<void>
}

interface MarkdownEditorProps {
  markdown: string
  repoSlug: string
  filePath: string
  repos?: Repo[]
  onDiagramSaved?: () => void
  onNavigate?: (repoSlug: string, filePath: string) => void
  diffMarkdown?: string
  readOnly?: boolean
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor({ markdown, repoSlug, filePath, repos = [], onDiagramSaved, onNavigate, diffMarkdown, readOnly }, ref) {
  const editorRef = useRef<MDXEditorMethods>(null)
  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const [lexicalEditor, setLexicalEditor] = useState<LexicalEditor | null>(null)
  const savedSelectionRef = useRef<BaseSelection | null>(null)

  // View mode state: rich-text uses MDXEditor, source/diff use Monaco
  const [viewMode, setViewMode] = useState<ViewMode>(diffMarkdown != null ? "diff" : "rich-text")
  const [monacoContent, setMonacoContent] = useState(markdown)
  const monacoContentRef = useRef(monacoContent)
  monacoContentRef.current = monacoContent
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  const [mermaidEditRequest, setMermaidEditRequest] = useState<MermaidEditRequest | null>(null)
  const [drawioEditRequest, setDrawioEditRequest] = useState<DrawioEditRequest | null>(null)
  const [imageDragOver, setImageDragOver] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<{
    url: string
    title: string
    text: string
    linkNodeKey: string
  } | null>(null)
  const [linkInitialText, setLinkInitialText] = useState("")
  const [hasSelectionForLink, setHasSelectionForLink] = useState(false)

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    const oldMode = viewModeRef.current
    if (newMode === oldMode) return

    if (oldMode === "rich-text" && (newMode === "source" || newMode === "diff")) {
      // Sync rich-text → Monaco
      const md = editorRef.current?.getMarkdown() ?? markdown
      setMonacoContent(md)
    } else if (oldMode === "source" && newMode === "rich-text") {
      // Sync Monaco → rich-text
      editorRef.current?.setMarkdown(monacoContentRef.current)
    } else if (oldMode === "diff" && newMode === "rich-text") {
      // Diff is read-only, sync current monacoContent back
      editorRef.current?.setMarkdown(monacoContentRef.current)
    }

    setViewMode(newMode)
  }, [markdown])

  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      if (viewModeRef.current === "source" || viewModeRef.current === "diff") {
        return monacoContentRef.current
      }
      return editorRef.current?.getMarkdown() ?? markdown
    },
    getSelectionMarkdown: () => {
      if (viewModeRef.current !== "rich-text") return ""
      try {
        return (editorRef.current as unknown as { getSelectionMarkdown?: () => string } | null)?.getSelectionMarkdown?.() ?? ""
      } catch {
        return ""
      }
    },
    insertMarkdown: (md: string) => {
      if (viewModeRef.current === "source" && monacoEditorRef.current) {
        const ed = monacoEditorRef.current
        const sel = ed.getSelection()
        if (sel) {
          ed.executeEdits("ai-insert", [{ range: sel, text: md }])
        }
      } else {
        editorRef.current?.insertMarkdown(md)
      }
    },
    setMarkdown: (md: string) => {
      setMonacoContent(md)
      editorRef.current?.setMarkdown(md)
    },
    focus: () => {
      if (viewModeRef.current === "source" && monacoEditorRef.current) {
        monacoEditorRef.current.focus()
      } else {
        editorRef.current?.focus()
      }
    },
    saveSelection: () => {
      if (viewModeRef.current !== "rich-text") return
      const editor = lexicalEditorRef.current
      if (editor) {
        editor.getEditorState().read(() => {
          const sel = $getSelection()
          savedSelectionRef.current = sel ? sel.clone() : null
        })
      }
    },
    restoreSelection: async () => {
      if (viewModeRef.current !== "rich-text") {
        savedSelectionRef.current = null
        return
      }
      const editor = lexicalEditorRef.current
      const sel = savedSelectionRef.current
      if (editor && sel) {
        editor.update(() => {
          $setSelection(sel.clone())
        })
        await new Promise((r) => setTimeout(r, 50))
      }
      savedSelectionRef.current = null
    },
  }))

  const dir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : ""
  const assetDir = `${dir}assets/`

  const imagePreviewHandler = useCallback(
    async (src: string): Promise<string> => {
      // External images load directly in the browser — never send them
      // through authFetch (it attaches the auth token to the request).
      if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
        return src
      }
      let url: string
      if (src.startsWith("/")) {
        url = src
      } else {
        const cleanSrc = src.startsWith("./") ? src.slice(2) : src
        url = `/repos/${encodeURIComponent(repoSlug)}/file/${dir}${cleanSrc}`
      }
      try {
        const res = await authFetch(url)
        if (!res.ok) return src
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      } catch {
        return src
      }
    },
    [repoSlug, dir],
  )

  const imageUploadHandler = async (image: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", image)
    const uploadPath = `${assetDir}${image.name}`
    const url = `/repos/${encodeURIComponent(repoSlug)}/upload/${uploadPath}`
    const response = await authFetch(url, { method: "POST", body: formData })
    if (!response.ok) {
      throw new Error("Image upload failed")
    }
    await response.json()
    return `assets/${image.name}`
  }

  const handleMermaidEdit = useCallback((request: MermaidEditRequest) => {
    setMermaidEditRequest(request)
  }, [])

  const handleMermaidEditHandled = useCallback(() => {
    setMermaidEditRequest(null)
  }, [])

  const handleDrawioEdit = useCallback((request: DrawioEditRequest) => {
    setDrawioEditRequest(request)
  }, [])

  const handleDrawioEditHandled = useCallback(() => {
    setDrawioEditRequest(null)
  }, [])

  // Stable component that closes over diagram edit handlers
  const ImageDialogWithDiagramEditors = useCallback(
    () => <ImageUploadDialog repoSlug={repoSlug} filePath={filePath} onMermaidEdit={handleMermaidEdit} onDrawioEdit={handleDrawioEdit} />,
    [repoSlug, filePath, handleMermaidEdit, handleDrawioEdit],
  )

  const handleEditorDragOver = useCallback((e: React.DragEvent) => {
    const hasSidebarDoc = e.dataTransfer.types.includes(DRAG_TYPE_DOC)
    const hasNativeFiles = e.dataTransfer.types.includes("Files")
    if (!hasSidebarDoc && !hasNativeFiles) return
    e.preventDefault()
    e.stopPropagation()
    setImageDragOver(true)
  }, [])

  const handleEditorDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setImageDragOver(false)
  }, [])

  const handleEditorDrop = useCallback((e: React.DragEvent) => {
    setImageDragOver(false)

    // Sidebar file drag — handle manually
    const docPath = e.dataTransfer.getData(DRAG_TYPE_DOC)
    if (docPath && isMediaFile(docPath)) {
      e.preventDefault()
      e.stopPropagation()
      const relativeSrc = getRelativePath(dir, docPath)
      const fileName = docPath.split("/").pop() ?? relativeSrc
      editorRef.current?.insertMarkdown(`![${fileName}](${relativeSrc})`)
      return
    }

    // Native video file drops — MDXEditor's image plugin only handles images
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("video/")) {
      e.preventDefault()
      e.stopPropagation()
      const formData = new FormData()
      formData.append("file", file)
      const uploadPath = `${assetDir}${file.name}`
      const url = `/repos/${encodeURIComponent(repoSlug)}/upload/${uploadPath}`
      authFetch(url, { method: "POST", body: formData })
        .then((res) => {
          if (!res.ok) throw new Error("Video upload failed")
          return res.json()
        })
        .then(() => {
          editorRef.current?.insertMarkdown(`![${file.name}](assets/${file.name})`)
        })
        .catch(() => {})
      return
    }

    // Native image file drops are handled by the MDXEditor image plugin via imageUploadHandler
  }, [dir, assetDir, repoSlug])

  const handleInsertLink = useCallback((url: string, title: string) => {
    const editor = lexicalEditorRef.current
    if (editingLink?.linkNodeKey && editor) {
      // Update existing link node
      editor.update(() => {
        const node = $getNodeByKey(editingLink.linkNodeKey)
        if ($isLinkNode(node)) {
          node.setURL(url)
          node.setTitle(title)
          if (node.getChildrenSize() <= 1) {
            const firstChild = node.getFirstChild()
            if ($isTextNode(firstChild)) {
              firstChild.setTextContent(title)
            }
          }
        }
      })
    } else if (hasSelectionForLink && editor) {
      // Wrap the current selection in a link
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, title })
    } else if (editor) {
      // Insert a new link node at cursor
      editor.update(() => {
        const linkNode = $createLinkNode(url, { title })
        linkNode.append($createTextNode(title))
        $insertNodes([linkNode])
        linkNode.selectEnd()
      })
    }
    setEditingLink(null)
    setHasSelectionForLink(false)
  }, [editingLink, hasSelectionForLink])

  const handleEditLink = useCallback((data: { url: string; title: string; text: string; linkNodeKey: string }) => {
    setEditingLink(data)
    setLinkDialogOpen(true)
  }, [])

  const handleLinkDialogClose = useCallback((open: boolean) => {
    setLinkDialogOpen(open)
    if (!open) {
      setEditingLink(null)
      setLinkInitialText("")
      setHasSelectionForLink(false)
    }
  }, [])

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    if (!onNavigate || !readOnly) return
    const anchor = (e.target as HTMLElement).closest("a")
    if (!anchor) return
    const href = anchor.getAttribute("href")
    if (!href) return

    e.preventDefault()
    e.stopPropagation()

    if (isExternalUrl(href)) {
      window.open(href, "_blank", "noopener,noreferrer")
      return
    }

    if (href.startsWith("/")) {
      // Absolute path → first segment is repo slug, rest is file path
      const trimmed = href.replace(/^\/+/, "")
      const slashIdx = trimmed.indexOf("/")
      if (slashIdx < 0) {
        onNavigate(decodeURIComponent(trimmed), "")
      } else {
        onNavigate(
          decodeURIComponent(trimmed.substring(0, slashIdx)),
          decodeURIComponent(trimmed.substring(slashIdx + 1)),
        )
      }
      return
    }

    // Relative path → resolve against current file directory in current repo
    const resolved = resolveRelativePath(dir, decodeURIComponent(href))
    onNavigate(repoSlug, resolved)
  }, [onNavigate, repoSlug, dir])

  const showDiff = diffMarkdown != null

  const handleMonacoEditorRef = useCallback((ed: editor.IStandaloneCodeEditor | null) => {
    monacoEditorRef.current = ed
  }, [])

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={handleEditorDrop}
    >
      {imageDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-md border-2 border-dashed border-primary/60 bg-primary/10">
          <span className="text-sm font-medium text-primary">Drop file here</span>
        </div>
      )}

      {/* View mode toggle — always visible */}
      <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} showDiff={showDiff} />

      {/* MDXEditor — hidden via display:none when not rich-text (preserves Lexical state) */}
      <div
        className="relative min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] [&_[role=toolbar]]:flex-wrap [&_[role=toolbar]]:bg-background"
        style={{ display: viewMode === "rich-text" ? "flex" : "none", flexDirection: "column" }}
        onClick={handleLinkClick}
      >
          <MDXEditor
            ref={editorRef}
            markdown={markdown}
            readOnly={readOnly}
            contentEditableClassName="prose prose-neutral dark:prose-invert max-w-none"
            plugins={[
              mathPlugin(),
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              tablePlugin(),
              videoPlugin(),
              frontmatterPlugin(),
              directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor], escapeUnknownTextDirectives: true }),
              searchPlugin(),
              sandpackPlugin({
                sandpackConfig: {
                  defaultPreset: "react",
                  presets: [
                    {
                      name: "react",
                      label: "React",
                      meta: "live react",
                      sandpackTemplate: "react",
                      sandpackTheme: "light",
                      snippetFileName: "/App.js",
                      dependencies: { "react": "latest", "react-dom": "latest" },
                    },
                    {
                      name: "react-ts",
                      label: "React (TypeScript)",
                      meta: "live react-ts",
                      sandpackTemplate: "react-ts",
                      sandpackTheme: "light",
                      snippetFileName: "/App.tsx",
                      dependencies: { "react": "latest", "react-dom": "latest" },
                    },
                    {
                      name: "vanilla",
                      label: "Vanilla JS",
                      meta: "live",
                      sandpackTemplate: "vanilla",
                      sandpackTheme: "light",
                      snippetFileName: "/index.js",
                    },
                  ],
                },
              }),
              imagePlugin({ imageUploadHandler, imagePreviewHandler, ImageDialog: ImageDialogWithDiagramEditors }),
              codeBlockPlugin({
                defaultCodeBlockLanguage: "",
                codeBlockEditorDescriptors: [fallbackCodeBlockDescriptor],
              }),
              codeMirrorPlugin({
                codeBlockLanguages: {
                  "": "Plain text",
                  text: "Plain text",
                  plaintext: "Plain text",
                  js: "JavaScript",
                  javascript: "JavaScript",
                  ts: "TypeScript",
                  typescript: "TypeScript",
                  tsx: "TypeScript (React)",
                  jsx: "JavaScript (React)",
                  css: "CSS",
                  html: "HTML",
                  xml: "XML",
                  json: "JSON",
                  python: "Python",
                  py: "Python",
                  bash: "Bash",
                  sh: "Shell",
                  shell: "Shell",
                  powershell: "PowerShell",
                  sql: "SQL",
                  yaml: "YAML",
                  yml: "YAML",
                  toml: "TOML",
                  markdown: "Markdown",
                  md: "Markdown",
                  go: "Go",
                  golang: "Go",
                  rust: "Rust",
                  java: "Java",
                  kotlin: "Kotlin",
                  swift: "Swift",
                  c: "C",
                  cpp: "C++",
                  csharp: "C#",
                  php: "PHP",
                  ruby: "Ruby",
                  dockerfile: "Dockerfile",
                  diff: "Diff",
                  latex: "LaTeX",
                  tex: "LaTeX",
                  lua: "Lua",
                  perl: "Perl",
                  r: "R",
                  dart: "Dart",
                },
              }),
              diffSourcePlugin({
                diffMarkdown: diffMarkdown ?? markdown,
                viewMode: "rich-text",
              }),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <LexicalEditorCapture targetRef={lexicalEditorRef} onEditor={setLexicalEditor} />
                    <LinkEditBridge onEditLink={handleEditLink} />
                    <ConditionalContents
                      options={[
                        {
                          when: (editor) => editor?.editorType === "codeblock",
                          contents: () => <ChangeCodeMirrorLanguage />,
                        },
                        {
                          fallback: () => (
                            <>
                              {/* History */}
                              <UndoRedo />
                              <ToolbarSeparator />

                              {/* Text formatting */}
                              <BoldItalicUnderlineToggles />
                              <button
                                type="button"
                                title="Insert link"
                                className="flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-4"
                                onClick={() => {
                                  const editor = lexicalEditorRef.current
                                  let selText = ""
                                  let hasSel = false
                                  if (editor) {
                                    editor.getEditorState().read(() => {
                                      const sel = $getSelection()
                                      if ($isRangeSelection(sel) && !sel.isCollapsed()) {
                                        selText = sel.getTextContent()
                                        hasSel = true
                                      }
                                    })
                                  }
                                  setLinkInitialText(selText)
                                  setHasSelectionForLink(hasSel)
                                  setLinkDialogOpen(true)
                                }}
                              >
                                <Link />
                              </button>
                              <ToolbarSeparator />

                              {/* Block type & structure */}
                              <BlockTypeSelect />
                              <ListsToggle />
                              <InsertTable />
                              <InsertAdmonition />
                              <ToolbarSeparator />

                              {/* Media & diagrams */}
                              <InsertImage />
                              <MermaidEditorDialog
                                repoSlug={repoSlug}
                                filePath={filePath}
                                editRequest={mermaidEditRequest}
                                onEditHandled={handleMermaidEditHandled}
                                onDiagramSaved={onDiagramSaved}
                              />
                              <DrawioEditorDialog
                                repoSlug={repoSlug}
                                filePath={filePath}
                                editRequest={drawioEditRequest}
                                onEditHandled={handleDrawioEditHandled}
                                onDiagramSaved={onDiagramSaved}
                              />
                              <ToolbarSeparator />

                              {/* Code & embeds */}
                              <InsertCodeBlock />
                              <InsertSandpack />
                              <ToolbarSeparator />

                              {/* Document */}
                              <InsertFrontmatter />
                              <InsertTocButton editorRef={editorRef} />
                              <ToolbarSeparator />

                              {/* Search */}
                              <SearchToolbar />
                            </>
                          ),
                        },
                      ]}
                    />
                  </>
                ),
              }),
            ]}
          />
          {!readOnly && lexicalEditor && <SpellCheckPlugin editor={lexicalEditor} />}
      </div>

      {/* Monaco source editor */}
      {viewMode === "source" && (
        <SharedMonacoEditor
          language="markdown"
          value={monacoContent}
          onChange={setMonacoContent}
          readOnly={readOnly}
          onEditorRef={handleMonacoEditorRef}
        />
      )}

      {/* Monaco diff editor */}
      {viewMode === "diff" && diffMarkdown != null && (
        <SharedMonacoEditor
          language="markdown"
          value={monacoContent}
          diffOriginal={diffMarkdown}
          readOnly
          onEditorRef={handleMonacoEditorRef}
        />
      )}

      <InsertLinkDialog
        open={linkDialogOpen}
        onOpenChange={handleLinkDialogClose}
        repos={repos}
        currentRepoSlug={repoSlug}
        filePath={filePath}
        initialText={linkInitialText}
        editingUrl={editingLink?.url}
        editingText={editingLink?.text}
        onInsert={handleInsertLink}
      />
    </div>
  )
})
