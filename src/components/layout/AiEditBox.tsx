import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, Loader2, Pencil, Scissors, Sparkles, SpellCheck, X } from "lucide-react"
import { toast } from "sonner"

import { authFetch } from "@/lib/auth-fetch"
import { useAiLog } from "@/hooks/use-ai-log"
import { Button } from "@/components/ui/button"
import type { MarkdownEditorHandle } from "./MarkdownEditor"

const QUICK_ACTIONS = [
  { icon: Pencil, label: "Improve writing", action: "improve" },
  { icon: SpellCheck, label: "Fix spelling & grammar", action: "fix_spelling" },
  { icon: Scissors, label: "Shorten", action: "shorten" },
]

interface AiEditBoxProps {
  /** Markdown mode: edits the document via the markdown editor handle. */
  editorRef?: RefObject<MarkdownEditorHandle | null>
  /** Diagram mode: edits the diagram source as a whole. */
  fileType?: "mermaid" | "drawio"
  getDiagramSource?: () => string
  onDiagramResult?: (source: string) => void
}

/**
 * Collapsible AI prompt box floating over the editor in edit mode.
 * Markdown: improves the current selection, or generates content at the
 * cursor when nothing is selected. Diagrams: modifies the diagram source.
 */
export function AiEditBox({ editorRef, fileType, getDiagramSource, onDiagramResult }: AiEditBoxProps) {
  const { selectedModel, addEntry } = useAiLog()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [hasSelection, setHasSelection] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDiagram = !!fileType

  // Track the editor text selection so the box can switch between
  // "improve selection" and "generate at cursor" (markdown mode only).
  useEffect(() => {
    if (!open || isDiagram) return
    const interval = setInterval(() => {
      const sel = editorRef?.current?.getSelectionMarkdown() ?? ""
      setHasSelection(sel.trim().length > 0)
    }, 500)
    return () => clearInterval(interval)
  }, [open, isDiagram, editorRef])

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  // The drawio embed iframe aggressively grabs keyboard focus (e.g. after its
  // init/load handshake), which silently swallows typing into this box. While
  // the box is open, pull focus back whenever it escapes into an iframe —
  // that's exactly when the window fires "blur".
  useEffect(() => {
    if (!open) return
    const reclaimFocus = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") {
          textareaRef.current?.focus()
        }
      }, 0)
    }
    window.addEventListener("blur", reclaimFocus)
    return () => window.removeEventListener("blur", reclaimFocus)
  }, [open])

  const runRequest = useCallback(
    async (body: Record<string, unknown>, apply: (result: string, data: Record<string, unknown>) => Promise<void> | void) => {
      if (loading) return
      setLoading(true)
      setNotes("")
      try {
        const res = await authFetch("/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, model: selectedModel || undefined }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data.detail ?? data.error ?? "AI request failed")
          return
        }
        const result: string = data.content ?? ""
        if (!result.trim()) {
          toast.error("The model returned no content.")
          return
        }
        await apply(result, data)
        if (data.notes) setNotes(data.notes)
        setInput("")
      } catch {
        // network errors handled by authFetch
      } finally {
        setLoading(false)
      }
    },
    [loading, selectedModel],
  )

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    if (isDiagram) {
      const source = getDiagramSource?.() ?? ""
      if (!source.trim()) {
        // Empty diagram — generate a new one from the prompt.
        await runRequest(
          { action: "generate", prompt: text, file_type: fileType },
          (result, data) => {
            onDiagramResult?.(result)
            addEntry({ action: "generate", input: text, summary: (data.summary as string) ?? "", usage: data.usage as never })
          },
        )
        return
      }
      await runRequest(
        { action: "polish", content: source, instructions: text, file_type: fileType },
        (result, data) => {
          onDiagramResult?.(result)
          addEntry({ action: "polish", input: text, summary: (data.notes as string) ?? "", usage: data.usage as never })
        },
      )
      return
    }

    const selection = editorRef?.current?.getSelectionMarkdown() ?? ""
    if (selection.trim()) {
      editorRef?.current?.saveSelection()
      await runRequest(
        { action: "polish", content: selection, instructions: text },
        async (result, data) => {
          editorRef?.current?.focus()
          await new Promise((r) => setTimeout(r, 50))
          await editorRef?.current?.restoreSelection()
          editorRef?.current?.insertMarkdown(result)
          addEntry({ action: "polish", input: text, summary: (data.notes as string) ?? "", usage: data.usage as never })
        },
      )
    } else {
      editorRef?.current?.saveSelection()
      await runRequest(
        { action: "generate", prompt: text },
        async (result, data) => {
          editorRef?.current?.focus()
          await new Promise((r) => setTimeout(r, 50))
          await editorRef?.current?.restoreSelection()
          editorRef?.current?.insertMarkdown(result)
          addEntry({ action: "generate", input: text, summary: (data.summary as string) ?? "", usage: data.usage as never })
        },
      )
    }
  }, [input, loading, isDiagram, fileType, editorRef, getDiagramSource, onDiagramResult, runRequest, addEntry])

  const handleQuickAction = useCallback(async (action: string) => {
    const selection = editorRef?.current?.getSelectionMarkdown() ?? ""
    if (!selection.trim() || loading) return
    editorRef?.current?.saveSelection()
    await runRequest(
      { action, content: selection },
      async (result, data) => {
        editorRef?.current?.focus()
        await new Promise((r) => setTimeout(r, 50))
        await editorRef?.current?.restoreSelection()
        editorRef?.current?.insertMarkdown(result)
        addEntry({ action: "polish", input: action, summary: (data.notes as string) ?? "", usage: data.usage as never })
      },
    )
  }, [editorRef, loading, runRequest, addEntry])

  if (!open) {
    return (
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <Button
          size="icon"
          className="size-10 rounded-full shadow-lg"
          title="AI edit"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="size-4" />
        </Button>
      </div>
    )
  }

  const placeholder = isDiagram
    ? "Describe the changes to the diagram…"
    : hasSelection
      ? "How should the selection be changed?"
      : "Describe what to write or change…"

  return (
    <div className="absolute bottom-4 left-1/2 z-10 w-full max-w-xl -translate-x-1/2 px-4">
      <div className="rounded-xl border bg-background shadow-lg">
        <div className="flex items-start gap-2 p-2">
          <Sparkles className="mt-2.5 ml-1 size-4 shrink-0 text-muted-foreground" />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === "Escape") {
                setOpen(false)
              }
            }}
            className="flex-1 resize-none bg-transparent py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex shrink-0 flex-col gap-1">
            <button
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background transition-opacity disabled:opacity-30"
              title="Apply"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
            </button>
          </div>
        </div>
        {!isDiagram && hasSelection && !loading && (
          <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
            {QUICK_ACTIONS.map((tool) => (
              <button
                key={tool.action}
                onClick={() => handleQuickAction(tool.action)}
                className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <tool.icon className="size-3" />
                {tool.label}
              </button>
            ))}
          </div>
        )}
        {notes && (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{notes}</p>
        )}
      </div>
    </div>
  )
}
