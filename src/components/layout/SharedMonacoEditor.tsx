import { useCallback, useRef, useState } from "react"
import { Hash, Minus, Plus, Redo2, Search, Undo2, WrapText } from "lucide-react"
import Editor, { DiffEditor } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import "@/lib/monaco-theme"
import { Button } from "@/components/ui/button"

interface SharedMonacoEditorProps {
  language: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  diffOriginal?: string
  diffSideBySide?: boolean
  onCursorChange?: (pos: { line: number; column: number }) => void
  onEditorRef?: (editor: editor.IStandaloneCodeEditor | null) => void
}

function injectTooltipCSS() {
  if (document.getElementById("monaco-no-tooltips")) return
  const style = document.createElement("style")
  style.id = "monaco-no-tooltips"
  style.textContent = `
    .monaco-editor-hover,
    .monaco-hover,
    .monaco-tooltip,
    .action-widget,
    .shadow-root-host .monaco-hover,
    div[widgetid="editor.contrib.modesGlyphHoverWidget"],
    div[widgetid="editor.contrib.modesContentHoverWidget"],
    .monaco-editor .find-widget .button[aria-label]::after,
    .monaco-editor .monaco-custom-toggle[aria-label]::after { display: none !important; pointer-events: none !important; }
    .monaco-editor .find-widget { right: 0 !important; }
  `
  document.head.appendChild(style)
}

export function SharedMonacoEditor({
  language,
  value,
  onChange,
  readOnly,
  diffOriginal,
  diffSideBySide = true,
  onCursorChange,
  onEditorRef,
}: SharedMonacoEditorProps) {
  const [wordWrap, setWordWrap] = useState(true)
  const [lineNumbers, setLineNumbers] = useState(true)
  const [fontSize, setFontSize] = useState(13)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const onCursorChangeRef = useRef(onCursorChange)
  onCursorChangeRef.current = onCursorChange

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed
    injectTooltipCSS()
    const pos = ed.getPosition()
    if (pos) onCursorChangeRef.current?.({ line: pos.lineNumber, column: pos.column })
    ed.onDidChangeCursorPosition((e) => {
      onCursorChangeRef.current?.({ line: e.position.lineNumber, column: e.position.column })
    })
    onEditorRef?.(ed)
  }, [onEditorRef])

  const handleDiffMount = useCallback((diffEditor: editor.IStandaloneDiffEditor) => {
    const ed = diffEditor.getModifiedEditor() as editor.IStandaloneCodeEditor
    editorRef.current = ed
    injectTooltipCSS()
    onEditorRef?.(ed)
  }, [onEditorRef])

  const isDiff = diffOriginal != null
  const isEditable = !readOnly && !isDiff

  const options: editor.IStandaloneEditorConstructionOptions = {
    readOnly: readOnly || isDiff,
    minimap: { enabled: false },
    fontSize,
    lineNumbers: lineNumbers ? "on" : "off",
    wordWrap: wordWrap ? "on" : "off",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    find: { addExtraSpaceOnTop: false, ...(isEditable ? { seedSearchStringFromSelection: "selection" as const } : {}) },
    ...(isDiff ? { renderSideBySide: diffSideBySide } : {}),
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b bg-neutral-100 px-2 py-1 dark:bg-neutral-800 [&_button:hover]:bg-neutral-200 dark:[&_button:hover]:bg-neutral-700">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Line numbers"
          className={lineNumbers ? "bg-neutral-200 dark:bg-neutral-700" : ""}
          onClick={() => {
            const next = !lineNumbers
            setLineNumbers(next)
            editorRef.current?.updateOptions({ lineNumbers: next ? "on" : "off" })
          }}
        >
          <Hash className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Word wrap"
          className={wordWrap ? "bg-neutral-200 dark:bg-neutral-700" : ""}
          onClick={() => {
            const next = !wordWrap
            setWordWrap(next)
            editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" })
          }}
        >
          <WrapText className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const next = Math.max(8, fontSize - 1)
            setFontSize(next)
            editorRef.current?.updateOptions({ fontSize: next })
          }}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[2ch] text-center text-xs text-muted-foreground tabular-nums">{fontSize}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const next = Math.min(30, fontSize + 1)
            setFontSize(next)
            editorRef.current?.updateOptions({ fontSize: next })
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Find"
          onClick={() => editorRef.current?.trigger("toolbar", isEditable ? "editor.action.startFindReplaceAction" : "actions.find", null)}
        >
          <Search className="h-4 w-4" />
        </Button>
        {isEditable && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              title="Undo"
              onClick={() => editorRef.current?.trigger("toolbar", "undo", null)}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Redo"
              onClick={() => editorRef.current?.trigger("toolbar", "redo", null)}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1">
        {isDiff ? (
          <DiffEditor
            language={language}
            original={diffOriginal}
            modified={value}
            theme="wiki-light"
            onMount={handleDiffMount}
            options={options}
          />
        ) : (
          <Editor
            language={language}
            value={value}
            onChange={onChange ? (v) => onChange(v ?? "") : undefined}
            onMount={handleMount}
            theme="wiki-light"
            options={options}
          />
        )}
      </div>
    </div>
  )
}
