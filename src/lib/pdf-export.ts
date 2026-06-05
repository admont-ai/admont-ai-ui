import type { DocNode } from "@/types"
import { authFetch } from "@/lib/auth-fetch"

/**
 * Walk a DocNode tree and return all .md file paths under the given folder.
 */
export function collectMarkdownFiles(tree: DocNode, folderPath: string): string[] {
  const paths: string[] = []

  function walk(node: DocNode, currentPath: string) {
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name
    if (node.type === "file" && node.name.toLowerCase().endsWith(".md")) {
      paths.push(nodePath)
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child, nodePath)
      }
    }
  }

  // Find the target folder node in the tree
  if (!folderPath) {
    // Root folder — walk all children
    if (tree.children) {
      for (const child of tree.children) {
        walk(child, "")
      }
    }
  } else {
    const parts = folderPath.split("/")
    let node: DocNode | undefined = tree
    for (const part of parts) {
      node = node.children?.find((c) => c.name === part)
      if (!node) return paths
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child, folderPath)
      }
    }
  }

  return paths
}

/**
 * Find all <img> elements in a container, fetch them via authFetch,
 * and replace their src with base64 data URLs so they work in print.
 */
export async function resolveImages(
  container: HTMLElement,
  repoSlug: string,
  fileDir: string,
): Promise<void> {
  const images = container.querySelectorAll("img")
  const promises = Array.from(images).map(async (img) => {
    const src = img.getAttribute("src")
    if (!src) return
    // Skip already-inlined data URLs
    if (src.startsWith("data:")) return

    let url: string
    if (src.startsWith("http") || src.startsWith("/")) {
      url = src
    } else {
      const cleanSrc = src.startsWith("./") ? src.slice(2) : src
      url = `/repos/${encodeURIComponent(repoSlug)}/file/${fileDir}${cleanSrc}`
    }

    try {
      const res = await authFetch(url)
      if (!res.ok) return
      const blob = await res.blob()
      const dataUrl = await blobToDataUrl(blob)
      img.src = dataUrl
    } catch {
      // Keep original src if fetch fails
    }
  })

  await Promise.all(promises)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Also resolve blob: URLs from MDXEditor's image preview
// by re-fetching them and converting to data URLs
export async function resolveBlobUrls(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll("img")
  const promises = Array.from(images).map(async (img) => {
    const src = img.getAttribute("src")
    if (!src || !src.startsWith("blob:")) return
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const dataUrl = await blobToDataUrl(blob)
      img.src = dataUrl
    } catch {
      // Keep blob URL if conversion fails
    }
  })
  await Promise.all(promises)
}

const KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"

const PRINT_CSS = `
  @page { margin: 2cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
    background: white;
  }
  .doc-content { padding: 0; }
  h1 { font-size: 2em; margin: 0.67em 0; page-break-after: avoid; }
  h2 { font-size: 1.5em; margin: 0.83em 0; page-break-after: avoid; }
  h3 { font-size: 1.17em; margin: 1em 0; page-break-after: avoid; }
  h4, h5, h6 { page-break-after: avoid; }
  p { margin: 1em 0; }
  img { max-width: 100%; height: auto; }
  video { display: none; }
  pre {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 12px;
    overflow-x: auto;
    font-size: 13px;
    page-break-inside: avoid;
  }
  code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9em;
  }
  :not(pre) > code {
    background: #f0f0f0;
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 6px 12px;
    text-align: left;
  }
  th { background: #f5f5f5; font-weight: 600; }
  blockquote {
    border-left: 4px solid #ddd;
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #555;
  }
  ul, ol { padding-left: 2em; }
  li { margin: 0.25em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  a { color: #1a1a1a; text-decoration: underline; }
  .doc-separator {
    page-break-before: always;
  }
  .doc-title {
    font-size: 1.3em;
    font-weight: 600;
    color: #555;
    border-bottom: 1px solid #ddd;
    padding-bottom: 0.3em;
    margin-bottom: 1em;
  }
`

/**
 * Print HTML content via a hidden iframe using the browser's print dialog.
 */
export function printHtml(html: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.left = "-9999px"
    iframe.style.top = "-9999px"
    iframe.style.width = "0"
    iframe.style.height = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument!
    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${KATEX_CSS_URL}">
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="doc-content">${html}</div>
</body>
</html>`)
    doc.close()

    // Wait for KaTeX CSS & images to load before printing
    const contentWindow = iframe.contentWindow!
    contentWindow.onafterprint = () => {
      cleanup()
    }

    function cleanup() {
      setTimeout(() => {
        document.body.removeChild(iframe)
        resolve()
      }, 100)
    }

    // Wait for resources to load, then print
    if (doc.readyState === "complete") {
      triggerPrint()
    } else {
      contentWindow.addEventListener("load", triggerPrint)
    }

    function triggerPrint() {
      // Small delay to ensure CSS is applied
      setTimeout(() => {
        contentWindow.print()
        // Fallback cleanup in case onafterprint doesn't fire (Safari)
        setTimeout(cleanup, 1000)
      }, 300)
    }
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
