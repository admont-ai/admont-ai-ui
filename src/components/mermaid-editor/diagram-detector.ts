import type { DiagramType, VisualDiagramType } from "./types"

const VISUAL_TYPES = new Set<VisualDiagramType>([
  "flowchart",
  "stateDiagram",
  "classDiagram",
  "erDiagram",
])

export interface DetectionResult {
  type: DiagramType
  isVisual: boolean
}

/**
 * Detect the diagram type from mermaid code.
 * Uses simple keyword matching on the first non-empty line.
 */
export function detectDiagramType(code: string): DetectionResult {
  const trimmed = code.trim()
  const firstLine = trimmed.split("\n")[0].trim().toLowerCase()

  // Check each known prefix
  if (firstLine.startsWith("graph ") || firstLine.startsWith("flowchart")) {
    return { type: "flowchart", isVisual: true }
  }
  if (firstLine.startsWith("statediagram")) {
    return { type: "stateDiagram", isVisual: true }
  }
  if (firstLine.startsWith("classdiagram")) {
    return { type: "classDiagram", isVisual: true }
  }
  if (firstLine.startsWith("erdiagram")) {
    return { type: "erDiagram", isVisual: true }
  }
  if (firstLine.startsWith("sequencediagram")) {
    return { type: "sequence", isVisual: false }
  }
  if (firstLine.startsWith("gantt")) {
    return { type: "gantt", isVisual: false }
  }
  if (firstLine.startsWith("pie")) {
    return { type: "pie", isVisual: false }
  }
  if (firstLine.startsWith("gitgraph")) {
    return { type: "gitGraph", isVisual: false }
  }

  return { type: "other", isVisual: false }
}

export function isVisualDiagramType(type: DiagramType): type is VisualDiagramType {
  return VISUAL_TYPES.has(type as VisualDiagramType)
}
