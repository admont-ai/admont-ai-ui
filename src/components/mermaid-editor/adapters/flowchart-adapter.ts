import type { DiagramAdapter } from "./types"
import type {
  DiagramModel,
  DiagramNode,
  DiagramEdge,
  FlowchartNodeData,
  FlowchartShape,
} from "../types"
import { SHAPE_SYNTAX, EDGE_STYLES } from "../constants"

// ── Regex-based parser for flowchart syntax ──
// Parses: graph/flowchart <direction>\n  nodeId[label] --> nodeId2{label2}

const DIRECTION_RE = /^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)/i
const EDGE_RE = /([A-Za-z_][\w]*)\s*(-->|-.->|==>|---|-\.-|===)\s*(?:\|([^|]*)\|)?\s*([A-Za-z_][\w]*)/

function detectShape(text: string): { label: string; shape: FlowchartShape } {
  // Try each shape syntax (longest first to avoid partial matches)
  const pairs: [FlowchartShape, string, string][] = [
    ["double-circle", "(((", ")))"],
    ["hexagon", "{{", "}}"],
    ["subroutine", "[[", "]]"],
    ["stadium", "([", "])"],
    ["cylinder", "[(", ")]"],
    ["trapezoid", "[/", "\\]"],
    ["trapezoid-alt", "[\\", "/]"],
    ["parallelogram", "[/", "/]"],
    ["parallelogram-alt", "[\\", "\\]"],
    ["circle", "((", "))"],
    ["diamond", "{", "}"],
    ["rounded", "(", ")"],
    ["asymmetric", ">", "]"],
    ["rect", "[", "]"],
  ]

  for (const [shape, open, close] of pairs) {
    if (text.startsWith(open) && text.endsWith(close)) {
      const label = text.slice(open.length, text.length - close.length).trim()
      return { label, shape }
    }
  }

  return { label: text, shape: "rect" }
}

function edgeStyle(arrow: string): "solid" | "dotted" | "thick" {
  if (arrow.includes("-.")) return "dotted"
  if (arrow.includes("==")) return "thick"
  return "solid"
}

export const flowchartAdapter: DiagramAdapter = {
  type: "flowchart",

  async parse(code: string): Promise<DiagramModel> {
    const lines = code.split("\n")
    const direction = lines[0]?.match(DIRECTION_RE)?.[1]?.toUpperCase() ?? "TD"

    const nodeMap = new Map<string, { label: string; shape: FlowchartShape }>()
    const edges: DiagramEdge[] = []
    let edgeIdx = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("%%") || DIRECTION_RE.test(trimmed)) continue

      // Try edge first
      const edgeMatch = trimmed.match(EDGE_RE)
      if (edgeMatch) {
        const [, sourceId, arrow, edgeLabel, targetId] = edgeMatch

        // Register nodes if not yet seen
        if (!nodeMap.has(sourceId)) {
          nodeMap.set(sourceId, { label: sourceId, shape: "rect" })
        }
        if (!nodeMap.has(targetId)) {
          nodeMap.set(targetId, { label: targetId, shape: "rect" })
        }

        // Check if nodes have inline definitions in this line
        // e.g. A[Start] --> B{Decision}
        const beforeArrow = trimmed.substring(0, trimmed.indexOf(arrow))
        const afterArrow = trimmed.substring(trimmed.indexOf(targetId))

        const srcNodeMatch = beforeArrow.match(/([A-Za-z_][\w]*)(\[{1,3}[^[\]]*\]{1,3}|\({1,3}[^()]*\){1,3}|\{{1,3}[^{}]*\}{1,3}|>\s*[^\]]*\])/)
        if (srcNodeMatch) {
          const det = detectShape(srcNodeMatch[2])
          nodeMap.set(srcNodeMatch[1], det)
        }

        const tgtNodeMatch = afterArrow.match(/([A-Za-z_][\w]*)(\[{1,3}[^[\]]*\]{1,3}|\({1,3}[^()]*\){1,3}|\{{1,3}[^{}]*\}{1,3}|>\s*[^\]]*\])/)
        if (tgtNodeMatch) {
          const det = detectShape(tgtNodeMatch[2])
          nodeMap.set(tgtNodeMatch[1], det)
        }

        edges.push({
          id: `e${edgeIdx++}`,
          source: sourceId,
          target: targetId,
          label: edgeLabel?.trim() || undefined,
          data: {
            label: edgeLabel?.trim() || undefined,
            strokeStyle: edgeStyle(arrow),
          },
        })
        continue
      }

      // Standalone node definition
      const nodeMatch = trimmed.match(/^([A-Za-z_][\w]*)(\[{1,3}[^[\]]*\]{1,3}|\({1,3}[^()]*\){1,3}|\{{1,3}[^{}]*\}{1,3}|>\s*[^\]]*\])/)
      if (nodeMatch) {
        const det = detectShape(nodeMatch[2])
        nodeMap.set(nodeMatch[1], det)
      }
    }

    const nodes: DiagramNode[] = Array.from(nodeMap.entries()).map(
      ([id, { label, shape }]) => ({
        id,
        type: "flowchartNode",
        position: { x: 0, y: 0 }, // positioned by auto-layout
        data: {
          label,
          shape,
          diagramType: "flowchart" as const,
        },
      }),
    )

    return { diagramType: "flowchart", direction, nodes, edges }
  },

  generate(model: DiagramModel): string {
    const lines: string[] = [`graph ${model.direction || "TD"}`]

    // Node definitions
    for (const node of model.nodes) {
      const data = node.data as FlowchartNodeData
      if (!data || data.diagramType !== "flowchart") continue
      const [open, close] = SHAPE_SYNTAX[data.shape] ?? SHAPE_SYNTAX.rect
      lines.push(`    ${node.id}${open}${data.label}${close}`)
    }

    // Edge definitions
    for (const edge of model.edges) {
      const style = edge.data?.strokeStyle ?? "solid"
      const arrow = EDGE_STYLES[style]
      const label = edge.data?.label
      if (label) {
        lines.push(`    ${edge.source} ${arrow}|${label}| ${edge.target}`)
      } else {
        lines.push(`    ${edge.source} ${arrow} ${edge.target}`)
      }
    }

    return lines.join("\n")
  },

  defaultModel(): DiagramModel {
    return {
      diagramType: "flowchart",
      direction: "TD",
      nodes: [
        {
          id: "A",
          type: "flowchartNode",
          position: { x: 0, y: 0 },
          data: { label: "Start", shape: "rounded", diagramType: "flowchart" },
        },
        {
          id: "B",
          type: "flowchartNode",
          position: { x: 0, y: 100 },
          data: { label: "Process", shape: "rect", diagramType: "flowchart" },
        },
        {
          id: "C",
          type: "flowchartNode",
          position: { x: 0, y: 200 },
          data: { label: "End", shape: "rounded", diagramType: "flowchart" },
        },
      ],
      edges: [
        {
          id: "e0",
          source: "A",
          target: "B",
          data: { strokeStyle: "solid" },
        },
        {
          id: "e1",
          source: "B",
          target: "C",
          data: { strokeStyle: "solid" },
        },
      ],
    }
  },
}
