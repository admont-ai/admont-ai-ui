import { useCallback, useRef } from "react"
import { authFetch } from "@/lib/auth-fetch"

export interface CheckerAnnotation {
  offset: number
  length: number
  message: string
  short_message: string
  rule_id: string
  category: string
  type: "spelling" | "grammar" | "style" | "typographical"
  replacements: string[]
}

interface CheckerResponse {
  annotations: CheckerAnnotation[]
  language: string
}

export function useSpellChecker() {
  const abortRef = useRef<AbortController | null>(null)

  const check = useCallback(async (text: string, language = "auto"): Promise<CheckerAnnotation[]> => {
    // Abort previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await authFetch("/checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
        signal: controller.signal,
      })
      if (!res.ok) return []
      const data: CheckerResponse = await res.json()
      return data.annotations ?? []
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return []
      return []
    }
  }, [])

  return { check }
}
