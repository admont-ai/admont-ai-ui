import { useCallback, useEffect, useState, useRef } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import type { VisualDiagramType } from "./types"
import { getAdapter } from "./adapters/registry"
import { useDiagramState } from "./hooks/use-diagram-state"
import { useAutoLayout } from "./hooks/use-auto-layout"
import { useMermaidSync } from "./hooks/use-mermaid-sync"
import { DiagramToolbar } from "./panels/DiagramToolbar"
import { VisualCanvas } from "./panels/VisualCanvas"
import { CodePreviewPanel } from "./panels/CodePreviewPanel"

interface MermaidVisualEditorProps {
  initialCode: string
  diagramType: VisualDiagramType
  onCodeChange: (code: string) => void
}

export function MermaidVisualEditor({
  initialCode,
  diagramType,
  onCodeChange,
}: MermaidVisualEditorProps) {
  const adapter = getAdapter(diagramType)
  const { layoutNodes } = useAutoLayout()
  const [initialized, setInitialized] = useState(false)

  const defaultModel = adapter.defaultModel()
  const { model, canUndo, canRedo, dispatch, undo, redo } =
    useDiagramState(defaultModel)

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])

  const { code, previewHtml, previewError } = useMermaidSync(model)

  // Parse initial code on mount
  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    async function init() {
      try {
        const parsed = await adapter.parse(initialCode)
        const layouted = layoutNodes(parsed.nodes, parsed.edges, {
          direction: parsed.direction,
        })
        dispatch({
          type: "SET_MODEL",
          model: { ...parsed, nodes: layouted },
        })
      } catch {
        // Fall back to default model
        const laid = layoutNodes(defaultModel.nodes, defaultModel.edges, {
          direction: defaultModel.direction,
        })
        dispatch({
          type: "SET_MODEL",
          model: { ...defaultModel, nodes: laid },
        })
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync generated code to parent
  const prevCodeRef = useRef(code)
  useEffect(() => {
    if (code && code !== prevCodeRef.current) {
      prevCodeRef.current = code
      onCodeChange(code)
    }
  }, [code, onCodeChange])

  const handleAutoLayout = useCallback(() => {
    const layouted = layoutNodes(model.nodes, model.edges, {
      direction: model.direction,
    })
    dispatch({ type: "SET_NODES", nodes: layouted })
  }, [model, layoutNodes, dispatch])

  const handleSelectionChange = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      setSelectedNodeIds(nodeIds)
      setSelectedEdgeIds(edgeIds)
    },
    [],
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      dispatch({ type: "REMOVE_NODES", ids: selectedNodeIds })
    }
    if (selectedEdgeIds.length > 0) {
      dispatch({ type: "REMOVE_EDGES", ids: selectedEdgeIds })
    }
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
  }, [selectedNodeIds, selectedEdgeIds, dispatch])

  return (
    <div className="flex h-full flex-col">
      <DiagramToolbar
        model={model}
        dispatch={dispatch}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAutoLayout={handleAutoLayout}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeIds={selectedEdgeIds}
        onDeleteSelected={handleDeleteSelected}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={30}>
          <VisualCanvas
            model={model}
            dispatch={dispatch}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeIds={selectedEdgeIds}
            onSelectionChange={handleSelectionChange}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={40} minSize={20}>
          <CodePreviewPanel
            code={code}
            previewHtml={previewHtml}
            previewError={previewError}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
