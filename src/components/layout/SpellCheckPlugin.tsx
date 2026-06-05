import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { LexicalEditor } from "lexical"
import { $getRoot, $isTextNode, $isElementNode } from "lexical"
import { authFetch } from "@/lib/auth-fetch"

// ── Types ──────────────────────────────────────────────

interface Annotation {
  offset: number
  length: number
  message: string
  short_message: string
  rule_id: string
  category: string
  type: "spelling" | "grammar" | "style" | "typographical"
  replacements: string[]
}

interface TextMapEntry {
  node: Text
  start: number
  end: number
}

// ── Underline colors ──────────────────────────────────────

const UNDERLINE_COLORS: Record<string, string> = {
  spelling: "#ef4444",
  grammar: "#3b82f6",
  style: "#a855f7",
  typographical: "#f59e0b",
}

// ── Helpers ──────────────────────────────────────────────

function extractTextWithMap(editor: LexicalEditor): { text: string; map: TextMapEntry[] } {
  const map: TextMapEntry[] = []
  let text = ""

  editor.getEditorState().read(() => {
    const root = $getRoot()

    function walk(node: ReturnType<typeof $getRoot>) {
      if ($isTextNode(node)) {
        const domEl = editor.getElementByKey(node.getKey())
        if (domEl) {
          const walker = document.createTreeWalker(domEl, NodeFilter.SHOW_TEXT)
          let textNode: Text | null
          while ((textNode = walker.nextNode() as Text | null)) {
            const start = text.length
            text += textNode.textContent ?? ""
            map.push({ node: textNode, start, end: text.length })
          }
        } else {
          text += node.getTextContent()
        }
      } else if ($isElementNode(node)) {
        const children = node.getChildren()
        for (let i = 0; i < children.length; i++) {
          if (i > 0 && $isElementNode(children[i - 1])) {
            text += "\n"
          }
          walk(children[i] as ReturnType<typeof $getRoot>)
        }
        text += "\n"
      }
    }

    walk(root as unknown as ReturnType<typeof $getRoot>)
  })

  return { text, map }
}

/** Find which annotation (if any) covers a given text offset */
function findAnnotationAtOffset(annotations: Annotation[], offset: number): Annotation | null {
  for (const ann of annotations) {
    if (offset >= ann.offset && offset < ann.offset + ann.length) return ann
  }
  return null
}

/** Get the text offset at a DOM click position using caretPositionFromPoint / caretRangeFromPoint */
function getTextOffsetAtPoint(x: number, y: number, map: TextMapEntry[]): number | null {
  let range: Range | null = null

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
  } else if ("caretPositionFromPoint" in document) {
    const pos = (document as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint(x, y)
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.setEnd(pos.offsetNode, pos.offset)
    }
  }

  if (!range) return null

  const node = range.startContainer
  const charOffset = range.startOffset

  if (node.nodeType !== Node.TEXT_NODE) return null

  for (const entry of map) {
    if (entry.node === node) {
      return entry.start + charOffset
    }
  }
  return null
}

/** Get DOMRects for an annotation range */
function getRectsForAnnotation(ann: Annotation, map: TextMapEntry[]): DOMRect[] {
  const aStart = ann.offset
  const aEnd = ann.offset + ann.length
  const rects: DOMRect[] = []

  for (const entry of map) {
    if (entry.end <= aStart || entry.start >= aEnd) continue
    const relStart = Math.max(0, aStart - entry.start)
    const relEnd = Math.min(entry.node.textContent?.length ?? 0, aEnd - entry.start)
    try {
      const range = document.createRange()
      range.setStart(entry.node, relStart)
      range.setEnd(entry.node, relEnd)
      for (const r of range.getClientRects()) {
        rects.push(r)
      }
    } catch {
      // node changed
    }
  }
  return rects
}

// ── Inject global CSS for underlines (once) ──────────────

