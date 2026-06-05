import type { DiagramAdapter } from "./types"
import type {
  DiagramModel,
  DiagramNode,
  DiagramEdge,
  StateNodeData,
  StateVariant,
} from "../types"

const DIRECTION_RE = /direction\s+(TB|BT|LR|RL)/i
const TRANSITION_RE = /^\s*(\S+)\s*-->\s*(\S+)\s*(?::\s*(.+))?$/
const STATE_DESC_RE = /^\s*(\S+)\s*:\s*(.+)$/
export const stateAdapter: DiagramAdapter = {
  type: "stateDiagram",

  async parse(code: string): Promise<DiagramModel> {
    const lines = code.split("\n")
    const dirMatch = code.match(DIRECTION_RE)
    const direction = dirMatch?.[1]?.toUpperCase() ?? "TB"

    const nodeMap = new Map<string, { label: string; variant: StateVariant; description?: string }>()
    const edges: DiagramEdge[] = []
    let edgeIdx = 0
    let startCount = 0
    let endCount = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("%%") || trimmed.startsWith("stateDiagram") || DIRECTION_RE.test(trimmed)) continue

      // Transition
      const transMatch = trimmed.match(TRANSITION_RE)
      if (transMatch) {
        const [, rawSource, rawTarget, label] = transMatch

        // Handle [*] → start/end pseudo-states
        let sourceId = rawSource
        let targetId = rawTarget

        if (rawSource === "[*]") {
          sourceId = `__start_${startCount++}`
          nodeMap.set(sourceId, { label: "", variant: "start" })
        } else if (!nodeMap.has(rawSource)) {
          nodeMap.set(rawSource, { label: rawSource, variant: "default" })
        }

        if (rawTarget === "[*]") {
          targetId = `__end_${endCount++}`
          nodeMap.set(targetId, { label: "", variant: "end" })
        } else if (!nodeMap.has(rawTarget)) {
          nodeMap.set(rawTarget, { label: rawTarget, variant: "default" })
        }

        edges.push({
          id: `e${edgeIdx++}`,
          source: sourceId,
          target: targetId,
          label: label?.trim() || undefined,
          data: { label: label?.trim() || undefined, strokeStyle: "solid" },
        })
        continue
      }

      // State description
      const descMatch = trimmed.match(STATE_DESC_RE)
      if (descMatch) {
        const [, id, desc] = descMatch
        const existing = nodeMap.get(id)
        if (existing) {
          existing.description = desc.trim()
        } else {
          nodeMap.set(id, { label: id, variant: "default", description: desc.trim() })
        }
      }
    }

    const nodes: DiagramNode[] = Array.from(nodeMap.entries()).map(
      ([id, { label, variant, description }]) => ({
        id,
        type: "stateNode",
        position: { x: 0, y: 0 },
        data: {
          label,
          variant,
          description,
          diagramType: "stateDiagram" as const,
        },
      }),
    )

    return { diagramType: "stateDiagram", direction, nodes, edges }
  },

  generate(model: DiagramModel): string {
    const lines: string[] = ["stateDiagram-v2"]
    if (model.direction && model.direction !== "TB") {
      lines.push(`    direction ${model.direction}`)
    }

    // State descriptions
    for (const node of model.nodes) {
      const data = node.data as StateNodeData
      if (data.variant === "start" || data.variant === "end") continue
      if (data.description) {
        lines.push(`    ${node.id} : ${data.description}`)
      }
    }

    // Transitions
    for (const edge of model.edges) {
      const sourceNode = model.nodes.find((n) => n.id === edge.source)
      const targetNode = model.nodes.find((n) => n.id === edge.target)
      const srcData = sourceNode?.data as StateNodeData | undefined
      const tgtData = targetNode?.data as StateNodeData | undefined

      const src = srcData?.variant === "start" || srcData?.variant === "end" ? "[*]" : edge.source
      const tgt = tgtData?.variant === "start" || tgtData?.variant === "end" ? "[*]" : edge.target

      const label = edge.data?.label
      if (label) {
        lines.push(`    ${src} --> ${tgt} : ${label}`)
      } else {
        lines.push(`    ${src} --> ${tgt}`)
      }
    }

    return lines.join("\n")
  },

  defaultModel(): DiagramModel {
    return {
      diagramType: "stateDiagram",
      direction: "TB",
      nodes: [
        {
          id: "__start_0",
          type: "stateNode",
          position: { x: 0, y: 0 },
          data: { label: "", variant: "start", diagramType: "stateDiagram" },
        },
        {
          id: "Idle",
          type: "stateNode",
          position: { x: 0, y: 100 },
          data: { label: "Idle", variant: "default", diagramType: "stateDiagram" },
        },
        {
          id: "Active",
          type: "stateNode",
          position: { x: 0, y: 200 },
          data: { label: "Active", variant: "default", diagramType: "stateDiagram" },
        },
        {
          id: "__end_0",
          type: "stateNode",
          position: { x: 0, y: 300 },
          data: { label: "", variant: "end", diagramType: "stateDiagram" },
        },
      ],
      edges: [
        { id: "e0", source: "__start_0", target: "Idle", data: { strokeStyle: "solid" } },
        { id: "e1", source: "Idle", target: "Active", data: { label: "activate", strokeStyle: "solid" } },
        { id: "e2", source: "Active", target: "__end_0", data: { label: "done", strokeStyle: "solid" } },
      ],
    }
  },
}
