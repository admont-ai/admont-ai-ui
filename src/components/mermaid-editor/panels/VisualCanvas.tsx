import { useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesInitialized,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type { DiagramModel, DiagramAction, DiagramNode, DiagramEdge } from "../types"
import { NodePropertiesPanel } from "./NodePropertiesPanel"
import FlowchartNode from "../nodes/FlowchartNode"
import StateNode from "../nodes/StateNode"
import ClassNode from "../nodes/ClassNode"
import ErEntityNode from "../nodes/ErEntityNode"
import LabeledEdge from "../edges/LabeledEdge"

const nodeTypes: NodeTypes = {
  flowchartNode: FlowchartNode,
  stateNode: StateNode,
  classNode: ClassNode,
  erEntityNode: ErEntityNode,
}

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
}

const defaultEdgeOptions = {
  type: "labeled",
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
}

// Re-fits the viewport whenever the set of nodes changes (the diagram loads
// after the async parse, or a node is added/removed). The `fitView` prop only
// fits once on mount — against the default placeholder model — which leaves the
// real centered layout offset to the left. Rendered inside <ReactFlow> so it
// can read the store; gated on useNodesInitialized so fitting happens only
// after the new nodes have measured dimensions (otherwise fitView no-ops).
function FitViewOnChange({ nodeKey }: { nodeKey: string }) {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  useEffect(() => {
    if (nodesInitialized && nodeKey) {
      void fitView({ padding: 0.2 })
    }
  }, [nodesInitialized, nodeKey, fitView])
  return null
}

interface VisualCanvasProps {
  model: DiagramModel
  dispatch: React.Dispatch<DiagramAction>
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  onSelectionChange: (nodeIds: string[], edgeIds: string[]) => void
}

export function VisualCanvas({
  model,
  dispatch,
  selectedNodeIds,
  selectedEdgeIds: _selectedEdgeIds,
  onSelectionChange,
}: VisualCanvasProps) {
  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length === 1
        ? model.nodes.find((n) => n.id === selectedNodeIds[0])
        : undefined,
    [selectedNodeIds, model.nodes],
  )

  // Identity of the current node set; changes when a diagram loads or a node is
  // added/removed (but not when a node is merely dragged), driving a re-fit.
  const nodeKey = useMemo(
    () => model.nodes.map((n) => n.id).join(","),
    [model.nodes],
  )

  // Add default edge type to all edges
  const edgesWithType = useMemo(
    () =>
      model.edges.map((e) => ({
        ...e,
        type: e.type || "labeled",
        markerEnd: e.markerEnd || defaultEdgeOptions.markerEnd,
      })),
    [model.edges],
  )

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updated = applyNodeChanges(changes, model.nodes) as DiagramNode[]
      dispatch({ type: "SET_NODES", nodes: updated })
    },
    [model.nodes, dispatch],
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const updated = applyEdgeChanges(changes, model.edges) as DiagramEdge[]
      dispatch({ type: "SET_EDGES", edges: updated })
    },
    [model.edges, dispatch],
  )

  const onConnect: OnConnect = useCallback(
    (params) => {
      const edge: DiagramEdge = {
        id: `e_${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        type: "labeled",
        markerEnd: defaultEdgeOptions.markerEnd,
        data: { strokeStyle: "solid" },
      }
      dispatch({ type: "ADD_EDGE", edge })
    },
    [dispatch],
  )

  const onSelectionChangeHandler = useCallback(
    ({ nodes, edges }: { nodes: DiagramNode[]; edges: DiagramEdge[] }) => {
      onSelectionChange(
        nodes.map((n) => n.id),
        edges.map((e) => e.id),
      )
    },
    [onSelectionChange],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={model.nodes}
        edges={edgesWithType}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChangeHandler}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        className="bg-gray-50"
      >
        <FitViewOnChange nodeKey={nodeKey} />
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bottom-2 !right-2"
        />
      </ReactFlow>

      {selectedNode && (
        <NodePropertiesPanel node={selectedNode} dispatch={dispatch} />
      )}
    </div>
  )
}
