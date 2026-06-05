import type { DiagramAdapter } from "./types"
import type { VisualDiagramType } from "../types"
import { flowchartAdapter } from "./flowchart-adapter"
import { stateAdapter } from "./state-adapter"
import { classAdapter } from "./class-adapter"
import { erAdapter } from "./er-adapter"

const adapters: Record<VisualDiagramType, DiagramAdapter> = {
  flowchart: flowchartAdapter,
  stateDiagram: stateAdapter,
  classDiagram: classAdapter,
  erDiagram: erAdapter,
}

export function getAdapter(type: VisualDiagramType): DiagramAdapter {
  return adapters[type]
}
