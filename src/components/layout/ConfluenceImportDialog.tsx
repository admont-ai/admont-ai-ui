import { FileUp, Loader2, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { authFetch } from "@/lib/auth-fetch"
import type { Repo } from "@/types"

interface ImportResult {
  pages_imported: number
  attachments_imported: number
  errors: { file: string; message: string }[]
}

export function ConfluenceImportDialog({
  open,
  onOpenChange,
  repos,
  defaultRepoSlug,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repos: Repo[]
  defaultRepoSlug?: string
  onDone?: () => void
}) {
  const [repoSlug, setRepoSlug] = useState(defaultRepoSlug ?? repos[0]?.slug ?? "")
  const [targetPath, setTargetPath] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
  }, [])

  const handleClose = useCallback((v: boolean) => {
    if (!v) {
      reset()
      setTargetPath("")
    }
    onOpenChange(v)
  }, [onOpenChange, reset])

  const handleFile = useCallback((f: File | null) => {
    if (f && !f.name.endsWith(".zip")) {
      toast.error("Please select a .zip file")
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleImport = useCallback(async () => {
    if (!file || !repoSlug) return
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (targetPath.trim()) formData.append("target_path", targetPath.trim())

      const res = await authFetch(`/repos/${encodeURIComponent(repoSlug)}/import/confluence`, {
        method: "POST",
        body: formData,
      })
      if (res.ok) {
        const data: ImportResult = await res.json()
        setResult(data)
        toast.success(`Imported ${data.pages_imported} pages, ${data.attachments_imported} attachments`)
        onDone?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setImporting(false)
    }
  }, [file, repoSlug, targetPath, onDone])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Confluence Space</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Repo selector */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Repository</label>
            <Select value={repoSlug} onValueChange={setRepoSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Select repository" />
              </SelectTrigger>
              <SelectContent>
                {repos.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>{r.name || r.slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target path */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Target path <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g. imported/confluence"
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* File drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors " +
                (dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50")
              }
            >
              <Upload className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Drag & drop a Confluence export (.zip) or <span className="text-foreground font-medium">browse</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
              <FileUp className="size-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={reset} disabled={importing}>
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex gap-4 text-sm">
                <span><strong>{result.pages_imported}</strong> pages imported</span>
                <span><strong>{result.attachments_imported}</strong> attachments</span>
              </div>
              {result.errors?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1">{result.errors.length} error{result.errors.length > 1 ? "s" : ""}:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">{err.file}</span>: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={importing}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button size="sm" onClick={handleImport} disabled={!file || !repoSlug || importing}>
                {importing && <Loader2 className="size-4 animate-spin" />}
                Import
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
