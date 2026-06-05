import { loader } from "@monaco-editor/react"
import { setupMarkdownProviders } from "./monaco-markdown"

loader.init().then((monaco) => {
  setupMarkdownProviders(monaco)
  monaco.editor.defineTheme("light-grey", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#f5f5f5",
    },
  })
})
