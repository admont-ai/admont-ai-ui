import { useCallback } from "react"

import { authFetch } from "@/lib/auth-fetch"

function buildFolderUrl(repo: string, path: string) {
  const base = `/repos/${encodeURIComponent(repo)}/folder`
  return path ? `${base}/${path}` : base
}

export function useFolders(
  repoSlug: string,
  onMutate: () => void,
) {
  const createFolder = useCallback(
    async (parentPath: string, name: string) => {
      const res = await authFetch(buildFolderUrl(repoSlug, parentPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`)
      onMutate()
    },
    [repoSlug, onMutate],
  )

  const updateFolder = useCallback(
    async (folderPath: string, newName: string) => {
      const res = await authFetch(buildFolderUrl(repoSlug, folderPath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error(`Failed to rename folder: ${res.status}`)
      onMutate()
    },
    [repoSlug, onMutate],
  )

  const deleteFolder = useCallback(
    async (folderPath: string) => {
      const res = await authFetch(buildFolderUrl(repoSlug, folderPath), {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(`Failed to delete folder: ${res.status}`)
      onMutate()
    },
    [repoSlug, onMutate],
  )

  const moveFolder = useCallback(
    async (folderPath: string, destination: string) => {
      const res = await authFetch(buildFolderUrl(repoSlug, folderPath), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      })
      if (!res.ok) throw new Error(`Failed to move folder: ${res.status}`)
      onMutate()
    },
    [repoSlug, onMutate],
  )

  return { createFolder, updateFolder, deleteFolder, moveFolder }
}
