import { useCallback, useState } from "react"
import ReactDOMServer from "react-dom/server"
import { createElement } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { DocNode } from "@/types"
import { authFetch } from "@/lib/auth-fetch"
import {
  collectMarkdownFiles,
  resolveImages,
  resolveBlobUrls,
  printHtml,
} from "@/lib/pdf-export"

export interface PdfExportProgress {
  current: number
  total: number
}

export function usePdfExport(repoSlug: string) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<PdfExportProgress | null>(null)

  /**
   * Export the currently rendered document by cloning the editor DOM.
   */
  const exportCurrentDocument = useCallback(
    async (fileName: string) => {
      // Find the rendered prose container from MDXEditor
      const proseEl = document.querySelector(".prose")
      if (!proseEl) return

      setExporting(true)
      try {
        const clone = proseEl.cloneNode(true) as HTMLElement
        // Resolve blob: URLs from the editor's image preview handler
        await resolveBlobUrls(clone)
        await printHtml(clone.innerHTML, fileName)
      } finally {
        setExporting(false)
      }
    },
    [],
  )

  /**
   * Export all .md files in a folder as a single combined PDF.
   */
  const exportFolder = useCallback(
    async (
      folderPath: string,
      tree: DocNode,
      options?: { onCancel?: AbortSignal },
    ) => {
      const files = collectMarkdownFiles(tree, folderPath)
      if (files.length === 0) return

      setExporting(true)
      setProgress({ current: 0, total: files.length })

      try {
        const sections: string[] = []

        for (let i = 0; i < files.length; i++) {
          if (options?.onCancel?.aborted) break

          setProgress({ current: i + 1, total: files.length })
          const filePath = files[i]

          // Fetch markdown content
          const res = await authFetch(
            `/repos/${encodeURIComponent(repoSlug)}/file/${filePath}`,
          )
          if (!res.ok) continue
          const markdown = await res.text()

          // Render markdown to HTML using react-markdown
          const html = ReactDOMServer.renderToStaticMarkup(
            createElement(ReactMarkdown, {
              remarkPlugins: [remarkGfm, remarkMath],
              rehypePlugins: [rehypeKatex],
              children: markdown,
            }),
          )

          // Wrap with title and page break
          const displayName = filePath.split("/").pop()?.replace(/\.md$/, "") ?? filePath
          const separator = i > 0 ? ' class="doc-separator"' : ""
          sections.push(
            `<div${separator}><div class="doc-title">${escapeHtml(displayName)}</div>${html}</div>`,
          )
        }

        if (sections.length === 0) return

        // Create a temporary container to resolve images
        const container = document.createElement("div")
        container.innerHTML = sections.join("")

        // We resolve images with the folder context as a best-effort approach
        const dirForFolder = folderPath ? folderPath + "/" : ""
        await resolveImages(container, repoSlug, dirForFolder)

        const folderName = folderPath
          ? folderPath.split("/").pop() ?? folderPath
          : "Content"
        await printHtml(container.innerHTML, folderName)
      } finally {
        setExporting(false)
        setProgress(null)
      }
    },
    [repoSlug],
  )

  return { exportCurrentDocument, exportFolder, exporting, progress }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
