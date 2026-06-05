import { useState, useEffect, useRef, useCallback, type JSX } from "react"
import {
  realmPlugin,
  addExportVisitor$,
  addLexicalNode$,
  addComposerChild$,
  useCellValue,
  imagePreviewHandler$,
  ImageNode,
} from "@mdxeditor/editor"
import type { LexicalExportVisitor } from "@mdxeditor/editor"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection"
import { mergeRegister } from "@lexical/utils"
import {
  DecoratorNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  DRAGSTART_COMMAND,
} from "lexical"
import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical"
import type { RootContent } from "mdast"

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv",
])

function isVideoUrl(url: string): boolean {
  const pathname = url.split("?")[0].toLowerCase()
  const dot = pathname.lastIndexOf(".")
  return dot >= 0 && VIDEO_EXTENSIONS.has(pathname.slice(dot))
}

// ---------------------------------------------------------------------------
// Node transform — replaces ImageNodes with video URLs with VideoNodes
// ---------------------------------------------------------------------------

function VideoNodeTransform() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerNodeTransform(ImageNode, (node) => {
      const src = node.getSrc()
      if (!isVideoUrl(src)) return

      // Extract width from the title field (e.g. "width=400")
      let width: number | "inherit" = "inherit"
      const title = node.getTitle() ?? ""
      const widthMatch = title.match(/^width=(\d+)$/)
      if (widthMatch) {
        width = Number(widthMatch[1])
      }

      const videoNode = $createVideoNode({
        src,
        altText: node.getAltText(),
        width,
      })
      node.replace(videoNode)
    })
  }, [editor])

  return null
}

// ---------------------------------------------------------------------------
// Resize handle component
// ---------------------------------------------------------------------------

function VideoResizer({
  videoRef,
  onResizeEnd,
  editor,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onResizeEnd: (width: number) => void
  editor: LexicalEditor
}) {
  const startRef = useRef({ x: 0, w: 0 })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editor.isEditable()) return
      const video = videoRef.current
      if (!video) return
      e.preventDefault()
      e.stopPropagation()
      const rect = video.getBoundingClientRect()
      startRef.current = { x: e.clientX, w: rect.width }
      document.body.style.setProperty("cursor", "nwse-resize", "important")
      document.body.style.setProperty("-webkit-user-select", "none", "important")

      const handlePointerMove = (ev: PointerEvent) => {
        const s = startRef.current
        const diff = ev.clientX - s.x
        const editorRoot = editor.getRootElement()
        const maxW = editorRoot ? editorRoot.getBoundingClientRect().width - 20 : 800
        const newW = Math.max(100, Math.min(s.w + diff, maxW))
        video.style.width = `${newW}px`
      }

      const handlePointerUp = () => {
        document.body.style.removeProperty("cursor")
        document.body.style.removeProperty("-webkit-user-select")
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
        const finalW = Math.round(video.getBoundingClientRect().width)
        onResizeEnd(finalW)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    },
    [editor, videoRef, onResizeEnd],
  )

  return (
    <div
      onPointerDown={handlePointerDown}
      className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize border-b-2 border-r-2 border-primary"
    />
  )
}

// ---------------------------------------------------------------------------
// Video display component (rendered inside editor)
// ---------------------------------------------------------------------------

