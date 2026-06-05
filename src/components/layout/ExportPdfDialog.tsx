import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PdfExportProgress } from "@/hooks/use-pdf-export"

interface ExportPdfDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderName: string
  progress: PdfExportProgress | null
  onCancel: () => void
}

export function ExportPdfDialog({
  open,
  onOpenChange,
  folderName,
  progress,
  onCancel,
}: ExportPdfDialogProps) {
  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Exporting folder as PDF</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Preparing <strong>{folderName}</strong>…
          </p>
          {progress && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {progress.current} / {progress.total} files
              </p>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
