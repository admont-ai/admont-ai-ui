import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, FileText, Link, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authFetch } from "@/lib/auth-fetch"
import type { Repo, SearchResult } from "@/types"

type LinkTab = "current" | "other" | "external"

interface InsertLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repos: Repo[]
  currentRepoSlug: string
  filePath: string
  initialText?: string
  editingUrl?: string
  editingText?: string
  onInsert: (url: string, title: string) => void
}

function getRelativePath(fromDir: string, toPath: string): string {
  const fromParts = fromDir.split("/").filter(Boolean)
  const toParts = toPath.split("/").filter(Boolean)
  let common = 0
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++
  }
  const ups = fromParts.length - common
  const remaining = toParts.slice(common)
  return [...Array(ups).fill(".."), ...remaining].join("/")
}

/** Shared search input + results list */
function DocumentSearch({
  query,
  onQueryChange,
  results,
  loading,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  showRepoBadge,
  inputRef,
}: {
  query: string
  onQueryChange: (q: string) => void
  results: SearchResult[]
  loading: boolean
  activeIndex: number
  onActiveIndexChange: (i: number) => void
  onSelect: (r: SearchResult) => void
  showRepoBadge: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        onActiveIndexChange(activeIndex < results.length - 1 ? activeIndex + 1 : 0)
        break
      case "ArrowUp":
        e.preventDefault()
        onActiveIndexChange(activeIndex > 0 ? activeIndex - 1 : results.length - 1)
        break
      case "Enter":
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          onSelect(results[activeIndex])
        }
        break
    }
  }

  return (
    <div className="min-w-0 space-y-2" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search documents..."
          className="flex w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="max-h-[240px] overflow-y-auto rounded-md border">
        {loading && results.length === 0 && query.trim() && (
          <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
        )}
        {!loading && results.length === 0 && query.trim() && (
          <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
        )}
        {!query.trim() && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type to search for documents.
          </div>
        )}
        {results.map((result, i) => (
          <button
            key={`${result.repo}-${result.file_path}-${i}`}
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-accent ${
              i === activeIndex ? "bg-accent" : ""
            }`}
            onMouseEnter={() => onActiveIndexChange(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(result)
            }}
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{result.file_path}</span>
                {showRepoBadge && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {result.repo}
                  </span>
                )}
              </div>
              {result.chunk && (
                <p className="truncate text-xs text-muted-foreground">{result.chunk}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function InsertLinkDialog({
  open,
  onOpenChange,
  repos,
  currentRepoSlug,
  filePath,
  initialText,
  editingUrl,
  editingText,
  onInsert,
}: InsertLinkDialogProps) {
  const [tab, setTab] = useState<LinkTab>("current")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [changingTarget, setChangingTarget] = useState(false)
  const [linkText, setLinkText] = useState("")
  const [externalUrl, setExternalUrl] = useState("")
  const [otherRepoSlug, setOtherRepoSlug] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const dir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : ""
  const otherRepos = repos.filter((r) => r.slug !== currentRepoSlug)

  const isEditing = editingUrl != null

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      if (isEditing && editingUrl) {
        const url = editingUrl
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
          setTab("external")
          setExternalUrl(url)
        } else if (url.startsWith("/")) {
          setTab("other")
          const trimmed = url.replace(/^\/+/, "")
          const slashIdx = trimmed.indexOf("/")
          if (slashIdx >= 0) {
            setOtherRepoSlug(decodeURIComponent(trimmed.substring(0, slashIdx)))
          }
        } else {
          setTab("current")
        }
        setLinkText(editingText ?? "")
        setQuery("")
        setResults([])
        setSelectedResult(null)
        setChangingTarget(false)
        setActiveIndex(-1)
      } else {
        setTab("current")
        setQuery("")
        setResults([])
        setSelectedResult(null)
        setChangingTarget(false)
        setLinkText(initialText ?? "")
        setExternalUrl("")
        setOtherRepoSlug(otherRepos[0]?.slug ?? "")
        setActiveIndex(-1)
      }
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset search state when tab or selected other-repo changes
  useEffect(() => {
    setQuery("")
    setResults([])
    setSelectedResult(null)
    setChangingTarget(false)
    setActiveIndex(-1)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [tab, otherRepoSlug])

  const searchRepoSlug = tab === "current" ? currentRepoSlug : otherRepoSlug

  const search = useCallback(
    async (q: string) => {
      abortRef.current?.abort()
      if (!q.trim() || !searchRepoSlug) {
        setResults([])
        setLoading(false)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      try {
        const res = await authFetch("/repos/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            repos: [{ name: searchRepoSlug }],
            mode: "fulltext",
            top_k: 15,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          setResults([])
          return
        }

        const data = (await res.json()) as { results: SearchResult[] }
        if (!controller.signal.aborted) {
          setResults(data.results ?? [])
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [searchRepoSlug],
  )

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, search])

  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  const handleSelectResult = useCallback((result: SearchResult) => {
    setSelectedResult(result)
    setChangingTarget(false)
    // Only auto-fill link text if it's empty
    setLinkText((prev) => {
      if (prev.trim()) return prev
      const name = result.file_path.split("/").pop() ?? result.file_path
      return name.replace(/\.md$/, "")
    })
  }, [])

  const handleInsert = useCallback(() => {
    if (tab === "external") {
      const url = externalUrl.trim()
      if (!url) return
      onInsert(url, linkText.trim() || url)
      onOpenChange(false)
      return
    }

    if (selectedResult) {
      let url: string
      if (tab === "current") {
        url = getRelativePath(dir, selectedResult.file_path)
      } else {
        url = `/${selectedResult.repo}/${selectedResult.file_path}`
      }
      onInsert(url, linkText.trim() || selectedResult.file_path)
      onOpenChange(false)
      return
    }

    // Editing an existing link without changing the target document
    if (isEditing && editingUrl && linkText.trim()) {
      onInsert(editingUrl, linkText.trim())
      onOpenChange(false)
    }
  }, [tab, selectedResult, linkText, externalUrl, dir, isEditing, editingUrl, onInsert, onOpenChange])

  const canInsert =
    tab === "external"
      ? externalUrl.trim().length > 0
      : selectedResult !== null || (isEditing && linkText.trim().length > 0)

  const tabCls = (t: LinkTab) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      tab === t
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Link" : "Insert Link"}</DialogTitle>
        </DialogHeader>

        {/* Link text — always at the top */}
        <div>
          <label className="mb-1 block text-sm font-medium">Link Text</label>
          <input
            type="text"
            placeholder="Display text"
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (canInsert) handleInsert()
              }
            }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <button type="button" className={tabCls("current")} onClick={() => setTab("current")}>
            <FileText className="size-3.5" />
            Current Repo
          </button>
          {otherRepos.length > 0 && (
            <button type="button" className={tabCls("other")} onClick={() => setTab("other")}>
              <Link className="size-3.5" />
              Other Repo
            </button>
          )}
          <button type="button" className={tabCls("external")} onClick={() => setTab("external")}>
            <ExternalLink className="size-3.5" />
            External
          </button>
        </div>

        {/* Target selection */}
        {tab === "external" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">URL</label>
            <input
              ref={searchInputRef}
              type="url"
              placeholder="https://example.com"
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (canInsert) handleInsert()
                }
              }}
            />
          </div>
        ) : selectedResult || (isEditing && !changingTarget) ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedResult ? selectedResult.file_path : decodeURIComponent(editingUrl ?? "")}
            </span>
            {tab === "other" && selectedResult && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {selectedResult.repo}
              </span>
            )}
            <button
              type="button"
              className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedResult(null)
                setChangingTarget(true)
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="min-w-0 space-y-2">
            {tab === "other" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Repository</label>
                <select
                  className="flex w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  value={otherRepoSlug}
                  onChange={(e) => setOtherRepoSlug(e.target.value)}
                >
                  {otherRepos.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <DocumentSearch
              query={query}
              onQueryChange={setQuery}
              results={results}
              loading={loading}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onSelect={handleSelectResult}
              showRepoBadge={tab === "other"}
              inputRef={searchInputRef}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!canInsert}>
            {isEditing ? "Update Link" : "Insert Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