function VideoDisplay({
  src,
  alt,
  nodeKey,
  width,
}: {
  src: string
  alt: string
  nodeKey: NodeKey
  width: number | "inherit"
}) {
  const imagePreviewHandler = useCellValue(imagePreviewHandler$)
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let cancelled = false
    if (imagePreviewHandler) {
      imagePreviewHandler(src).then((url) => {
        if (!cancelled) setResolvedSrc(url)
      })
    } else {
      setResolvedSrc(src)
    }
    return () => { cancelled = true }
  }, [src, imagePreviewHandler])

  // Selection / deletion commands
  useEffect(() => {
    const onDelete = () => {
      if (isSelected && $isNodeSelection($getSelection())) {
        const node = $getNodeByKey(nodeKey)
        if ($isVideoNode(node)) node.remove()
        return true
      }
      return false
    }

    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const el = videoRef.current
          if (!el) return false
          if (el === event.target || el.parentElement?.contains(event.target as Node)) {
            clearSelection()
            setSelected(true)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event: DragEvent) => {
          if (event.target === videoRef.current) {
            event.preventDefault()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
    )
  }, [editor, isSelected, nodeKey, setSelected, clearSelection])

  // Sync width — height auto-adjusts
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (typeof width === "number") {
      video.style.width = `${width}px`
    } else {
      video.style.removeProperty("width")
    }
  }, [width])

  const onResizeEnd = useCallback(
    (nextWidth: number) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isVideoNode(node)) {
          node.setWidth(nextWidth)
        }
      })
    },
    [editor, nodeKey],
  )

  if (!resolvedSrc) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading video…
      </div>
    )
  }

  return (
    <div
      className={`relative inline-block max-w-full ${isSelected ? "ring-1 ring-primary" : ""}`}
      data-editor-block-type="video"
    >
      <video
        ref={videoRef}
        src={resolvedSrc}
        controls
        className="max-w-full rounded-md"
        title={alt}
        draggable={false}
      />
      {isSelected && (
        <VideoResizer videoRef={videoRef} onResizeEnd={onResizeEnd} editor={editor} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Serialized node type
// ---------------------------------------------------------------------------

type SerializedVideoNode = Spread<
  { type: "video"; src: string; altText: string; width: number; version: 1 },
  SerializedLexicalNode
>

// ---------------------------------------------------------------------------
// VideoNode
// ---------------------------------------------------------------------------

export class VideoNode extends DecoratorNode<JSX.Element> {
  __src: string
  __altText: string
  __width: number | "inherit"

  static getType(): string {
    return "video"
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(node.__src, node.__altText, node.__width, node.__key)
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    return new VideoNode(
      serializedNode.src,
      serializedNode.altText,
      serializedNode.width || "inherit",
    )
  }

  constructor(
    src: string,
    altText: string,
    width?: number | "inherit",
    key?: NodeKey,
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width ?? "inherit"
  }

  exportJSON(): SerializedVideoNode {
    return {
      type: "video",
      src: this.__src,
      altText: this.__altText,
      width: this.__width === "inherit" ? 0 : this.__width,
      version: 1,
    }
  }

  setWidth(width: number): void {
    const writable = this.getWritable()
    writable.__width = width
  }

  getWidth(): number | "inherit" {
    return this.__width
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div")
    div.setAttribute("data-editor-block-type", "video")
    return div
  }

  exportDOM(): DOMExportOutput {
    const video = document.createElement("video")
    video.src = this.__src
    video.controls = true
    if (this.__altText) video.title = this.__altText
    if (this.__width !== "inherit") video.width = this.__width
    return { element: video }
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  updateDOM(): false {
    return false
  }

  isInline(): boolean {
    return false
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <VideoDisplay
        src={this.__src}
        alt={this.__altText}
        nodeKey={this.__key}
        width={this.__width}
      />
    )
  }
}

export function $createVideoNode({
  src,
  altText,
  width,
}: {
  src: string
  altText: string
  width?: number | "inherit"
}): VideoNode {
  return new VideoNode(src, altText, width)
}

export function $isVideoNode(node: LexicalNode | null | undefined): node is VideoNode {
  return node instanceof VideoNode
}

// ---------------------------------------------------------------------------
// Lexical Export Visitor — always outputs markdown image syntax
// ---------------------------------------------------------------------------

const LexicalVideoVisitor: LexicalExportVisitor<VideoNode, RootContent> = {
  testLexicalNode: $isVideoNode,
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    const title = lexicalNode.__width !== "inherit" ? `width=${lexicalNode.__width}` : null
    actions.appendToParent(mdastParent, {
      type: "image",
      url: lexicalNode.__src,
      alt: lexicalNode.__altText,
      title,
    } as unknown as RootContent)
  },
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const videoPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addExportVisitor$]: [LexicalVideoVisitor],
      [addLexicalNode$]: [VideoNode],
      [addComposerChild$]: [VideoNodeTransform],
    })
  },
})
