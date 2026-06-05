interface CodePreviewPanelProps {
  code: string
  previewHtml: string
  previewError: string
}

export function CodePreviewPanel({
  code,
  previewHtml,
  previewError,
}: CodePreviewPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Code display */}
      <div className="flex-1 overflow-auto border-b border-gray-200">
        <div className="p-2">
          <h4 className="mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Generated Code
          </h4>
          <pre className="whitespace-pre-wrap break-words rounded bg-gray-50 p-2 font-mono text-xs text-gray-700">
            {code || "// No code generated yet"}
          </pre>
        </div>
      </div>

      {/* Preview display */}
      <div className="flex-1 overflow-auto">
        <div className="p-2">
          <h4 className="mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Preview
          </h4>
          {previewError ? (
            <p className="text-xs text-red-500">{previewError}</p>
          ) : previewHtml ? (
            <div
              className="flex items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-xs text-gray-400">Preview will appear here...</p>
          )}
        </div>
      </div>
    </div>
  )
}
