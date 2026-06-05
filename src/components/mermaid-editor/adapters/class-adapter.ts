import type { DiagramAdapter } from "./types"
import type {
  DiagramModel,
  DiagramNode,
  DiagramEdge,
  ClassNodeData,
  ClassMember,
  ClassMethod,
} from "../types"
import { CLASS_RELATION_TYPES } from "../constants"

const MEMBER_RE = /^\s*([+\-#~])?\s*(\w+)\s*(?::\s*(\w+))?\s*$/
const METHOD_RE = /^\s*([+\-#~])?\s*(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*(?:\*?\s*)?$/
const RELATION_RE = /^\s*(\w+)\s+(<?\.?\.?>?|<?--?>?|<?\*--?\*?>?|<?o--?o?>?|<?\|?\.\.>?|<?\|--?\|?>?)\s+(\w+)\s*(?::\s*(.+))?$/
const ANNOTATION_RE = /^\s*<<(\w+)>>\s*$/

// Reverse map: mermaid syntax → relation key
const RELATION_SYNTAX_MAP: Record<string, string> = {}
for (const [key, syntax] of Object.entries(CLASS_RELATION_TYPES)) {
  RELATION_SYNTAX_MAP[syntax] = key
}

function parseClassBody(body: string): { members: ClassMember[]; methods: ClassMethod[]; annotation?: string } {
  const members: ClassMember[] = []
  const methods: ClassMethod[] = []
  let annotation: string | undefined

  for (const line of body.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const annMatch = trimmed.match(ANNOTATION_RE)
    if (annMatch) {
      annotation = annMatch[1]
      continue
    }

    const methodMatch = trimmed.match(METHOD_RE)
    if (methodMatch) {
      methods.push({
        name: methodMatch[2],
        visibility: (methodMatch[1] || "") as ClassMethod["visibility"],
        parameters: methodMatch[3] || undefined,
        returnType: methodMatch[4] || undefined,
      })
      continue
    }

    const memberMatch = trimmed.match(MEMBER_RE)
    if (memberMatch) {
      members.push({
        name: memberMatch[2],
        visibility: (memberMatch[1] || "") as ClassMember["visibility"],
        type: memberMatch[3] || undefined,
      })
    }
  }

  return { members, methods, annotation }
}

function detectRelationType(arrow: string): string {
  // Normalize and match
  const normalized = arrow.replace(/\s/g, "")
  if (RELATION_SYNTAX_MAP[normalized]) return normalized

  if (normalized.includes("<|") || normalized.includes("|>")) return "<|--"
  if (normalized.includes("*")) return "*--"
  if (normalized.includes("o")) return "o--"
  if (normalized.includes("..>")) return "..>"
  if (normalized.includes("..|>")) return "..|>"
  if (normalized.includes("..")) return ".."
  if (normalized.includes("-->")) return "-->"
  return "--"
}

export const classAdapter: DiagramAdapter = {
  type: "classDiagram",

  async parse(code: string): Promise<DiagramModel> {
    const nodeMap = new Map<string, { members: ClassMember[]; methods: ClassMethod[]; annotation?: string }>()
    const edges: DiagramEdge[] = []
    let edgeIdx = 0

    // Parse class blocks with their bodies
    const blockPattern = /class\s+(\w+)\s*\{([^}]*)\}/gs
    let blockMatch
    while ((blockMatch = blockPattern.exec(code)) !== null) {
      const className = blockMatch[1]
      const body = blockMatch[2]
      nodeMap.set(className, parseClassBody(body))
    }

    // Parse line by line for relations and standalone class definitions
    for (const line of code.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("%%") || trimmed.startsWith("classDiagram")) continue

      // Relation
      const relMatch = trimmed.match(RELATION_RE)
      if (relMatch) {
        const [, source, arrow, target, label] = relMatch
        if (!nodeMap.has(source)) nodeMap.set(source, { members: [], methods: [] })
        if (!nodeMap.has(target)) nodeMap.set(target, { members: [], methods: [] })

        const relType = detectRelationType(arrow)
        edges.push({
          id: `e${edgeIdx++}`,
          source,
          target,
          label: label?.trim() || undefined,
          data: {
            label: label?.trim() || undefined,
            strokeStyle: relType.includes("..") ? "dotted" : "solid",
          },
        })
      }
    }

    const nodes: DiagramNode[] = Array.from(nodeMap.entries()).map(
      ([id, { members, methods, annotation }]) => ({
        id,
        type: "classNode",
        position: { x: 0, y: 0 },
        data: {
          label: id,
          members,
          methods,
          annotation,
          diagramType: "classDiagram" as const,
        },
      }),
    )

    return { diagramType: "classDiagram", direction: "TB", nodes, edges }
  },

  generate(model: DiagramModel): string {
    const lines: string[] = ["classDiagram"]

    for (const node of model.nodes) {
      const data = node.data as ClassNodeData
      if (data.diagramType !== "classDiagram") continue

      lines.push(`    class ${node.id} {`)
      if (data.annotation) {
        lines.push(`        <<${data.annotation}>>`)
      }
      for (const m of data.members) {
        const vis = m.visibility || ""
        const type = m.type ? ` : ${m.type}` : ""
        lines.push(`        ${vis}${m.name}${type}`)
      }
      for (const m of data.methods) {
        const vis = m.visibility || ""
        const params = m.parameters ?? ""
        const ret = m.returnType ? ` : ${m.returnType}` : ""
        lines.push(`        ${vis}${m.name}(${params})${ret}`)
      }
      lines.push("    }")
    }

    for (const edge of model.edges) {
      const style = edge.data?.strokeStyle === "dotted" ? ".." : "--"
      const label = edge.data?.label
      if (label) {
        lines.push(`    ${edge.source} ${style} ${edge.target} : ${label}`)
      } else {
        lines.push(`    ${edge.source} ${style} ${edge.target}`)
      }
    }

    return lines.join("\n")
  },

  defaultModel(): DiagramModel {
    return {
      diagramType: "classDiagram",
      direction: "TB",
      nodes: [
        {
          id: "Animal",
          type: "classNode",
          position: { x: 0, y: 0 },
          data: {
            label: "Animal",
            members: [
              { name: "name", visibility: "+", type: "string" },
              { name: "age", visibility: "+", type: "int" },
            ],
            methods: [
              { name: "speak", visibility: "+", returnType: "void" },
            ],
            diagramType: "classDiagram",
          },
        },
        {
          id: "Dog",
          type: "classNode",
          position: { x: 0, y: 200 },
          data: {
            label: "Dog",
            members: [
              { name: "breed", visibility: "+", type: "string" },
            ],
            methods: [
              { name: "fetch", visibility: "+", returnType: "void" },
            ],
            diagramType: "classDiagram",
          },
        },
      ],
      edges: [
        {
          id: "e0",
          source: "Dog",
          target: "Animal",
          label: "extends",
          data: { label: "extends", strokeStyle: "solid" },
        },
      ],
    }
  },
}
