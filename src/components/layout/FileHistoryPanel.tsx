import { History, X } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { useFileHistory } from "@/hooks/use-file-history"
import type { FileHistoryEntry } from "@/types"

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return date.toLocaleDateString()
}

function HistoryEntry({
  entry,
  selected,
  onSelect,
}: {
  entry: FileHistoryEntry
  selected: boolean
  onSelect: (entry: FileHistoryEntry) => void
}) {
  return (
    <button
      type="button"
      className={`w-full text-left border-b px-4 py-3 last:border-b-0 hover:bg-accent/50 transition-colors ${
        selected ? "bg-accent" : ""
      }`}
      onClick={() => onSelect(entry)}
    >
      <p className="text-sm font-medium leading-snug">{entry.message}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{entry.author}</span>
        <span>&middot;</span>
        <span>{formatRelativeDate(entry.date)}</span>
        <span>&middot;</span>
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{entry.commit_hash.slice(0, 7)}</code>
      </div>
    </button>
  )
}

interface FileHistoryPanelProps {
  repoSlug: string
  filePath: string
  selectedCommit: string | null
  onSelectCommit: (entry: FileHistoryEntry) => void
  onClose: () => void
}

export function FileHistoryPanel({
  repoSlug,
  filePath,
  selectedCommit,
  onSelectCommit,
  onClose,
}: FileHistoryPanelProps) {
  const { entries, loading, error, fetch } = useFileHistory(repoSlug, filePath)

  useEffect(() => {
    fetch()
  }, [fetch])

  return (
    <div className="flex h-full flex-col bg-muted">
      <div className="border-b flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Version History</span>
          {entries.length > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs">
              {entries.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Close"
          onClick={onClose}
          className="[&_svg]:size-3.5"
        >
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-muted-foreground p-4 text-center text-sm">Loading…</p>
        ) : error ? (
          <p className="p-4 text-center text-sm text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">No history available.</p>
        ) : (
          entries.map((entry) => (
            <HistoryEntry
              key={entry.commit_hash}
              entry={entry}
              selected={selectedCommit === entry.commit_hash}
              onSelect={onSelectCommit}
            />
          ))
        )}
      </div>
    </div>
  )
}
