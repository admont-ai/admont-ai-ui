import { useState } from "react"
import { Check, Copy, EllipsisVertical, FileDown, FilePenLine, History, Info, Pencil, Save, Send, Trash2, TriangleAlert, Undo2, X } from "lucide-react"
import type { AutosaveStatus } from "@/hooks/use-debounced-autosave"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FileInfo } from "@/hooks/use-document-content"

interface EditorHeaderProps {
  fileName: string
  /** Full repo-relative path of the file; shown as the title when provided. */
  filePath?: string
  editing?: boolean
  isDraft?: boolean
  lastModified?: string | null
  draftUpdatedAt?: string | null
  saving?: boolean
  publishing?: boolean
  canEdit?: boolean
  fileInfo?: FileInfo | null
  onEdit?: () => void
  onSave?: () => void
  onPublish?: () => void
  onDiscardDraft?: () => void
  onCancel?: () => void
  onShowHistory?: () => void
  onRename?: () => void
  onDelete?: () => void
  onExportPdf?: () => void
  children?: React.ReactNode
  // Rendered on the right, before the action buttons (e.g. the MD view toggle).
  rightSlot?: React.ReactNode
  // When set (markdown autosave), the manual save-draft button is hidden and
  // only autosave failures are surfaced.
  saveStatus?: AutosaveStatus
}

export function EditorHeader({
  fileName,
  filePath,
  editing = false,
  isDraft = false,
  lastModified = null,
  draftUpdatedAt = null,
  saving = false,
  publishing = false,
  canEdit = false,
  fileInfo = null,
  onEdit,
  onSave,
  onPublish,
  onDiscardDraft,
  onCancel,
  onShowHistory,
  onRename,
  onDelete,
  onExportPdf,
  children,
  rightSlot,
  saveStatus,
}: EditorHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fileInfoOpen, setFileInfoOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasMenu = !!(onShowHistory || onRename || onDelete || fileInfo || onExportPdf)

  const copyPath = () => {
    navigator.clipboard?.writeText(filePath ?? fileName).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }
  return (
    <header className="flex items-center justify-between border-b bg-background pl-6 pr-3 py-1.5">
      <div className="flex items-center gap-2 truncate">
        <h2 className="text-sm font-normal truncate" title={filePath ?? fileName}>{(filePath ?? fileName).replace(/\//g, " / ")}</h2>
        <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground" onClick={copyPath} title={copied ? "Copied!" : "Copy path"}>
          {copied ? <Check /> : <Copy />}
        </Button>
        {isDraft && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            Draft
          </span>
        )}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            {lastModified && (
              <time className="text-xs text-muted-foreground mr-2" dateTime={lastModified}>
                Last modified: {new Date(lastModified).toLocaleString()}
              </time>
            )}
            {rightSlot}
            {saveStatus !== undefined ? (
              <AutosaveIndicator status={saveStatus} />
            ) : onSave && (
              <Button variant="ghost" size="icon-sm" onClick={onSave} disabled={saving} title="Save draft">
                <Save />
              </Button>
            )}
            {onPublish && (
              <Button variant="ghost" size="icon-sm" onClick={onPublish} disabled={publishing || saving} title="Publish">
                <Send />
              </Button>
            )}
            {isDraft && onDiscardDraft && <DiscardDraftButton onDiscardDraft={onDiscardDraft} />}
            {onCancel && (
              <Button variant="ghost" size="icon-sm" onClick={onCancel} title="Cancel">
                <X />
              </Button>
            )}
          </>
        ) : (
          <>
            {isDraft && draftUpdatedAt && (
              <time className="text-xs text-muted-foreground" dateTime={draftUpdatedAt}>
                Draft saved: {new Date(draftUpdatedAt).toLocaleString()}
              </time>
            )}
            {!isDraft && lastModified && (
              <time className="text-xs text-muted-foreground" dateTime={lastModified}>
                Last modified: {new Date(lastModified).toLocaleString()}
              </time>
            )}
            {rightSlot}
            {isDraft && onPublish && (
              <Button variant="ghost" size="icon-sm" onClick={onPublish} title="Publish">
                <Send />
              </Button>
            )}
            {isDraft && onDiscardDraft && <DiscardDraftButton onDiscardDraft={onDiscardDraft} />}
            {canEdit && onEdit && (
              <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit">
                <Pencil />
              </Button>
            )}
            {hasMenu && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <EllipsisVertical />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1">
                  {onRename && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={onRename}
                    >
                      <FilePenLine className="h-4 w-4" />
                      Rename
                    </button>
                  )}
                  {fileInfo && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => setFileInfoOpen(true)}
                    >
                      <Info className="h-4 w-4" />
                      File info
                    </button>
                  )}
                  {onShowHistory && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={onShowHistory}
                    >
                      <History className="h-4 w-4" />
                      Version history
                    </button>
                  )}
                  {onExportPdf && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={onExportPdf}
                    >
                      <FileDown className="h-4 w-4" />
                      Export as PDF
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {onDelete && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete file?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{fileName}</strong>? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <FileInfoDialog open={fileInfoOpen} onOpenChange={setFileInfoOpen} fileInfo={fileInfo} />
          </>
        )}
      </div>
    </header>
  )
}

const FILE_INFO_LABELS: { key: keyof FileInfo; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "path", label: "Path" },
  { key: "size", label: "Size" },
  { key: "permission", label: "Permission" },
  { key: "created_at", label: "Created" },
  { key: "last_modified", label: "Last modified" },
  { key: "last_author", label: "Last author" },
  { key: "last_author_email", label: "Author email" },
  { key: "last_message", label: "Commit message" },
  { key: "last_commit_hash", label: "Commit" },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatValue(key: string, value: unknown): string {
  if (value == null) return "—"
  if (key === "size" && typeof value === "number") return formatFileSize(value)
  if ((key === "created_at" || key === "last_modified") && typeof value === "string") {
    return new Date(value).toLocaleString()
  }
  if (key === "last_commit_hash" && typeof value === "string") return value.slice(0, 12)
  return String(value)
}

function FileInfoDialog({
  open,
  onOpenChange,
  fileInfo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileInfo: FileInfo | null
}) {
  if (!fileInfo) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>File Info</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {FILE_INFO_LABELS.map(({ key, label }) => {
            const value = fileInfo[key]
            if (value == null && value === undefined) return null
            return (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0 w-28 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-all">{formatValue(key, value)}</dd>
              </div>
            )
          })}
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function DiscardDraftButton({ onDiscardDraft }: { onDiscardDraft: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Discard draft">
          <Undo2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard draft?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete your draft and revert to the published version. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscardDraft}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Only surfaces autosave failures; successful saves are silent.
function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status !== "error") return null
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive" title="Autosave failed; retrying">
      <TriangleAlert className="size-3.5" /> Save failed
    </span>
  )
}
