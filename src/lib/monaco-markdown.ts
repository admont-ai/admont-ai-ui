import type * as Monaco from "monaco-editor"

export function setupMarkdownProviders(monaco: typeof Monaco) {
  // ---------- Formatting provider (prettier, lazy-loaded) ----------
  monaco.languages.registerDocumentFormattingEditProvider("markdown", {
    displayName: "Prettier",
    async provideDocumentFormattingEdits(model) {
      const [prettier, markdownPlugin] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/markdown"),
      ])

      const text = model.getValue()
      const formatted = await prettier.format(text, {
        parser: "markdown",
        plugins: [markdownPlugin.default ?? markdownPlugin],
      })

      const fullRange = model.getFullModelRange()
      return [{ range: fullRange, text: formatted }]
    },
  })

  // ---------- Completion provider (snippets) ----------
  monaco.languages.registerCompletionItemProvider("markdown", {
    triggerCharacters: ["#", "[", "!", "`", "-", ":"],

    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber)
      const word = model.getWordUntilPosition(position)
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      }

      const snippetKind = monaco.languages.CompletionItemKind.Snippet
      const insertAsSnippet =
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet

      const suggestions: Monaco.languages.CompletionItem[] = []

      const atLineStart =
        lineContent.substring(0, position.column - 1).trim().length <= 1

      if (atLineStart) {
        // Headings
        for (let i = 1; i <= 6; i++) {
          const hashes = "#".repeat(i)
          suggestions.push({
            label: `${hashes} Heading ${i}`,
            kind: snippetKind,
            insertText: `${hashes} $0`,
            insertTextRules: insertAsSnippet,
            detail: `Heading level ${i}`,
            range,
          })
        }

        // Link
        suggestions.push({
          label: "[link](url)",
          kind: snippetKind,
          insertText: "[${1:text}](${2:url})$0",
          insertTextRules: insertAsSnippet,
          detail: "Insert link",
          range,
        })

        // Image
        suggestions.push({
          label: "![image](url)",
          kind: snippetKind,
          insertText: "![${1:alt}](${2:url})$0",
          insertTextRules: insertAsSnippet,
          detail: "Insert image",
          range,
        })

        // Code fence
        suggestions.push({
          label: "``` code fence",
          kind: snippetKind,
          insertText: "```${1:language}\n$0\n```",
          insertTextRules: insertAsSnippet,
          detail: "Fenced code block",
          range,
        })

        // Table
        suggestions.push({
          label: "table",
          kind: snippetKind,
          insertText:
            "| ${1:Header 1} | ${2:Header 2} |\n| --- | --- |\n| ${3:Cell 1} | ${4:Cell 2} |$0",
          insertTextRules: insertAsSnippet,
          detail: "Insert 2×2 table",
          range,
        })

        // Checklist
        suggestions.push({
          label: "- [ ] checklist",
          kind: snippetKind,
          insertText: "- [ ] $0",
          insertTextRules: insertAsSnippet,
          detail: "Checklist item",
          range,
        })

        // Frontmatter
        suggestions.push({
          label: "--- frontmatter",
          kind: snippetKind,
          insertText: "---\n${1:key}: ${2:value}\n---$0",
          insertTextRules: insertAsSnippet,
          detail: "YAML frontmatter block",
          range,
        })

        // Admonition
        suggestions.push({
          label: ":::note admonition",
          kind: snippetKind,
          insertText: ":::${1:note}\n$0\n:::",
          insertTextRules: insertAsSnippet,
          detail: "Admonition block",
          range,
        })
      }

      return { suggestions }
    },
  })
}
