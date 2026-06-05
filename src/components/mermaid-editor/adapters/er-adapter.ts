import type { DiagramAdapter } from "./types"
import type {
  DiagramModel,
  DiagramNode,
  DiagramEdge,
  ErEntityNodeData,
  ErAttribute,
} from "../types"

// erDiagram
//   CUSTOMER ||--o{ ORDER : places
//   CUSTOMER { string name; string email }
const RELATION_RE = /^\s*(\w+)\s+(\|{1,2}|[o}]{1,2})--(\|{1,2}|[o{]{1,2})\s+(\w+)\s*:\s*(.+)$/
const ENTITY_BLOCK_RE = /(\w+)\s*\{([^}]*)\}/gs
const ATTR_RE = /^\s*(\w+)\s+(\w+)\s*(PK|FK|UK)?\s*(?:"([^"]*)")?\s*$/

function parseAttributes(body: string): ErAttribute[] {
  const attrs: ErAttribute[] = []
  for (const line of body.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(ATTR_RE)
    if (match) {
      attrs.push({
        type: match[1],
        name: match[2],
        keys: match[3] ? [match[3]] : [],
      })
    }
  }
  return attrs
}

export const erAdapter: DiagramAdapter = {
  type: "erDiagram",

  async parse(code: string): Promise<DiagramModel> {
    const nodeMap = new Map<string, ErAttribute[]>()
    const edges: DiagramEdge[] = []
    let edgeIdx = 0

    // Parse entity blocks
    let blockMatch
    const blockPattern = new RegExp(ENTITY_BLOCK_RE.source, "gs")
    while ((blockMatch = blockPattern.exec(code)) !== null) {
      const entityName = blockMatch[1]
      const body = blockMatch[2]
      nodeMap.set(entityName, parseAttributes(body))
    }

    // Parse relationships line by line
    for (const line of code.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("%%") || trimmed === "erDiagram") continue

      const relMatch = trimmed.match(RELATION_RE)
      if (relMatch) {
        const [, source, , , target, label] = relMatch
        if (!nodeMap.has(source)) nodeMap.set(source, [])
        if (!nodeMap.has(target)) nodeMap.set(target, [])

        edges.push({
          id: `e${edgeIdx++}`,
          source,
          target,
          label: label.trim(),
          data: {
            label: label.trim(),
            strokeStyle: "solid",
          },
        })
      }
    }

    const nodes: DiagramNode[] = Array.from(nodeMap.entries()).map(
      ([id, attributes]) => ({
        id,
        type: "erEntityNode",
        position: { x: 0, y: 0 },
        data: {
          label: id,
          attributes,
          diagramType: "erDiagram" as const,
        },
      }),
    )

    return { diagramType: "erDiagram", direction: "LR", nodes, edges }
  },

  generate(model: DiagramModel): string {
    const lines: string[] = ["erDiagram"]

    // Entity definitions
    for (const node of model.nodes) {
      const data = node.data as ErEntityNodeData
      if (data.diagramType !== "erDiagram") continue

      if (data.attributes.length > 0) {
        lines.push(`    ${node.id} {`)
        for (const attr of data.attributes) {
          const keys = attr.keys.length > 0 ? ` ${attr.keys.join(",")}` : ""
          lines.push(`        ${attr.type} ${attr.name}${keys}`)
        }
        lines.push("    }")
      }
    }

    // Relationships
    for (const edge of model.edges) {
      const label = edge.data?.label || "relates"
      lines.push(`    ${edge.source} ||--o{ ${edge.target} : ${label}`)
    }

    return lines.join("\n")
  },

  defaultModel(): DiagramModel {
    return {
      diagramType: "erDiagram",
      direction: "LR",
      nodes: [
        {
          id: "CUSTOMER",
          type: "erEntityNode",
          position: { x: 0, y: 0 },
          data: {
            label: "CUSTOMER",
            attributes: [
              { type: "string", name: "name", keys: ["PK"] },
              { type: "string", name: "email", keys: [] },
            ],
            diagramType: "erDiagram",
          },
        },
        {
          id: "ORDER",
          type: "erEntityNode",
          position: { x: 300, y: 0 },
          data: {
            label: "ORDER",
            attributes: [
              { type: "int", name: "id", keys: ["PK"] },
              { type: "date", name: "created", keys: [] },
            ],
            diagramType: "erDiagram",
          },
        },
      ],
      edges: [
        {
          id: "e0",
          source: "CUSTOMER",
          target: "ORDER",
          label: "places",
          data: { label: "places", strokeStyle: "solid" },
        },
      ],
    }
  },
}
