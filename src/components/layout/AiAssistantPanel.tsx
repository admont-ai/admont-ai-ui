import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, BookOpenText, ChevronDown, FileText, Library, Loader2, MessageSquarePlus, MessageSquareText, Sparkles, Trash2, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { authFetch } from "@/lib/auth-fetch"
import { useAiLog } from "@/hooks/use-ai-log"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MarkdownEditorHandle } from "./MarkdownEditor"
import type { AiMessage, DiagramSourceHandle, Repo } from "@/types"

type Scope = "page" | "repo" | "all"

const SCOPES: { value: Scope; label: string; icon: typeof FileText }[] = [
  { value: "page", label: "This page", icon: FileText },
  { value: "repo", label: "This repo", icon: BookOpenText },
  { value: "all", label: "All docs", icon: Library },
]

interface AiAssistantPanelProps {
  editorRef: RefObject<MarkdownEditorHandle | null>
  diagramRef?: RefObject<DiagramSourceHandle | null>
  selectedText: string
  repos: Repo[]
  repoSlug: string
  filePath: string
  onClose: () => void
  onNavigate?: (repoSlug: string, filePath: string) => void
  onFilesChanged?: (paths: string[]) => void
}

/** Diagram file type of the current file, or null for text/markdown files. */
function diagramTypeOf(filePath: string): "mermaid" | "drawio" | null {
  const lower = filePath.toLowerCase()
  if (lower.endsWith(".mmd")) return "mermaid"
  if (lower.endsWith(".drawio")) return "drawio"
  return null
}

/** Whether the current file exposes its page content via the source handle
 * (diagrams and spreadsheets) instead of the markdown editor. */
