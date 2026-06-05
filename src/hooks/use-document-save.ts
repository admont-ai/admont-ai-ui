import { useCallback, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"

export function useDocumentSave(
  repoSlug: string,
  filePath: string
) {
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/repos/${encodeURIComponent(repoSlug)}`

  const save = useCallback(
    async (content: string) => {
      if (!repoSlug || !filePath) return

      setSaving(true)
      setError(null)

      try {
        const res = await authFetch(
          `${base}/draft/${filePath}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          }
        )
        if (!res.ok) throw new Error(`Failed to save draft: ${res.status}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [repoSlug, filePath, base]
  )

  const publish = useCallback(
    async () => {
      if (!repoSlug || !filePath) return

      setPublishing(true)
      setError(null)

      try {
        const res = await authFetch(
          `${base}/draft/publish/${filePath}`,
          { method: "POST" }
        )
        if (!res.ok) throw new Error(`Failed to publish: ${res.status}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        throw err
      } finally {
        setPublishing(false)
      }
    },
    [repoSlug, filePath, base]
  )

  const deleteDraft = useCallback(
    async () => {
      if (!repoSlug || !filePath) return

      setError(null)

      try {
        const res = await authFetch(
          `${base}/draft/${filePath}`,
          { method: "DELETE" }
        )
        if (!res.ok) throw new Error(`Failed to discard draft: ${res.status}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        throw err
      }
    },
    [repoSlug, filePath, base]
  )

  return { save, saving, publish, publishing, deleteDraft, error }
}
