import { useRef, useEffect } from "react"
import { Sparkles, Trash2, ChevronDown } from "lucide-react"
import { useAiLog, type AiLogEntry } from "@/hooks/use-ai-log"
import { Button } from "@/components/ui/button"

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function LogEntry({ entry }: { entry: AiLogEntry }) {
  return (
    <div className="border-b px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <span className={
          "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium " +
          (entry.action === "generate"
            ? "bg-teal-primary text-teal-foreground"
            : "bg-teal-light text-teal-primary")
        }>
          {entry.action}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {formatTime(entry.timestamp)}
            </span>
            {entry.input && (
              <span className="text-muted-foreground truncate text-xs italic">
                {entry.input}
              </span>
            )}
          </div>
          {entry.summary && (
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {entry.summary}
            </p>
          )}
          {entry.usage && (
            <p className="text-muted-foreground mt-1 text-xs">
              Tokens: {entry.usage.input_tokens} in / {entry.usage.output_tokens} out
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface AiLogPanelProps {
  onCollapse: () => void
}

export function AiLogPanel({ onCollapse }: AiLogPanelProps) {
  const { entries, clearEntries } = useAiLog()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries.length])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b flex items-center justify-between px-4 py-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-teal-primary h-4 w-4" />
          <span className="text-sm font-medium">AI Log</span>
          {entries.length > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs">
              {entries.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Clear log"
              onClick={clearEntries}
              className="[&_svg]:size-3.5"
            >
              <Trash2 />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Collapse"
            onClick={onCollapse}
            className="[&_svg]:size-3.5"
          >
            <ChevronDown />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            AI actions will appear here.
          </p>
        ) : (
          <>
            {entries.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}
