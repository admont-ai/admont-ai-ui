import { type RefObject, useCallback, useRef, useState } from "react"
import { Sparkles, Square } from "lucide-react"
import type { MDXEditorMethods } from "@mdxeditor/editor"
import { useCellValue, activeEditor$ } from "@mdxeditor/editor"
import { $getSelection, $setSelection } from "lexical"
import type { BaseSelection, LexicalEditor } from "lexical"

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

type Mode = "generate" | "polish"

interface AiDialogProps {
  editorRef: RefObject<MDXEditorMethods | null>
}

export function AiDialog({ editorRef }: AiDialogProps) {
  const { addEntry, selectedModel } = useAiLog()
  const activeEditor = useCellValue(activeEditor$)
  const savedEditorRef = useRef<LexicalEditor | null>(null)
  const savedSelectionRef = useRef<BaseSelection | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("generate")
  const [selectedText, setSelectedText] = useState("")
  const [prompt, setPrompt] = useState("")
  const [instructions, setInstructions] = useState("")
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleOpen = useCallback(() => {
    // Save the current Lexical editor and selection before the dialog steals focus
    savedEditorRef.current = activeEditor ?? null
    if (activeEditor) {
      activeEditor.getEditorState().read(() => {
        const sel = $getSelection()
        savedSelectionRef.current = sel ? sel.clone() : null
      })
    }

    const selection = editorRef.current?.getSelectionMarkdown?.() ?? ""
    if (selection.trim()) {
      setMode("polish")
      setSelectedText(selection)
    } else {
      setMode("generate")
      setSelectedText("")
    }
    setPrompt("")
    setInstructions("")
    setOpen(true)
  }, [editorRef, activeEditor])

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort()
    setOpen(false)
    savedEditorRef.current = null
    savedSelectionRef.current = null
  }, [])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleSubmit = useCallback(async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoading(true)
    try {
      const body =
        mode === "generate"
          ? { action: "generate" as const, prompt, model: selectedModel || undefined }
          : { action: "polish" as const, content: selectedText, instructions: instructions || undefined, model: selectedModel || undefined }

      const res = await authFetch("/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) return

      const data = await res.json()
      console.log("[AI response]", data)
      const raw: string = data.content

      if (mode === "generate") {
        // Capture saved refs before closing the dialog (which may clear them)
        const savedEditor = savedEditorRef.current
        const savedSelection = savedSelectionRef.current

        setOpen(false)
        await new Promise((r) => setTimeout(r, 100))
        editorRef.current?.focus()
        await new Promise((r) => setTimeout(r, 50))

        // Restore the saved Lexical selection so insertMarkdown inserts
        // at the original cursor position, not at the end of the document
        if (savedEditor && savedSelection) {
          savedEditor.update(() => {
            $setSelection(savedSelection.clone())
          })
          await new Promise((r) => setTimeout(r, 50))
        }

        editorRef.current?.insertMarkdown(raw)
        addEntry({ action: "generate", input: prompt, summary: data.summary ?? "", usage: data.usage })
      } else {
        const current = editorRef.current?.getMarkdown() ?? ""
        const updated = current.replace(selectedText, raw)
        editorRef.current?.setMarkdown(updated)
        addEntry({ action: "polish", input: instructions, summary: data.notes ?? "", usage: data.usage })
        handleClose()
      }
    } catch {
      // errors are already toasted by authFetch; aborts are silent
    } finally {
      setLoading(false)
      abortControllerRef.current = null
      savedEditorRef.current = null
      savedSelectionRef.current = null
    }
  }, [mode, prompt, selectedText, instructions, selectedModel, editorRef, handleClose, addEntry])

  const canSubmit =
    mode === "generate" ? prompt.trim().length > 0 : selectedText.trim().length > 0

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="AI Assistant"
        onMouseDown={(e) => {
          e.preventDefault() // keep focus in editor so we can read cursor position
          handleOpen()
        }}
        className="[&_svg]:size-4"
      >
        <Sparkles className="text-teal-primary" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "generate" ? "AI Generate" : "AI Polish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {mode === "generate" ? (
              <div className="space-y-1">
                <label htmlFor="ai-prompt" className="text-sm font-medium">
                  Prompt
                </label>
                <textarea
                  id="ai-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what content to generate..."
                  rows={4}
                  className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Selected text</label>
                  <div className="bg-muted border-input max-h-40 overflow-auto rounded-md border px-3 py-2 font-mono text-sm whitespace-pre-wrap">
                    {selectedText}
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="ai-instructions" className="text-sm font-medium">
                    Instructions (optional)
                  </label>
                  <textarea
                    id="ai-instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="E.g., make it more concise, fix grammar..."
                    rows={3}
                    className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {loading ? (
              <Button variant="ai" onClick={handleStop}>
                <Square className="mr-2 h-3.5 w-3.5 fill-current" />
                {mode === "generate" ? "Generating..." : "Polishing..."}
              </Button>
            ) : (
              <Button variant="ai" onClick={handleSubmit} disabled={!canSubmit}>
                {mode === "generate" ? "Generate" : "Polish"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
