import { useEffect, useState } from "react"

import { authFetch } from "@/lib/auth-fetch"

export function AuthImage(props: React.ComponentProps<"img">) {
  const { src, ...rest } = props
  const [blobUrl, setBlobUrl] = useState<string | undefined>()

  useEffect(() => {
    if (!src) return

    let revoked = false
    authFetch(src)
      .then((res) => {
        if (!res.ok) return null
        return res.blob()
      })
      .then((blob) => {
        if (blob && !revoked) {
          setBlobUrl(URL.createObjectURL(blob))
        }
      })
      .catch(() => {})

    return () => {
      revoked = true
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return undefined
      })
    }
  }, [src])

  if (!blobUrl) return null

  return <img {...rest} src={blobUrl} />
}
