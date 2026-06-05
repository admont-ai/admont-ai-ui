import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"

import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UploadFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoSlug: string
  folderPath: string
  onUploaded: () => void
}

export function UploadFileDialog({
  open,
  onOpenChange,
  repoSlug,
  folderPath,
  onUploaded,
}: UploadFileDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFile(null)
      setUploading(false)
      setDragOver(false)
    }
  }, [open])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadPath = folderPath ? `${folderPath}/${file.name}` : file.name
      const url = `/repos/${encodeURIComponent(repoSlug)}/upload/${uploadPath}`
      const res = await authFetch(url, { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      await res.json()
      onUploaded()
      handleClose()
    } catch {
      // errors handled by authFetch
    } finally {
      setUploading(false)
    }
  }, [file, folderPath, repoSlug, onUploaded, handleClose])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-sm transition-colors ${
            dragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
          }`}
        >
          <Upload className="size-8 opacity-60" />
          {file ? (
            <span className="font-medium text-foreground">{file.name}</span>
          ) : (
            <span>Drop a file here or click to browse</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {folderPath && (
          <p className="text-xs text-muted-foreground">
            Uploading to <span className="font-medium">{folderPath}/</span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