function usesSourceHandle(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return diagramTypeOf(filePath) !== null || lower.endsWith(".xlsx") || lower.endsWith(".csv")
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const SUGGESTIONS = [
  { icon: MessageSquareText, text: "Can you take this page and write it in a less technical way?" },
  { icon: MessageSquareText, text: "What are the key takeaways from this page?" },
  { icon: MessageSquareText, text: "Summarize the selected text in bullet points." },
]

const READ_TOOLS = [
  { icon: BookOpenText, label: "Summarize", action: "summarize" },
  { icon: MessageSquareText, label: "Explain", action: "explain" },
]

export function AiAssistantPanel({
  editorRef,
  diagramRef,
  selectedText,
  repos,
  repoSlug,
  filePath,
  onClose,
  onNavigate,
  onFilesChanged,
}: AiAssistantPanelProps) {
  const {
    selectedModel,
    conversations, activeConversationId, activeMessages,
    createConversation, switchConversation, deleteConversation,
    addMessage, refreshConversations,
  } = useAiLog()
  const { user } = useAuth()
  const [mode, setMode] = useState<"ask" | "edit">("ask")
  const [scope, setScope] = useState<Scope>("all")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [streamingResponse, setStreamingResponse] = useState("")
  const [liveSelection, setLiveSelection] = useState(selectedText)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLiveSelection(selectedText)
  }, [selectedText])

  useEffect(() => {
    const interval = setInterval(() => {
      const sel = window.getSelection()?.toString() ?? ""
      setLiveSelection(sel)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const currentSelection = liveSelection.trim()
  const hasSelection = currentSelection.length > 0
  const hasConversation = activeMessages.length > 0 || !!streamingResponse
  const diagramType = diagramTypeOf(filePath)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages.length, streamingResponse])

  // Read-only LLM request whose result is shown in the panel (Summarize tool).
  const sendRequest = useCallback(async (requestBody: Record<string, unknown>) => {
    if (loading) return
    setLoading(true)
    setStreamingResponse("")
    try {
      const res = await authFetch("/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, model: selectedModel || undefined }),
      })
      if (!res.ok) return
      const data = await res.json()
      setStreamingResponse(data.content ?? data.answer ?? "")
      setInput("")
    } catch {
      // errors handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [selectedModel, loading])

  const sendRagSearch = useCallback(async (query: string, context?: string) => {
    if (loading || !query.trim()) return
    setLoading(true)
    setStreamingResponse("")
    try {
      // Ensure we have a conversation
      let convId = activeConversationId
      if (!convId) {
        convId = await createConversation(scope, repoSlug, filePath)
      }

      // Build history from active messages
      const history = activeMessages
        .filter((m) => m.role !== "summary" || m.role === "summary")
        .map((m) => ({ role: m.role === "summary" ? "user" : m.role, content: m.content }))

      let ragRepos: { name: string; path: string }[]
      switch (scope) {
        case "page":
          ragRepos = []
          break
        case "repo":
          ragRepos = [{ name: repoSlug, path: "" }]
          break
        default:
          ragRepos = repos.map((r) => ({ name: r.slug, path: "" }))
      }

      // Add user message optimistically
      const userMsg: AiMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content: query,
        created_at: new Date().toISOString(),
      }
      addMessage(userMsg)

      const res = await authFetch("/repos/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: ragRepos,
          query,
          context: context || undefined,
          model: selectedModel || undefined,
          top_k: 10,
          conversation_id: convId,
          history: history.length > 0 ? history : undefined,
        }),
      })
      if (!res.ok) return
      const data = await res.json()

      // Add assistant message
      const assistantMsg: AiMessage = {
        id: data.message_id || `temp-${Date.now()}-reply`,
        conversation_id: convId,
        role: "assistant",
        content: data.answer ?? "",
        sources: data.sources ?? [],
        token_usage: data.usage,
        created_at: new Date().toISOString(),
      }
      addMessage(assistantMsg)
      refreshConversations()
      setInput("")
    } catch {
      // errors handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [loading, repos, repoSlug, scope, selectedModel, activeConversationId, activeMessages, createConversation, addMessage, refreshConversations, filePath])

  // Agentic edit mode: the backend runs a tool loop that can create and
  // update files in the current repo.
  const sendAgentRequest = useCallback(async (query: string) => {
    if (loading || !query.trim() || !repoSlug) return
    setLoading(true)
    setStreamingResponse("")
    try {
      let convId = activeConversationId
      if (!convId) {
        convId = await createConversation("repo", repoSlug, filePath)
      }

      const history = activeMessages.map((m) => ({
        role: m.role === "summary" ? "user" : m.role,
        content: m.content,
      }))

      addMessage({
        id: `temp-${Date.now()}`,
        conversation_id: convId,
        role: "user",
        content: query,
        created_at: new Date().toISOString(),
      })

      const res = await authFetch(`/repos/${encodeURIComponent(repoSlug)}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          model: selectedModel || undefined,
          conversation_id: convId,
          history: history.length > 0 ? history : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.detail ?? data.error ?? "Agent request failed")
        return
      }

      addMessage({
        id: data.message_id || `temp-${Date.now()}-reply`,
        conversation_id: convId,
        role: "assistant",
        content: data.answer ?? "",
        actions: data.actions ?? [],
        token_usage: data.usage,
        created_at: new Date().toISOString(),
      })
      refreshConversations()
      setInput("")

      const changed = ((data.actions ?? []) as { path?: string; status: string }[])
        .filter((a) => a.status === "ok" && a.path)
        .map((a) => a.path as string)
      if (changed.length > 0) onFilesChanged?.(changed)
    } catch {
      // network errors handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [loading, repoSlug, filePath, activeConversationId, activeMessages, selectedModel, createConversation, addMessage, refreshConversations, onFilesChanged])

  const handleSubmit = useCallback(async (overrideInput?: string) => {
    const text = overrideInput ?? input
    if (mode === "edit") {
      await sendAgentRequest(text)
      return
    }
    const pageContent = usesSourceHandle(filePath)
      ? diagramRef?.current?.getSource() ?? ""
      : editorRef.current?.getMarkdown() ?? ""
    let context: string | undefined
    if (liveSelection && scope === "page" && pageContent) {
      context = `[Current page: ${filePath}]\n${pageContent}\n\n[Selected text]\n${liveSelection}`
    } else if (liveSelection) {
      context = `[Selected text from ${filePath}]\n${liveSelection}`
    } else if (pageContent) {
      context = `[Current page: ${filePath}]\n${pageContent}`
    }
    await sendRagSearch(text, context)
  }, [mode, scope, input, liveSelection, filePath, editorRef, diagramRef, sendRagSearch, sendAgentRequest])

  const handleSuggestionClick = useCallback((text: string) => {
    setInput(text)
    const pageContent = editorRef.current?.getMarkdown() ?? ""
    const context = liveSelection
      ? `[Selected text from ${filePath}]\n${liveSelection}`
      : pageContent
        ? `[Current page: ${filePath}]\n${pageContent}`
        : undefined
    sendRagSearch(text, context)
  }, [liveSelection, filePath, editorRef, sendRagSearch])

  const handleQuickTool = useCallback((tool: { action: string }) => {
    if (tool.action === "summarize") {
      sendRequest({ action: "summarize", content: liveSelection })
    } else {
      sendRagSearch(`Explain the following text:\n\n${liveSelection}`)
    }
  }, [liveSelection, sendRequest, sendRagSearch])

  const handleNewConversation = useCallback(() => {
    switchConversation(null)
    setStreamingResponse("")
  }, [switchConversation])

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(id)
  }, [deleteConversation])

  const canSubmit = input.trim().length > 0
  const firstName = user?.name?.split(" ")[0] ?? ""
  const activeConv = conversations.find((c) => c.id === activeConversationId)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header with conversation selector */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm font-medium truncate hover:text-foreground/80">
                <span className="truncate">{activeConv?.title || "New conversation"}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={handleNewConversation}>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                New conversation
              </DropdownMenuItem>
              {conversations.length > 0 && <DropdownMenuSeparator />}
              {conversations.map((conv) => (
                <DropdownMenuItem
                  key={conv.id}
                  onClick={() => switchConversation(conv.id)}
                  className="flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{conv.title || "Untitled"}</div>
                    <div className="text-[10px] text-muted-foreground">{relativeTime(conv.updated_at)}</div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="ml-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          {hasConversation && (
            <Button variant="ghost" size="icon-sm" title="New conversation" onClick={handleNewConversation} className="[&_svg]:size-3.5">
              <MessageSquarePlus />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" title="Close" onClick={onClose} className="[&_svg]:size-3.5">
            <X />
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {!hasConversation ? (
          <div className="flex h-full flex-col">
            <div className="flex-1" />
            <div className="flex flex-col items-center px-6 pb-4">
              <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h2 className="text-xl font-semibold tracking-tight mb-1">
                {firstName ? `How can I help, ${firstName}?` : "How can I help?"}
              </h2>
            </div>
            <div className="space-y-1 px-4 pb-4">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s.text)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {activeMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onNavigate={onNavigate} />
            ))}
            {loading && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {mode === "edit" ? "Working…" : "Thinking…"}
                </div>
              </div>
            )}
            {streamingResponse && (
              <div className="px-4 py-3">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingResponse}</ReactMarkdown>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bottom input area */}
      <div className="border-t bg-muted/30 px-3 py-3">
        {repoSlug && (
          <div className="flex gap-1 mb-2">
            {(["ask", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
                  (mode === m
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {m === "ask" ? "Ask" : "Edit"}
              </button>
            ))}
          </div>
        )}

        {hasSelection && !loading && !diagramType && mode === "ask" && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {READ_TOOLS.map((tool) => (
              <button
                key={tool.label}
                onClick={() => handleQuickTool(tool)}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <tool.icon className="h-3 w-3" />
                {tool.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border bg-background shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "edit" ? "Describe what to create or change…" : "Ask a question…"}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (canSubmit && !loading) handleSubmit()
              }
            }}
            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <div className="flex items-center gap-0.5 min-w-0">
              {mode === "ask" && repos.some((r) => r.search_provider) && (
                <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                  <SelectTrigger
                    size="sm"
                    className="h-7 gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:text-foreground [&>svg]:size-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" align="start">
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-1.5">
                          <s.icon className="h-3 w-3" />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={!canSubmit || loading}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-opacity disabled:opacity-30"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message, onNavigate }: { message: AiMessage; onNavigate?: (repoSlug: string, filePath: string) => void }) {
  if (message.role === "summary") {
    return (
      <div className="px-4 py-2">
        <div className="text-[10px] text-muted-foreground text-center italic">Earlier conversation summarized</div>
      </div>
    )
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[85%]">
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
          <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground">Assistant</span>
        <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
        {message.token_usage && (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {message.token_usage.input_tokens}↑ {message.token_usage.output_tokens}↓
          </span>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      {message.actions && message.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.actions.map((a, i) => (
            <span
              key={i}
              title={a.status !== "ok" ? a.status : undefined}
              className={
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] " +
                (a.status === "ok" ? "text-foreground" : "text-destructive")
              }
            >
              {a.status === "ok" ? "✓" : "✗"} {a.tool === "create_file" ? "Created" : "Updated"} {a.path}
            </span>
          ))}
        </div>
      )}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground mb-1">Sources</div>
          {message.sources.map((src, i) => (
            <button
              key={i}
              onClick={() => onNavigate?.(src.repo, src.file_path)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <span className="font-medium text-foreground">[{i + 1}] {src.file_path.split("/").pop()}</span>
                <span className="ml-1.5 text-muted-foreground">{src.repo}</span>
                {src.score > 0 && <span className="ml-1.5 text-muted-foreground/60">{(src.score * 100).toFixed(0)}%</span>}
                <p className="mt-0.5 text-muted-foreground line-clamp-2">{src.chunk}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
