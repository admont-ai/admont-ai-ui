import { useCallback, useEffect, useState } from "react"

import type { Repo } from "@/types"
import { authFetch } from "@/lib/auth-fetch"

export function useRepos(isAuthenticated: boolean) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    authFetch("/repos")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch repos: ${res.status}`)
        return res.json() as Promise<Repo[]>
      })
      .then((data) => { setRepos(data ?? []) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { repos, loading, error, refresh }
}
