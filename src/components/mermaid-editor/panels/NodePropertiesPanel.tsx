import { useCallback } from "react"
import type {
  DiagramAction,
  DiagramNode,
  FlowchartNodeData,
  FlowchartShape,
  StateNodeData,
  ClassNodeData,
  ErEntityNodeData,
} from "../types"
import { SHAPE_LABELS } from "../constants"

interface NodePropertiesPanelProps {
  node: DiagramNode
  dispatch: React.Dispatch<DiagramAction>
}

function FlowchartProperties({
  node,
  dispatch,
}: {
  node: DiagramNode
  dispatch: React.Dispatch<DiagramAction>
}) {
  const data = node.data as unknown as FlowchartNodeData

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, label: e.target.value },
      })
    },
    [node.id, data, dispatch],
  )

  const handleShapeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, shape: e.target.value as FlowchartShape },
      })
    },
    [node.id, data, dispatch],
  )

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Label</label>
        <input
          type="text"
          value={data.label}
          onChange={handleLabelChange}
          className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Shape</label>
        <select
          value={data.shape}
          onChange={handleShapeChange}
          className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
        >
          {Object.entries(SHAPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

function StateProperties({
  node,
  dispatch,
}: {
  node: DiagramNode
  dispatch: React.Dispatch<DiagramAction>
}) {
  const data = node.data as unknown as StateNodeData

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, label: e.target.value },
      })
    },
    [node.id, data, dispatch],
  )

  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, description: e.target.value },
      })
    },
    [node.id, data, dispatch],
  )

  if (data.variant === "start" || data.variant === "end") {
    return <p className="text-xs text-gray-400 italic">No editable properties</p>
  }

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">State Name</label>
        <input
          type="text"
          value={data.label}
          onChange={handleLabelChange}
          className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Description</label>
        <input
          type="text"
          value={data.description ?? ""}
          onChange={handleDescChange}
          className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
        />
      </div>
    </>
  )
}

function ClassProperties({
  node,
  dispatch,
}: {
  node: DiagramNode
  dispatch: React.Dispatch<DiagramAction>
}) {
  const data = node.data as unknown as ClassNodeData

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, label: e.target.value },
      })
    },
    [node.id, data, dispatch],
  )

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">Class Name</label>
      <input
        type="text"
        value={data.label}
        onChange={handleLabelChange}
        className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
      />
      <p className="text-[10px] text-gray-400 mt-1">
        {data.members.length} fields, {data.methods.length} methods
      </p>
    </div>
  )
}

function ErProperties({
  node,
  dispatch,
}: {
  node: DiagramNode
  dispatch: React.Dispatch<DiagramAction>
}) {
  const data = node.data as unknown as ErEntityNodeData

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "UPDATE_NODE",
        id: node.id,
        data: { ...data, label: e.target.value },
      })
    },
    [node.id, data, dispatch],
  )

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">Entity Name</label>
      <input
        type="text"
        value={data.label}
        onChange={handleLabelChange}
        className="flex h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none"
      />
      <p className="text-[10px] text-gray-400 mt-1">
        {data.attributes.length} attributes
      </p>
    </div>
  )
}

export function NodePropertiesPanel({ node, dispatch }: NodePropertiesPanelProps) {
  const diagramType = (node.data as Record<string, unknown>).diagramType as string

  return (
    <div className="absolute bottom-2 left-2 z-10 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <h4 className="mb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
        Properties
      </h4>
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">ID</label>
          <p className="text-xs font-mono text-gray-600">{node.id}</p>
        </div>
        {diagramType === "flowchart" && (
          <FlowchartProperties node={node} dispatch={dispatch} />
        )}
        {diagramType === "stateDiagram" && (
          <StateProperties node={node} dispatch={dispatch} />
        )}
        {diagramType === "classDiagram" && (
          <ClassProperties node={node} dispatch={dispatch} />
        )}
        {diagramType === "erDiagram" && (
          <ErProperties node={node} dispatch={dispatch} />
        )}
      </div>
    </div>
  )
}
