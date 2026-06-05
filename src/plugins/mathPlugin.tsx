import { useState, useEffect, useRef, useCallback, type JSX } from "react"
import {
  realmPlugin,
  addMdastExtension$,
  addSyntaxExtension$,
  addToMarkdownExtension$,
  addImportVisitor$,
  addExportVisitor$,
  addLexicalNode$,
} from "@mdxeditor/editor"
import type { MdastImportVisitor, LexicalExportVisitor } from "@mdxeditor/editor"
import { DecoratorNode, $getNodeByKey } from "lexical"
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
import katex from "katex"
import { math } from "micromark-extension-math"
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math"
import type { Nodes as MdastNodes, RootContent } from "mdast"

// ---------------------------------------------------------------------------
// Shared inline editor component
// ---------------------------------------------------------------------------

function MathEditor({
  initialValue,
  displayMode,
  onConfirm,
  onCancel,
}: {
  initialValue: string
  displayMode: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    if (ref.current instanceof HTMLTextAreaElement) {
      ref.current.selectionStart = ref.current.value.length
    }
  }, [])

  const confirm = useCallback(() => {
    onConfirm(value)
  }, [value, onConfirm])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (!displayMode || e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        confirm()
      }
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    },
    [confirm, onCancel, displayMode],
  )

  if (displayMode) {
    return (
      <div
        className="math-editor-overlay"
        style={{
          padding: "8px",
          border: "1px solid var(--accentBorderColor, #ccc)",
          borderRadius: "4px",
          background: "var(--bgColor, #fff)",
          margin: "4px 0",
        }}
      >
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={confirm}
          rows={4}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "14px",
            resize: "vertical",
            border: "1px solid #ddd",
            borderRadius: "2px",
            padding: "4px",
          }}
        />
      </div>
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={confirm}
      style={{
        fontFamily: "monospace",
        fontSize: "inherit",
        border: "1px solid var(--accentBorderColor, #ccc)",
        borderRadius: "2px",
        padding: "0 4px",
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Rendered math display component
// ---------------------------------------------------------------------------

function MathDisplay({
  value,
  displayMode,
  nodeKey,
  editor,
}: {
  value: string
  displayMode: boolean
  nodeKey: NodeKey
  editor: LexicalEditor
}) {
  const [editing, setEditing] = useState(false)

  const html = katex.renderToString(value, {
    displayMode,
    throwOnError: false,
  })

  const handleConfirm = useCallback(
    (newValue: string) => {
      setEditing(false)
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if (node && ("setValue" in node)) {
          ;(node as InlineMathNode | BlockMathNode).setValue(newValue)
        }
      })
    },
    [editor, nodeKey],
  )

  const handleCancel = useCallback(() => {
    setEditing(false)
  }, [])

  if (editing) {
    return (
      <MathEditor
        initialValue={value}
        displayMode={displayMode}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    )
  }

  if (displayMode) {
    return (
      <div
        className="math-block"
        onClick={() => setEditing(true)}
        style={{ cursor: "pointer", textAlign: "center", margin: "1em 0" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <span
      className="math-inline"
      onClick={() => setEditing(true)}
      style={{ cursor: "pointer" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// Serialized node types
// ---------------------------------------------------------------------------

type SerializedInlineMathNode = Spread<
  { type: "inline-math"; value: string; version: 1 },
  SerializedLexicalNode
>

type SerializedBlockMathNode = Spread<
  { type: "block-math"; value: string; version: 1 },
  SerializedLexicalNode
>

// ---------------------------------------------------------------------------
// InlineMathNode
// ---------------------------------------------------------------------------

export class InlineMathNode extends DecoratorNode<JSX.Element> {
  __value: string

  static getType(): string {
    return "inline-math"
  }

  static clone(node: InlineMathNode): InlineMathNode {
    return new InlineMathNode(node.__value, node.__key)
  }

  static importJSON(serializedNode: SerializedInlineMathNode): InlineMathNode {
    return new InlineMathNode(serializedNode.value)
  }

  constructor(value: string, key?: NodeKey) {
    super(key)
    this.__value = value
  }

  exportJSON(): SerializedInlineMathNode {
    return {
      type: "inline-math",
      value: this.__value,
      version: 1,
    }
  }

  createDOM(_config: EditorConfig): HTMLSpanElement {
    return document.createElement("span")
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span")
    element.innerHTML = katex.renderToString(this.__value, {
      displayMode: false,
      throwOnError: false,
    })
    return { element }
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  updateDOM(): false {
    return false
  }

  isInline(): boolean {
    return true
  }

  getValue(): string {
    return this.__value
  }

  setValue(value: string): void {
    const writable = this.getWritable()
    writable.__value = value
  }

  decorate(editor: LexicalEditor): JSX.Element {
    return (
      <MathDisplay
        value={this.__value}
        displayMode={false}
        nodeKey={this.__key}
        editor={editor}
      />
    )
  }
}

export function $createInlineMathNode(value: string): InlineMathNode {
  return new InlineMathNode(value)
}

export function $isInlineMathNode(
  node: LexicalNode | null | undefined,
): node is InlineMathNode {
  return node instanceof InlineMathNode
}

// ---------------------------------------------------------------------------
// BlockMathNode
// ---------------------------------------------------------------------------

export class BlockMathNode extends DecoratorNode<JSX.Element> {
  __value: string

  static getType(): string {
    return "block-math"
  }

  static clone(node: BlockMathNode): BlockMathNode {
    return new BlockMathNode(node.__value, node.__key)
  }

  static importJSON(serializedNode: SerializedBlockMathNode): BlockMathNode {
    return new BlockMathNode(serializedNode.value)
  }

  constructor(value: string, key?: NodeKey) {
    super(key)
    this.__value = value
  }

  exportJSON(): SerializedBlockMathNode {
    return {
      type: "block-math",
      value: this.__value,
      version: 1,
    }
  }

  createDOM(_config: EditorConfig): HTMLDivElement {
    return document.createElement("div")
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div")
    element.innerHTML = katex.renderToString(this.__value, {
      displayMode: true,
      throwOnError: false,
    })
    return { element }
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

  getValue(): string {
    return this.__value
  }

  setValue(value: string): void {
    const writable = this.getWritable()
    writable.__value = value
  }

  decorate(editor: LexicalEditor): JSX.Element {
    return (
      <MathDisplay
        value={this.__value}
        displayMode={true}
        nodeKey={this.__key}
        editor={editor}
      />
    )
  }
}

export function $createBlockMathNode(value: string): BlockMathNode {
  return new BlockMathNode(value)
}

export function $isBlockMathNode(
  node: LexicalNode | null | undefined,
): node is BlockMathNode {
  return node instanceof BlockMathNode
}

// ---------------------------------------------------------------------------
// Mdast Import Visitors
// ---------------------------------------------------------------------------

const MdastInlineMathVisitor: MdastImportVisitor<MdastNodes> = {
  testNode: "inlineMath",
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto(
      $createInlineMathNode((mdastNode as { value: string }).value),
    )
  },
}

const MdastBlockMathVisitor: MdastImportVisitor<MdastNodes> = {
  testNode: "math",
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto(
      $createBlockMathNode((mdastNode as { value: string }).value),
    )
  },
}

// ---------------------------------------------------------------------------
// Lexical Export Visitors
// ---------------------------------------------------------------------------

const LexicalInlineMathVisitor: LexicalExportVisitor<InlineMathNode, RootContent> = {
  testLexicalNode: $isInlineMathNode,
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: "inlineMath" as unknown as "text",
      value: lexicalNode.getValue(),
    } as unknown as RootContent)
  },
}

const LexicalBlockMathVisitor: LexicalExportVisitor<BlockMathNode, RootContent> = {
  testLexicalNode: $isBlockMathNode,
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: "math" as unknown as "code",
      value: lexicalNode.getValue(),
    } as unknown as RootContent)
  },
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const mathPlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addMdastExtension$]: mathFromMarkdown(),
      [addSyntaxExtension$]: math(),
      [addToMarkdownExtension$]: mathToMarkdown(),
      [addImportVisitor$]: [MdastInlineMathVisitor, MdastBlockMathVisitor],
      [addExportVisitor$]: [LexicalInlineMathVisitor, LexicalBlockMathVisitor],
      [addLexicalNode$]: [InlineMathNode, BlockMathNode],
    })
  },
})
