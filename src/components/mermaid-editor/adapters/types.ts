import type { DiagramModel, VisualDiagramType } from "../types"

export interface DiagramAdapter {
  type: VisualDiagramType
  /** Parse mermaid code into a diagram model (nodes + edges) */
  parse(code: string): Promise<DiagramModel>
  /** Generate mermaid code from a diagram model */
  generate(model: DiagramModel): string
  /** Return default model for a new empty diagram of this type */
  defaultModel(): DiagramModel
}
