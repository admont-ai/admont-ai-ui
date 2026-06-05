/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "tui-image-editor" {
  interface ImageEditorOptions {
    includeUI?: {
      loadImage?: { path: string; name: string }
      theme?: Record<string, unknown>
      menuBarPosition?: string
      [key: string]: unknown
    }
    cssMaxWidth?: number
    cssMaxHeight?: number
    usageStatistics?: boolean
    [key: string]: unknown
  }
  export default class ImageEditor {
    constructor(element: HTMLElement, options: ImageEditorOptions)
    loadImageFromURL(url: string, fileName: string): Promise<{ oldWidth: number; oldHeight: number; newWidth: number; newHeight: number }>
    toDataURL(options?: { format?: string; quality?: number }): string
    destroy(): void
    ui: { resizeEditor: () => void }
  }
}

