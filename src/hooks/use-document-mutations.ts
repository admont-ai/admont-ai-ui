import { useCallback } from "react"

import { authFetch } from "@/lib/auth-fetch"

export function buildDocumentUrl(repo: string, path: string) {
  return `/repos/${encodeURIComponent(repo)}/file/${path}`
}

export function buildFolderUrl(repo: string, path: string) {
  return `/repos/${encodeURIComponent(repo)}/folder/${path}`
}

export function buildRenameUrl(repo: string, path: string) {
  return `/repos/${encodeURIComponent(repo)}/rename/${path}`
}

/** Derive the hidden asset folder path for a document, e.g. "Folder/example.md" → "Folder/.example" */
export function assetFolderPath(docPath: string): string {
  const lastSlash = docPath.lastIndexOf("/")
  const dir = lastSlash >= 0 ? docPath.substring(0, lastSlash + 1) : ""
  const filename = lastSlash >= 0 ? docPath.substring(lastSlash + 1) : docPath
  const baseName = filename.replace(/\.md$/i, "")
  return `${dir}.${baseName}`
}

export function useDocumentMutations(
  repoSlug: string,
  onMutate: () => void,
) {
  const createDocument = useCallback(
    async (folderPath: string, name: string, content = ""): Promise<string> => {
      const path = folderPath ? `${folderPath}/${name}` : name
      const res = await authFetch(buildDocumentUrl(repoSlug, path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error(`Failed to create document: ${res.status}`)
      const data = await res.json() as { path: string }
      onMutate()
      return data.path
    },
    [repoSlug, onMutate],
  )

  const deleteDocument = useCallback(
    async (docPath: string) => {
      const res = await authFetch(buildDocumentUrl(repoSlug, docPath), {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(`Failed to delete document: ${res.status}`)
      // Best-effort delete of the hidden asset folder (e.g. ".example/" for "example.md")
      await authFetch(buildFolderUrl(repoSlug, assetFolderPath(docPath)), {
        method: "DELETE",
      }).catch(() => {})
      onMutate()
    },
    [repoSlug, onMutate],
  )

  const moveDocument = useCallback(
    async (docPath: string, destination: string) => {
      const res = await authFetch(buildDocumentUrl(repoSlug, docPath), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      })
      if (!res.ok) throw new Error(`Failed to move document: ${res.status}`)
      onMutate()
    },
    [repoSlug, onMutate],
  )

  const renameDocument = useCallback(
    async (docPath: string, newName: string): Promise<string> => {
      const res = await authFetch(buildRenameUrl(repoSlug, docPath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error(`Failed to rename document: ${res.status}`)
      const data = await res.json() as { path: string }
      onMutate()
      return data.path
    },
    [repoSlug, onMutate],
  )

  return { createDocument, deleteDocument, moveDocument, renameDocument }
}
