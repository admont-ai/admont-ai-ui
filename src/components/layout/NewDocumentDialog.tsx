import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const FILE_TYPES = [
  { label: "Markdown", extension: ".md", type: "markdown" },
  { label: "LaTeX", extension: ".tex", type: "latex" },
  { label: "Draw.io", extension: ".drawio", type: "drawio" },
  { label: "Mermaid", extension: ".mmd", type: "mermaid" },
  { label: "Excalidraw", extension: ".excalidraw", type: "excalidraw" },
  { label: "Text", extension: "", type: "text" },
] as const

type FileType = (typeof FILE_TYPES)[number]

interface NewDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (folderPath: string, name: string, content: string) => Promise<string>
  folderPath: string
}

export function NewDocumentDialog({
  open,
  onOpenChange,
  onCreate,
  folderPath,
}: NewDocumentDialogProps) {
  const { addEntry, selectedModel, aiAvailable } = useAiLog()
  const [filename, setFilename] = useState("")
  const [fileType, setFileType] = useState<FileType>(FILE_TYPES[0])
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiPromptExpanded, setAiPromptExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const aiPromptRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setFilename("")
      setFileType(FILE_TYPES[0])
      setAiPrompt("")
      setAiPromptExpanded(false)
      setLoading(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleCreate = useCallback(async () => {
    const trimmed = filename.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      let content = ""

      if (aiPrompt.trim()) {
        const res = await authFetch("/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            prompt: aiPrompt,
            file_type: fileType.type,
            model: selectedModel || undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          // Keep the dialog open and don't create an empty file.
          toast.error(data.detail ?? data.error ?? "AI generation failed")
          return
        }
        content = data.content ?? data.answer ?? ""
        if (!content.trim()) {
          toast.error("AI generation returned no content — the file was not created.")
          return
        }
        addEntry({
          action: "generate",
          input: aiPrompt,
          summary: data.summary ?? content.slice(0, 200),
          usage: data.usage,
        })
      }

      const fullFilename = fileType.extension ? trimmed + fileType.extension : trimmed
      await onCreate(folderPath, fullFilename, content)
      handleClose()
    } catch {
      // errors handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [filename, fileType, aiPrompt, selectedModel, folderPath, onCreate, handleClose, addEntry])

  const handleAiPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAiPrompt(e.target.value)
    const el = aiPromptRef.current
    if (el && !aiPromptExpanded && el.scrollHeight > el.clientHeight) {
      setAiPromptExpanded(true)
    }
  }, [aiPromptExpanded])

  const canSubmit = filename.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={`sm:max-w-lg flex flex-col ${aiPromptExpanded ? "h-[70vh]" : ""}`}>
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto -m-1.5 p-1.5 flex flex-col">
          <div className="space-y-1">
            <label htmlFor="new-doc-filename" className="text-sm font-medium">
              Filename
            </label>
            <input
              id="new-doc-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={fileType.extension ? "my-document" : "my-file.txt"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit && !loading) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              className="border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">File type</label>
            <Select
              value={fileType.label}
              onValueChange={(label) => {
                const found = FILE_TYPES.find((t) => t.label === label)
                if (found) setFileType(found)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPES.map((t) => (
                  <SelectItem key={t.label} value={t.label}>
                    {t.label}{t.extension ? ` (${t.extension})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {aiAvailable && (
          <div className={`space-y-1 ${aiPromptExpanded ? "flex-1 min-h-0 flex flex-col" : ""}`}>
            <label htmlFor="new-doc-ai-prompt" className="text-sm font-medium">
              AI prompt <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              ref={aiPromptRef}
              id="new-doc-ai-prompt"
              value={aiPrompt}
              onChange={handleAiPromptChange}
              placeholder="Describe what to generate…"
              rows={3}
              className={`border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${aiPromptExpanded ? "flex-1 min-h-0" : ""}`}
            />
          </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
