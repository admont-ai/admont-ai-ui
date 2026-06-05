import type { Node, Edge } from "@xyflow/react"

// ── Diagram types supported by the visual editor ──
export type VisualDiagramType = "flowchart" | "stateDiagram" | "classDiagram" | "erDiagram"
export type DiagramType = VisualDiagramType | "sequence" | "gantt" | "pie" | "gitGraph" | "other"

// ── Flowchart ──
export type FlowchartShape =
  | "rect"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "asymmetric"
  | "diamond"
  | "hexagon"
  | "parallelogram"
  | "parallelogram-alt"
  | "trapezoid"
  | "trapezoid-alt"
  | "double-circle"

export interface FlowchartNodeData {
  label: string
  shape: FlowchartShape
  diagramType: "flowchart"
  [key: string]: unknown
}

export interface SubgraphNodeData {
  label: string
  diagramType: "flowchart"
  isSubgraph: true
  [key: string]: unknown
}

// ── State Diagram ──
export type StateVariant = "default" | "start" | "end" | "fork" | "join" | "choice" | "note"

export interface StateNodeData {
  label: string
  variant: StateVariant
  description?: string
  diagramType: "stateDiagram"
  [key: string]: unknown
}

// ── Class Diagram ──
export interface ClassMember {
  name: string
  visibility: "+" | "-" | "#" | "~" | ""
  type?: string
}

export interface ClassMethod {
  name: string
  visibility: "+" | "-" | "#" | "~" | ""
  returnType?: string
  parameters?: string
}

export interface ClassNodeData {
  label: string
  members: ClassMember[]
  methods: ClassMethod[]
  annotation?: string
  diagramType: "classDiagram"
  [key: string]: unknown
}

// ── ER Diagram ──
export interface ErAttribute {
  name: string
  type: string
  keys: string[] // PK, FK, UK
}

export interface ErEntityNodeData {
  label: string
  attributes: ErAttribute[]
  diagramType: "erDiagram"
  [key: string]: unknown
}

// ── Unified node data ──
export type DiagramNodeData =
  | FlowchartNodeData
  | SubgraphNodeData
  | StateNodeData
  | ClassNodeData
  | ErEntityNodeData

export type DiagramNode = Node<DiagramNodeData>
export type DiagramEdge = Edge<{
  label?: string
  strokeStyle?: "solid" | "dotted" | "thick"
  [key: string]: unknown
}>

// ── Model ──
export interface DiagramModel {
  diagramType: VisualDiagramType
  direction: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

// ── Action types for reducer ──
export type DiagramAction =
  | { type: "SET_MODEL"; model: DiagramModel }
  | { type: "ADD_NODE"; node: DiagramNode }
  | { type: "REMOVE_NODES"; ids: string[] }
  | { type: "UPDATE_NODE"; id: string; data: Partial<DiagramNodeData> }
  | { type: "MOVE_NODE"; id: string; position: { x: number; y: number } }
  | { type: "ADD_EDGE"; edge: DiagramEdge }
  | { type: "REMOVE_EDGES"; ids: string[] }
  | { type: "UPDATE_EDGE"; id: string; data: Partial<DiagramEdge["data"]> }
  | { type: "SET_DIRECTION"; direction: string }
  | { type: "SET_NODES"; nodes: DiagramNode[] }
  | { type: "SET_EDGES"; edges: DiagramEdge[] }
  | { type: "UNDO" }
  | { type: "REDO" }
