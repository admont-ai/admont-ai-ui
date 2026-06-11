import { type RefObject, useEffect, useImperativeHandle, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community"
import { AgGridReact } from "ag-grid-react"

import { authFetch } from "@/lib/auth-fetch"
import type { DiagramSourceHandle } from "@/types"
import { EditorHeader } from "./EditorHeader"

ModuleRegistry.registerModules([AllCommunityModule])

// Quartz theme with alternating row shading (tinted from the app's muted
// color) and compact spacing for denser rows.
const gridTheme = themeQuartz.withParams({
  oddRowBackgroundColor: "color-mix(in srgb, var(--muted) 50%, transparent)",
  spacing: 4,
})

interface SpreadsheetViewerProps {
  repoSlug: string
  filePath: string
  handleRef?: RefObject<DiagramSourceHandle | null>
  onRename?: () => void
  onDelete?: () => void
}

// Caps for the AI page context built from the active sheet.
const MAX_CONTEXT_ROWS = 300
const MAX_CONTEXT_CHARS = 20_000

type CellValue = string | number | boolean | null

type SheetData = {
  name: string
  rows: CellValue[][]
}

/** Read-only table viewer for .xlsx and .csv files with sorting & filtering. */
export function SpreadsheetViewer({ repoSlug, filePath, handleRef, onRename, onDelete }: SpreadsheetViewerProps) {
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

  const sheet = sheets?.[activeSheet]

  const { columnDefs, rowData } = useMemo(() => {
    const allRows = sheet?.rows ?? []
    const headerRow = allRows[0] ?? []
    const dataRows = allRows.slice(1)
    const colCount = Math.max(headerRow.length, ...dataRows.map((r) => r.length), 1)

    const columnDefs: ColDef[] = Array.from({ length: colCount }, (_, i) => ({
      field: String(i),
      headerName: headerRow[i] != null && String(headerRow[i]).trim() !== "" ? String(headerRow[i]) : `Column ${i + 1}`,
    }))

    const rowData = dataRows.map((row) => {
      const obj: Record<string, CellValue> = {}
      for (let i = 0; i < colCount; i++) {
        obj[String(i)] = row[i] ?? null
      }
      return obj
    })

    return { columnDefs, rowData }
  }, [sheet])

  // Expose the active sheet as text so the AI assistant can analyze it as
  // page context. The viewer is read-only, so setSource is a no-op.
  useImperativeHandle(handleRef, () => ({
    getSource: () => {
      if (!sheets || !sheet) return ""
      const fileName = filePath.split("/").pop() ?? filePath
      const allRows = sheet.rows
      const dataRowCount = Math.max(allRows.length - 1, 0)

      const lines: string[] = [
        `Spreadsheet "${fileName}" — sheet "${sheet.name}" (${dataRowCount} data rows)`,
      ]
      const others = sheets.filter((_, i) => i !== activeSheet).map((s) => s.name)
      if (others.length > 0) {
        lines.push(`Other sheets (not included): ${others.join(", ")}`)
      }

      let chars = lines.join("\n").length
      let included = 0
      for (let i = 0; i < allRows.length && included < MAX_CONTEXT_ROWS + 1; i++) {
        const line = allRows[i].map((c) => (c == null ? "" : String(c))).join(" | ")
        if (chars + line.length > MAX_CONTEXT_CHARS) break
        lines.push(line)
        chars += line.length + 1
        included++
      }
      const includedDataRows = Math.max(included - 1, 0)
      if (includedDataRows < dataRowCount) {
        lines.push(`… (truncated, ${dataRowCount - includedDataRows} more rows)`)
      }
      return lines.join("\n")
    },
    setSource: () => {},
  }), [sheets, sheet, activeSheet, filePath])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    // Filters open from the funnel button in the column header (no floating filter row).
    filter: true,
    resizable: true,
    minWidth: 100,
  }), [])

  if (error) {
    return <p className="px-6 text-destructive text-sm">{error}</p>
  }
  if (sheets === null) {
    return <p className="px-6 text-muted-foreground">Loading…</p>
  }

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

      <div className="min-h-0 flex-1 px-4 pb-4 pt-3">
        {rowData.length === 0 ? (
          <p className="py-4 text-muted-foreground text-sm">This sheet is empty.</p>
        ) : (
          <AgGridReact
            key={`${filePath}-${activeSheet}`}
            theme={gridTheme}
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={defaultColDef}
          />
        )}
      </div>
    </div>
  )
}