let cssInjected = false
function injectCSS() {
  if (cssInjected) return
  cssInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .spell-underline {
      position: absolute;
      pointer-events: none;
      background-repeat: repeat-x;
      background-position: bottom;
      background-size: 4px 3px;
    }
  `
  document.head.appendChild(style)
}

function makeWavySvgUrl(color: string) {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 2 Q1 0 2 2 Q3 4 4 2' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='1'/%3E%3C/svg%3E")`
}

// ── Component ──────────────────────────────────────────────

export function SpellCheckPlugin({ editor }: { editor: LexicalEditor }) {
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [underlines, setUnderlines] = useState<{ key: string; x: number; y: number; w: number; color: string }[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastTextRef = useRef("")
  const mapRef = useRef<TextMapEntry[]>([])
  const annotationsRef = useRef<Annotation[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(injectCSS, [])

  const getScrollParent = useCallback((): HTMLElement | null => {
    const rootEl = editor.getRootElement()
    return rootEl?.closest(".overflow-y-auto") as HTMLElement | null ?? rootEl?.parentElement ?? null
  }, [editor])

  const closePopover = useCallback(() => {
    setActiveAnnotation(null)
    setPopoverPos(null)
  }, [])

  // Compute underline positions from annotations + map
  const computeUnderlines = useCallback(() => {
    const scrollParent = getScrollParent()
    if (!scrollParent || annotationsRef.current.length === 0 || mapRef.current.length === 0) {
      setUnderlines([])
      return
    }

    const parentRect = scrollParent.getBoundingClientRect()
    const result: { key: string; x: number; y: number; w: number; color: string }[] = []

    for (let i = 0; i < annotationsRef.current.length; i++) {
      const ann = annotationsRef.current[i]
      const rects = getRectsForAnnotation(ann, mapRef.current)
      const color = UNDERLINE_COLORS[ann.type] || "#ef4444"
      for (let j = 0; j < rects.length; j++) {
        const r = rects[j]
        result.push({
          key: `${i}-${j}`,
          x: r.left - parentRect.left + scrollParent.scrollLeft,
          y: r.bottom - parentRect.top + scrollParent.scrollTop - 1,
          w: r.width,
          color,
        })
      }
    }

    setUnderlines(result)
  }, [getScrollParent])

  // Debounced spell check
  useEffect(() => {
    const runCheck = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const { text, map } = extractTextWithMap(editor)
        mapRef.current = map

        if (text === lastTextRef.current) return
        lastTextRef.current = text

        if (text.trim().length < 3) {
          annotationsRef.current = []
          setUnderlines([])
          return
        }

        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        try {
          const res = await authFetch("/checker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: controller.signal,
          })
          if (!res.ok) return
          const data = await res.json()
          annotationsRef.current = data.annotations ?? []
          computeUnderlines()
        } catch {
          // abort or network error
        }
      }, 1500)
    }

    const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
      closePopover()
      runCheck()
    })

    runCheck()

    return () => {
      unregister()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [editor, computeUnderlines, closePopover])

  // Recompute underlines on scroll/resize
  useEffect(() => {
    const scrollParent = getScrollParent()
    if (!scrollParent) return

    const handle = () => computeUnderlines()
    scrollParent.addEventListener("scroll", handle, { passive: true })
    window.addEventListener("resize", handle, { passive: true })
    return () => {
      scrollParent.removeEventListener("scroll", handle)
      window.removeEventListener("resize", handle)
    }
  }, [getScrollParent, computeUnderlines])

  // Click on editor — check if clicking on an annotated word
  useEffect(() => {
    const rootEl = editor.getRootElement()
    if (!rootEl) return

    const handleClick = (e: MouseEvent) => {
      // Re-extract map fresh to match current DOM
      const { map } = extractTextWithMap(editor)
      mapRef.current = map

      const offset = getTextOffsetAtPoint(e.clientX, e.clientY, map)
      if (offset === null) {
        closePopover()
        return
      }

      const ann = findAnnotationAtOffset(annotationsRef.current, offset)
      if (!ann) {
        closePopover()
        return
      }

      // Position popover below the word
      const rects = getRectsForAnnotation(ann, map)
      if (rects.length > 0) {
        const r = rects[0]
        setActiveAnnotation(ann)
        setPopoverPos({ x: r.left, y: r.bottom + 4 })
      }
    }

    rootEl.addEventListener("click", handleClick)
    return () => rootEl.removeEventListener("click", handleClick)
  }, [editor, closePopover])

  // Close popover on outside click
  useEffect(() => {
    if (!activeAnnotation) return
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return
      closePopover()
    }
    setTimeout(() => document.addEventListener("mousedown", handleMouseDown), 0)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [activeAnnotation, closePopover])

  const handleApplyReplacement = useCallback((replacement: string) => {
    if (!activeAnnotation) return

    editor.update(() => {
      const root = $getRoot()
      let offset = 0
      const aStart = activeAnnotation!.offset
      const aEnd = aStart + activeAnnotation!.length

      // Mirror the exact offset logic from extractTextWithMap
      function walkReplace(node: ReturnType<typeof $getRoot>): boolean {
        if ($isTextNode(node)) {
          const content = node.getTextContent()
          const nodeStart = offset
          const nodeEnd = offset + content.length

          if (nodeStart < aEnd && nodeEnd > aStart) {
            const replaceStart = Math.max(0, aStart - nodeStart)
            const replaceEnd = Math.min(content.length, aEnd - nodeStart)
            const newContent = content.slice(0, replaceStart) + replacement + content.slice(replaceEnd)
            node.setTextContent(newContent)
            return true
          }
          offset += content.length
        } else if ($isElementNode(node)) {
          const children = node.getChildren()
          for (let i = 0; i < children.length; i++) {
            if (i > 0 && $isElementNode(children[i - 1])) {
              offset += 1 // newline between sibling elements
            }
            if (walkReplace(children[i] as ReturnType<typeof $getRoot>)) return true
          }
          offset += 1 // trailing newline after element
        }
        return false
      }

      walkReplace(root as unknown as ReturnType<typeof $getRoot>)
    })

    // Adjust subsequent annotation offsets
    const lenDiff = replacement.length - activeAnnotation.length
    annotationsRef.current = annotationsRef.current
      .filter((a) => a.offset !== activeAnnotation.offset)
      .map((a) => a.offset > activeAnnotation.offset ? { ...a, offset: a.offset + lenDiff } : a)

    closePopover()
    lastTextRef.current = "" // force re-check
  }, [editor, activeAnnotation, closePopover])

  const handleDismiss = useCallback(() => {
    if (!activeAnnotation) return
    annotationsRef.current = annotationsRef.current.filter((a) => a.offset !== activeAnnotation.offset)
    closePopover()
    computeUnderlines()
  }, [activeAnnotation, closePopover, computeUnderlines])

  const scrollParent = getScrollParent()

  return (
    <>
      {/* Underline overlay */}
      {scrollParent && underlines.length > 0 && createPortal(
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}
        >
          {underlines.map((u) => (
            <div
              key={u.key}
              className="spell-underline"
              style={{
                left: u.x,
                top: u.y,
                width: u.w,
                height: 3,
                backgroundImage: makeWavySvgUrl(u.color),
              }}
            />
          ))}
        </div>,
        scrollParent,
      )}

      {/* Popover */}
      {activeAnnotation && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-72 rounded-lg border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ left: popoverPos.x, top: popoverPos.y }}
        >
          <div className="flex items-start gap-2 mb-2">
            <span
              className="mt-1 inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: UNDERLINE_COLORS[activeAnnotation.type] }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium capitalize text-muted-foreground">{activeAnnotation.type}</p>
              <p className="text-sm leading-snug">{activeAnnotation.message}</p>
            </div>
          </div>
          {activeAnnotation.replacements?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {activeAnnotation.replacements.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyReplacement(r)}
                  className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
