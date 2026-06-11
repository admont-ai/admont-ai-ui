import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setFilename("")
      setFileType(FILE_TYPES[0])
      setAiPrompt("")
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
        if (res.ok) {
          const data = await res.json()
          content = data.content ?? data.answer ?? ""
          addEntry({
            action: "generate",
            input: aiPrompt,
            summary: data.summary ?? content.slice(0, 200),
            usage: data.usage,
          })
        }
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

  const canSubmit = filename.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
          <div className="space-y-1">
            <label htmlFor="new-doc-ai-prompt" className="text-sm font-medium">
              AI prompt <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="new-doc-ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe what to generate…"
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
