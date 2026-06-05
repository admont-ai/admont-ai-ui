import { useState, useEffect, useRef } from "react"
import mermaid from "mermaid"
import type { DiagramModel } from "../types"
import { getAdapter } from "../adapters/registry"

interface SyncResult {
  code: string
  previewHtml: string
  previewError: string
}

export function useMermaidSync(model: DiagramModel): SyncResult {
  const [code, setCode] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewError, setPreviewError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const renderIdRef = useRef(0)

  // Generate code from model
  useEffect(() => {
    const adapter = getAdapter(model.diagramType)
    const generated = adapter.generate(model)
    setCode(generated)
  }, [model])

  // Render preview from code (debounced)
  useEffect(() => {
    if (!code) {
      setPreviewHtml("")
      setPreviewError("")
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      renderIdRef.current += 1
      const thisId = renderIdRef.current

      try {
        const { svg } = await mermaid.render(`mermaid-sync-${thisId}`, code)
        setPreviewHtml(svg)
        setPreviewError("")
      } catch {
        setPreviewError("Invalid mermaid syntax")
        document.getElementById(`dmermaid-sync-${thisId}`)?.remove()
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [code])

  return { code, previewHtml, previewError }
}
