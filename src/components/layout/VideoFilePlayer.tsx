import { useEffect, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"

interface VideoFilePlayerProps {
  repoSlug: string
  filePath: string
}

export function VideoFilePlayer({ repoSlug, filePath }: VideoFilePlayerProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    const url = `/repos/${encodeURIComponent(repoSlug)}/file/${filePath}`
    authFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch video")
        return res.blob()
      })
      .then((blob) => {
        if (revoked) return
        setSrc(URL.createObjectURL(blob))
      })
      .catch(() => {})
    return () => {
      revoked = true
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [repoSlug, filePath])

  const fileName = filePath.split("/").pop() ?? filePath

  if (!src) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading video…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
      <h2 className="text-sm font-medium text-muted-foreground">{fileName}</h2>
      <video
        src={src}
        controls
        className="max-h-[80vh] max-w-full rounded-md"
      />
    </div>
  )
}
