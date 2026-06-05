import { useCallback, useEffect, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"

export type PermissionLevel = "none" | "viewer" | "contributor" | "content_manager" | "manager"

const LEVEL_ORDER: Record<PermissionLevel, number> = {
  none: 0,
  viewer: 1,
  contributor: 2,
  content_manager: 3,
  manager: 4,
}

/** Check whether `actual` permission is at least `required` */
export function hasPermission(actual: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[required]
}

/**
 * Fetch the permission level for a given file or folder path.
 * Returns the `permission` field from GET /repos/:repo/fileinfo/:path.
 * For folders, the path should end with "/".
 */
export function useFilePermission(repoSlug: string, path: string) {
  const [permission, setPermission] = useState<PermissionLevel>("none")
  const [loading, setLoading] = useState(false)

  const fetchPermission = useCallback(async () => {
    if (!repoSlug || !path) {
      setPermission("none")
      return
    }

    setLoading(true)
    try {
      const base = `/repos/${encodeURIComponent(repoSlug)}`
      const res = await authFetch(`${base}/fileinfo/${path}`)
      if (res.ok) {
        const data = await res.json()
        const level = data.permission as PermissionLevel | undefined
        setPermission(level && level in LEVEL_ORDER ? level : "none")
      } else {
        setPermission("none")
      }
    } catch {
      setPermission("none")
    } finally {
      setLoading(false)
    }
  }, [repoSlug, path])

  useEffect(() => {
    fetchPermission()
  }, [fetchPermission])

  return { permission, loading, refetch: fetchPermission }
}
