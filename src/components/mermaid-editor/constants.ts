import type { FlowchartShape } from "./types"

// ── Flowchart shape syntax mapping ──
// Maps shape enum → mermaid open/close bracket syntax
export const SHAPE_SYNTAX: Record<FlowchartShape, [string, string]> = {
  rect: ["[", "]"],
  rounded: ["(", ")"],
  stadium: ["([", "])"],
  subroutine: ["[[", "]]"],
  cylinder: ["[(", ")]"],
  circle: ["((", "))"],
  asymmetric: [">", "]"],
  diamond: ["{", "}"],
  hexagon: ["{{", "}}"],
  parallelogram: ["[/", "/]"],
  "parallelogram-alt": ["[\\", "\\]"],
  trapezoid: ["[/", "\\]"],
  "trapezoid-alt": ["[\\", "/]"],
  "double-circle": ["(((", ")))"],
}

// Reverse lookup: given open bracket, get shape
export function shapeFromSyntax(open: string, close: string): FlowchartShape {
  for (const [shape, [o, c]] of Object.entries(SHAPE_SYNTAX)) {
    if (o === open && c === close) return shape as FlowchartShape
  }
  return "rect"
}

// ── Flowchart directions ──
export const FLOWCHART_DIRECTIONS = ["TD", "TB", "BT", "LR", "RL"] as const

// ── Edge arrow styles → mermaid syntax ──
export const EDGE_STYLES = {
  solid: "-->",
  dotted: "-.->",
  thick: "==>",
} as const

export const EDGE_STYLE_FROM_SYNTAX: Record<string, "solid" | "dotted" | "thick"> = {
  "-->": "solid",
  "---": "solid",
  "-.->": "dotted",
  "-.-": "dotted",
  "==>": "thick",
  "===": "thick",
}

// ── Default node dimensions ──
export const DEFAULT_NODE_WIDTH = 180
export const DEFAULT_NODE_HEIGHT = 60

// ── Shape display names ──
export const SHAPE_LABELS: Record<FlowchartShape, string> = {
  rect: "Rectangle",
  rounded: "Rounded",
  stadium: "Stadium",
  subroutine: "Subroutine",
  cylinder: "Cylinder",
  circle: "Circle",
  asymmetric: "Asymmetric",
  diamond: "Diamond",
  hexagon: "Hexagon",
  parallelogram: "Parallelogram",
  "parallelogram-alt": "Parallelogram Alt",
  trapezoid: "Trapezoid",
  "trapezoid-alt": "Trapezoid Alt",
  "double-circle": "Double Circle",
}

// ── ER relationship cardinality symbols ──
export const ER_CARDINALITY = {
  "||": "exactly one",
  "|o": "zero or one",
  "}|": "one or more",
  "}o": "zero or more",
  "o|": "zero or one",
  "o{": "zero or more",
  "|{": "one or more",
} as const

// ── Class diagram relationship types ──
export const CLASS_RELATION_TYPES: Record<string, string> = {
  extension: "<|--",
  composition: "*--",
  aggregation: "o--",
  association: "-->",
  dependency: "..>",
  realization: "..|>",
  link_solid: "--",
  link_dashed: "..",
}
