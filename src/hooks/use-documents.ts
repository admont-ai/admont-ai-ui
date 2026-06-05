import { useCallback, useEffect, useState } from "react"

import type { DocNode, RepoTree } from "@/types"
import { authFetch } from "@/lib/auth-fetch"

export function convertToDocNode(name: string, tree: RepoTree): DocNode {
  const children: DocNode[] = []
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith("/")) {
      children.push(convertToDocNode(key.slice(1), value as RepoTree))
    } else {
      children.push({ name: key, type: "file" })
    }
  }
  return { name, type: "directory", children }
}

export function useDocuments(repoSlug: string) {
  const [tree, setTree] = useState<DocNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(() => {
    if (!repoSlug) {
      setTree(null)
      return
    }

    setLoading(true)
    setError(null)

    authFetch(`/repos/${encodeURIComponent(repoSlug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`)
        return res.json() as Promise<RepoTree>
      })
      .then((data) => setTree(convertToDocNode(repoSlug, data)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [repoSlug])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return { tree, loading, error, refresh: fetchDocuments }
}
