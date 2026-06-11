import { useEffect, useState } from "react"
import * as XLSX from "xlsx"

import { authFetch } from "@/lib/auth-fetch"
import { EditorHeader } from "./EditorHeader"

const MAX_RENDERED_ROWS = 1000

interface SpreadsheetViewerProps {
  repoSlug: string
  filePath: string
  onRename?: () => void
  onDelete?: () => void
}

type SheetData = {
  name: string
  rows: (string | number | boolean | null)[][]
}

/** Read-only table viewer for .xlsx and .csv files. */
export function SpreadsheetViewer({ repoSlug, filePath, onRename, onDelete }: SpreadsheetViewerProps) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)
  const [error, setError] = useState("")

  const rawFileName = filePath.split("/").pop() ?? ""

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setActiveSheet(0)
    setError("")

    authFetch(`/repos/${encodeURIComponent(repoSlug)}/file/${filePath}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        const buf = await res.arrayBuffer()
        const workbook = XLSX.read(buf)
        const parsed: SheetData[] = workbook.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
            header: 1,
            defval: null,
          }) as SheetData["rows"],
        }))
        if (!cancelled) setSheets(parsed)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to parse spreadsheet")
      })
    return () => {
      cancelled = true
    }
  }, [repoSlug, filePath])

  if (error) {
    return <p className="px-6 text-destructive text-sm">{error}</p>
  }
  if (sheets === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

  const sheet = sheets[activeSheet]
  const allRows = sheet?.rows ?? []
  const headerRow = allRows[0] ?? []
  const dataRows = allRows.slice(1, 1 + MAX_RENDERED_ROWS)
  const truncated = allRows.length - 1 > MAX_RENDERED_ROWS
  const colCount = Math.max(headerRow.length, ...dataRows.map((r) => r.length), 1)
  const columns = Array.from({ length: colCount }, (_, i) => i)

  return (
    <div className="flex flex-col -mt-3" style={{ height: "calc(100% + 0.75rem)" }}>
      <EditorHeader fileName={rawFileName} onRename={onRename} onDelete={onDelete} />

      {sheets.length > 1 && (
        <div className="flex gap-1 border-b px-4 py-1.5 overflow-x-auto">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
                (i === activeSheet
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {allRows.length === 0 ? (
          <p className="py-4 text-muted-foreground text-sm">This sheet is empty.</p>
        ) : (
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((i) => (
                  <th
                    key={i}
                    className="sticky top-0 border bg-muted px-3 py-1.5 text-left font-medium whitespace-nowrap"
                  >
                    {headerRow[i] ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="even:bg-muted/30">
                  {columns.map((ci) => (
                    <td key={ci} className="border px-3 py-1 whitespace-nowrap">
                      {row[ci] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {truncated && (
          <p className="py-3 text-xs text-muted-foreground">
            Showing the first {MAX_RENDERED_ROWS.toLocaleString()} of {(allRows.length - 1).toLocaleString()} rows.
          </p>
        )}
      </div>
    </div>
  )
}
