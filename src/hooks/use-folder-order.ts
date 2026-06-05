import { useCallback, useRef, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"

function buildOrderUrl(repo: string, path: string) {
  const base = `/repos/${encodeURIComponent(repo)}/order`
  return path ? `${base}/${path}` : `${base}/`
}

/**
 * Manages optimistic reordering of directory contents.
 * The backend tree already returns items in order, so no fetching is needed.
 * This hook only handles saving new order (PUT) with optimistic local overrides,
 * then refreshes the tree to pick up the persisted order.
 */
export function useFolderOrder(repoSlug: string, onMutate: () => void) {
  const mapRef = useRef(new Map<string, string[]>())
  const [, setRevision] = useState(0)

  const bump = useCallback(() => setRevision((r) => r + 1), [])

  const saveOrder = useCallback(
    async (dirPath: string, order: string[]) => {
      if (!repoSlug) return
      // Optimistic update for instant visual feedback
      mapRef.current.set(dirPath, order)
      bump()
      try {
        const res = await authFetch(buildOrderUrl(repoSlug, dirPath), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        })
        if (res.ok) {
          // Clear local override — the refreshed tree will have the right order
          mapRef.current.delete(dirPath)
          onMutate()
        } else {
          // Revert optimistic update
          mapRef.current.delete(dirPath)
          bump()
        }
      } catch {
        mapRef.current.delete(dirPath)
        bump()
      }
    },
    [repoSlug, bump, onMutate],
  )

  return { orderMap: mapRef.current, saveOrder }
}
