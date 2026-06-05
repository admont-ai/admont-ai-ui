import { useCallback } from "react"
import {
  Plus,
  Trash2,
  Undo2,
  Redo2,
  LayoutGrid,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  DiagramModel,
  DiagramAction,
  DiagramNode,
  FlowchartNodeData,
  StateNodeData,
  ClassNodeData,
  ErEntityNodeData,
  VisualDiagramType,
} from "../types"

interface DiagramToolbarProps {
  model: DiagramModel
  dispatch: React.Dispatch<DiagramAction>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  onDeleteSelected: () => void
}

let nodeCounter = 0

function createDefaultNode(diagramType: VisualDiagramType): DiagramNode {
  const id = `node_${Date.now()}_${nodeCounter++}`

  switch (diagramType) {
    case "flowchart":
      return {
        id,
        type: "flowchartNode",
        position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: { label: "New Node", shape: "rect", diagramType: "flowchart" } satisfies FlowchartNodeData,
      }
    case "stateDiagram":
      return {
        id,
        type: "stateNode",
        position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: { label: id, variant: "default", diagramType: "stateDiagram" } satisfies StateNodeData,
      }
    case "classDiagram":
      return {
        id,
        type: "classNode",
        position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: {
          label: "NewClass",
          members: [],
          methods: [],
          diagramType: "classDiagram",
        } satisfies ClassNodeData,
      }
    case "erDiagram":
      return {
        id,
        type: "erEntityNode",
        position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: {
          label: "ENTITY",
          attributes: [],
          diagramType: "erDiagram",
        } satisfies ErEntityNodeData,
      }
  }
}

const DIRECTION_OPTIONS = [
  { value: "TD", icon: ArrowDown, label: "Top → Down" },
  { value: "BT", icon: ArrowUp, label: "Bottom → Top" },
  { value: "LR", icon: ArrowRight, label: "Left → Right" },
  { value: "RL", icon: ArrowLeft, label: "Right → Left" },
] as const

export function DiagramToolbar({
  model,
  dispatch,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  selectedNodeIds,
  selectedEdgeIds,
  onDeleteSelected,
}: DiagramToolbarProps) {
  const handleAddNode = useCallback(() => {
    const node = createDefaultNode(model.diagramType)
    dispatch({ type: "ADD_NODE", node })
  }, [model.diagramType, dispatch])

  const handleDirectionChange = useCallback(
    (dir: string) => {
      dispatch({ type: "SET_DIRECTION", direction: dir })
    },
    [dispatch],
  )

  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleAddNode}
        className="gap-1 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Node
      </Button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      {/* Direction buttons */}
      {model.diagramType !== "classDiagram" &&
        DIRECTION_OPTIONS.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            type="button"
            variant={model.direction === value ? "secondary" : "ghost"}
            size="icon-sm"
            title={label}
            onClick={() => handleDirectionChange(value)}
            className="h-7 w-7"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}

      <div className="mx-1 h-4 w-px bg-gray-300" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Auto Layout"
        onClick={onAutoLayout}
        className="h-7 w-7"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>

      <div className="mx-1 h-4 w-px bg-gray-300" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Undo"
        onClick={onUndo}
        disabled={!canUndo}
        className="h-7 w-7"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Redo"
        onClick={onRedo}
        disabled={!canRedo}
        className="h-7 w-7"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      {hasSelection && (
        <>
          <div className="mx-1 h-4 w-px bg-gray-300" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="gap-1 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </>
      )}
    </div>
  )
}
