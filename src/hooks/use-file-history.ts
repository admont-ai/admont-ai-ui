import { useCallback, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"
import type { FileHistoryEntry } from "@/types"

export function useFileHistory(repoSlug: string, filePath: string) {
  const [entries, setEntries] = useState<FileHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!repoSlug || !filePath) return
    setLoading(true)
    setError(null)
    authFetch(`/repos/${encodeURIComponent(repoSlug)}/filehistory/${filePath}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch file history: ${res.status}`)
        return res.json() as Promise<{ entries: FileHistoryEntry[] }>
      })
      .then((data) => setEntries(data.entries))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [repoSlug, filePath])

  return { entries, loading, error, fetch }
}

export async function fetchFileDiff(
  repoSlug: string,
  filePath: string,
  commitHash: string,
): Promise<string> {
  const res = await authFetch(
    `/repos/${encodeURIComponent(repoSlug)}/filediff/${filePath}?commit=${encodeURIComponent(commitHash)}`,
  )
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`)
  const data = (await res.json()) as { diff: string }
  return data.diff
}

export async function fetchFileAtCommit(
  repoSlug: string,
  filePath: string,
  commitHash: string,
): Promise<string> {
  const res = await authFetch(
    `/repos/${encodeURIComponent(repoSlug)}/fileatcommit/${filePath}?commit=${encodeURIComponent(commitHash)}`,
  )
  if (!res.ok) throw new Error(`Failed to fetch file at commit: ${res.status}`)
  const data = (await res.json()) as { content: string }
  return data.content
}
