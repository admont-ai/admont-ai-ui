import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { Square } from "lucide-react"

import { authFetch } from "@/lib/auth-fetch"
import { useAiLog } from "@/hooks/use-ai-log"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MarkdownEditorHandle } from "./MarkdownEditor"

type Mode = "ask" | "generate" | "polish"

interface AiAssistantDialogProps {
  editorRef: RefObject<MarkdownEditorHandle | null>
  readOnly?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText: string
}

export function AiAssistantDialog({
  editorRef,
  readOnly,
  open,
  onOpenChange,
  selectedText,
}: AiAssistantDialogProps) {
  const { addEntry, selectedModel } = useAiLog()
  const [mode, setMode] = useState<Mode>("ask")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const hasSelection = selectedText.trim().length > 0

  const availableModes: Mode[] = readOnly
    ? ["ask"]
    : hasSelection
      ? ["polish", "generate", "ask"]
      : ["generate"]

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode(availableModes[0])
      setInput("")
      setResponse("")
      setLoading(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort()
    onOpenChange(false)
  }, [onOpenChange])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleSubmit = useCallback(async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoading(true)
    try {
      let body: Record<string, unknown>
      if (mode === "ask") {
        const prompt = selectedText
          ? `Context:\n${selectedText}\n\nQuestion: ${input}`
          : input
        body = {
          action: "ask",
          prompt,
          model: selectedModel || undefined,
        }
      } else if (mode === "generate") {
        body = {
          action: "generate",
          prompt: input,
          model: selectedModel || undefined,
        }
      } else {
        body = {
          action: "polish",
          content: selectedText,
          instructions: input || undefined,
          model: selectedModel || undefined,
        }
      }

      const res = await authFetch("/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) return

      const data = await res.json()
      const raw: string = data.content ?? data.answer ?? ""

      if (mode === "ask") {
        setResponse(raw)
        addEntry({
          action: "generate",
          input: input,
          summary: data.summary ?? raw.slice(0, 200),
          usage: data.usage,
        })
      } else if (mode === "generate") {
        handleClose()
        await new Promise((r) => setTimeout(r, 100))
        editorRef.current?.focus()
        await new Promise((r) => setTimeout(r, 50))
        await editorRef.current?.restoreSelection()
        editorRef.current?.insertMarkdown(raw)
        addEntry({
          action: "generate",
          input: input,
          summary: data.summary ?? "",
          usage: data.usage,
        })
      } else {
        const current = editorRef.current?.getMarkdown() ?? ""
        const updated = current.replace(selectedText, raw)
        editorRef.current?.setMarkdown(updated)
        addEntry({
          action: "polish",
          input: input,
          summary: data.notes ?? "",
          usage: data.usage,
        })
        handleClose()
      }
    } catch {
      // errors handled by authFetch; aborts are silent
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [mode, input, selectedText, selectedModel, editorRef, handleClose, addEntry])

  const canSubmit =
    mode === "polish"
      ? hasSelection
      : input.trim().length > 0

  const modeLabel = mode === "ask" ? "Ask" : mode === "generate" ? "Generate" : "Polish"
  const loadingLabel =
    mode === "ask" ? "Asking…" : mode === "generate" ? "Generating…" : "Polishing…"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI {modeLabel}</DialogTitle>
        </DialogHeader>

        {availableModes.length > 1 && (
          <div className="flex gap-1">
            {availableModes.map((m) => (
              <Button
                key={m}
                variant={mode === m ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setMode(m)
                  setResponse("")
                }}
                className="text-xs capitalize"
              >
                {m}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {(mode === "ask" || mode === "polish") && hasSelection && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Selected text</label>
              <div className="bg-muted border-input max-h-40 overflow-auto rounded-md border px-3 py-2 font-mono text-sm whitespace-pre-wrap">
                {selectedText}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="ai-input" className="text-sm font-medium">
              {mode === "ask"
                ? "Question"
                : mode === "generate"
                  ? "Prompt"
                  : "Instructions (optional)"}
            </label>
            <textarea
              id="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === "ask"
                  ? "Ask a question about the selected text…"
                  : mode === "generate"
                    ? "Describe what content to generate…"
                    : "E.g., make it more concise, fix grammar…"
              }
              rows={mode === "generate" ? 4 : 3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (canSubmit && !loading) handleSubmit()
                }
              }}
              className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          {mode === "ask" && response && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Response</label>
              <div className="bg-muted border-input max-h-60 overflow-auto rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
                {response}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {mode === "ask" && response ? "Close" : "Cancel"}
          </Button>
          {loading ? (
            <Button variant="ai" onClick={handleStop}>
              <Square className="mr-2 h-3.5 w-3.5 fill-current" />
              {loadingLabel}
            </Button>
          ) : (
            <Button variant="ai" onClick={handleSubmit} disabled={!canSubmit}>
              {modeLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
