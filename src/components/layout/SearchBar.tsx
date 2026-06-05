import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Search, Loader2 } from "lucide-react"

import { authFetch } from "@/lib/auth-fetch"
import type { Repo, SearchResult } from "@/types"

export function SearchBar({
  repos,
  selectedRepo,
  onSelect,
}: {
  repos: Repo[]
  selectedRepo: string
  onSelect: (repo: string, filePath: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [mode, setMode] = useState("hybrid")
  const [topK, setTopK] = useState(10)
  const [threshold, setThreshold] = useState(0.0)
  const [extraRepos, setExtraRepos] = useState<string[]>([])
  const [allRepos, setAllRepos] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showDropdown = focused && query.trim().length > 0

  const search = useCallback(
    async (q: string) => {
      abortRef.current?.abort()
      if (!q.trim()) {
        setResults([])
        setLoading(false)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      try {
        const indexedRepos = repos.filter((r) => r.search_provider)
        let searchRepos: Repo[]
        if (allRepos) {
          searchRepos = indexedRepos
        } else {
          const slugs = new Set<string>(extraRepos)
          if (selectedRepo) slugs.add(selectedRepo)
          searchRepos = slugs.size > 0
            ? indexedRepos.filter((r) => slugs.has(r.slug))
            : indexedRepos
        }
        const repoList = searchRepos.map((r) => ({ name: r.slug }))

        const res = await authFetch("/repos/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            repos: repoList,
            mode,
            top_k: topK,
            threshold: threshold || undefined,
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
    [repos, selectedRepo, extraRepos, allRepos, mode, topK, threshold],
  )

  // Debounced search on query change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, search])

  // Cmd+K to focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  function handleSelect(result: SearchResult) {
    onSelect(result.repo, result.file_path)
    setQuery("")
    setResults([])
    setFocused(false)
    inputRef.current?.blur()
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) {
      if (e.key === "Escape") {
        setFocused(false)
        inputRef.current?.blur()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex])
        }
        break
      case "Escape":
        setFocused(false)
        inputRef.current?.blur()
        break
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search documents... (⌘K)"
          className="h-9 w-full rounded-md border bg-muted/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:bg-background focus:ring-1 focus:ring-ring"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleInputKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          <details className="border-b px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground select-none">
              Search options
            </summary>
            <div className="mt-2 space-y-2 pb-1">
              {repos.filter((r) => r.search_provider).length > 1 && (
                <div>
                  <span className="text-muted-foreground">Repos</span>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={allRepos}
                        onChange={(e) => {
                          setAllRepos(e.target.checked)
                          if (e.target.checked) setExtraRepos([])
                        }}
                      />
                      <span>All</span>
                    </label>
                    {repos
                      .filter((r) => r.search_provider && r.slug !== selectedRepo)
                      .map((r) => (
                        <label key={r.slug} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            disabled={allRepos}
                            checked={allRepos || extraRepos.includes(r.slug)}
                            onChange={(e) => {
                              setExtraRepos((prev) =>
                                e.target.checked
                                  ? [...prev, r.slug]
                                  : prev.filter((s) => s !== r.slug),
                              )
                            }}
                          />
                          <span>{r.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Mode</span>
                  <select
                    className="rounded border bg-transparent px-1.5 py-0.5 text-xs"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="hybrid">Hybrid</option>
                    <option value="fulltext">Fulltext</option>
                    <option value="semantic">Semantic</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Top K</span>
                  <input
                    type="number"
                    className="w-16 rounded border bg-transparent px-1.5 py-0.5 text-xs"
                    min={1}
                    max={100}
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Threshold</span>
                  <input
                    type="number"
                    className="w-20 rounded border bg-transparent px-1.5 py-0.5 text-xs"
                    min={0}
                    max={1}
                    step={0.05}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
          </details>

          <div className="max-h-[300px] overflow-y-auto">
            {loading && results.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            )}
            {results.map((result, i) => (
              <button
                key={`${result.repo}-${result.file_path}-${i}`}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-accent ${
                  i === activeIndex ? "bg-accent" : ""
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(result)
                }}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {result.file_path}
                    </span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {result.repo}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {result.chunk}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
