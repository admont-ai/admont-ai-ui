import { loader } from "@monaco-editor/react"
import { setupMarkdownProviders } from "./monaco-markdown"

loader.init().then((monaco) => {
  setupMarkdownProviders(monaco)
  monaco.editor.defineTheme("wiki-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
    },
  })
})
