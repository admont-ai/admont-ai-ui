import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { authFetch } from "@/lib/auth-fetch"
import type { PermissionLevel } from "./use-file-permission"

export interface FileInfo {
  name?: string
  path?: string
  size?: number
  last_commit_hash?: string
  last_author?: string
  last_author_email?: string
  last_modified: string
  last_message?: string
  created_at?: string
  is_draft?: boolean
  draft_created_at?: string
  draft_updated_at?: string
  permission?: string
  // Pending draft from ANOTHER user (never the caller's own — see is_draft
  // above for that). Content is never included, only who and when.
  pending_draft_owner_name?: string
  pending_draft_owner_email?: string
  pending_draft_updated_at?: string
  locked_by_pending_draft?: boolean
}

export function useDocumentContent(
  repoSlug: string,
  filePath: string
) {
  const [content, setContent] = useState<string | null>(null)
  const [lastModified, setLastModified] = useState<string | null>(null)
  const [isDraft, setIsDraft] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [permission, setPermission] = useState<PermissionLevel>("none")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocument = useCallback((signal?: AbortSignal) => {
    if (!repoSlug || !filePath) {
      setContent(null)
      setLastModified(null)
      setIsDraft(false)
      setDraftUpdatedAt(null)
      setPermission("none")
      setFileInfo(null)
      return
    }

    setContent(null)
    setLastModified(null)
    setIsDraft(false)
    setDraftUpdatedAt(null)
    setPermission("none")
    setFileInfo(null)
    setLoading(true)
    setError(null)

    const base = `/repos/${encodeURIComponent(repoSlug)}`

    // Fetch fileinfo first; only fetch file content if it succeeds
    authFetch(`${base}/fileinfo/${filePath}`, { signal })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "File not found." : `Failed to fetch file info: ${res.status}`)
        return res.json().then((data) => data as FileInfo)
      })
      .then((info) => {
        if (signal?.aborted) return
        const perm = info.permission as PermissionLevel | undefined
        setPermission(perm && ["none", "viewer", "contributor", "content_manager", "manager"].includes(perm) ? perm : "none")
        setFileInfo(info)

        return authFetch(`${base}/file/${filePath}`, { signal }).then((res) => {
          if (res.status === 404) throw new Error("File not found.")
          if (!res.ok) throw new Error(`Failed to fetch document: ${res.status}`)
          const draft = res.headers.get("X-Is-Draft") === "true"
          return res.text().then((text) => {
            if (signal?.aborted) return
            setContent(text)
            setLastModified(info.last_modified)
            setIsDraft(draft || !!info.is_draft)
            setDraftUpdatedAt(info.draft_updated_at ?? null)
          })
        })
      })
      .catch((err: Error) => {
        if (signal?.aborted) return
        if (err.message === "File not found.") {
          toast.error("The requested file was not found")
        }
        setError(err.message)
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })
  }, [repoSlug, filePath])

  useEffect(() => {
    const controller = new AbortController()
    fetchDocument(controller.signal)
    return () => controller.abort()
  }, [fetchDocument])

  // markDraftSaved optimistically reflects that a draft now exists (e.g. after
  // an autosave) so draft controls appear without refetching the document.
  const markDraftSaved = useCallback((updatedAt?: string) => {
    setIsDraft(true)
    setDraftUpdatedAt(updatedAt ?? new Date().toISOString())
  }, [])

  // Derived straight from fileInfo (not separate state) since, unlike
  // isDraft/draftUpdatedAt, nothing ever optimistically updates these ahead
  // of a refetch.
  const lockedByPendingDraft = !!fileInfo?.locked_by_pending_draft
  const pendingDraftOwnerName = fileInfo?.pending_draft_owner_name ?? null
  const pendingDraftOwnerEmail = fileInfo?.pending_draft_owner_email ?? null
  const pendingDraftUpdatedAt = fileInfo?.pending_draft_updated_at ?? null

  return {
    content,
    lastModified,
    isDraft,
    draftUpdatedAt,
    permission,
    fileInfo,
    loading,
    error,
    refetch: fetchDocument,
    markDraftSaved,
    lockedByPendingDraft,
    pendingDraftOwnerName,
    pendingDraftOwnerEmail,
    pendingDraftUpdatedAt,
  }
}
