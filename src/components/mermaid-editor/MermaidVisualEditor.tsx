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
  /**
   * Fires when the generated code changes. `isInitial` is true while no user
   * interaction has occurred yet (load-time parse / auto-layout normalization)
   * and false once the user has edited the diagram — lets the parent avoid
   * treating editor reformatting as a draft-worthy change.
   */
  onCodeChange: (code: string, isInitial: boolean) => void
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

  // Tracks whether the user has actually edited the diagram. Every code
  // regeneration before this flips is load/normalization, not a user edit.
  const userInteractedRef = useRef(false)
  const userDispatch = useCallback(
    (action: Parameters<typeof dispatch>[0]) => {
      userInteractedRef.current = true
      dispatch(action)
    },
    [dispatch],
  )
  const userUndo = useCallback(() => {
    userInteractedRef.current = true
    undo()
  }, [undo])
  const userRedo = useCallback(() => {
    userInteractedRef.current = true
    redo()
  }, [redo])

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
      onCodeChange(code, !userInteractedRef.current)
    }
  }, [code, onCodeChange])

  const handleAutoLayout = useCallback(() => {
    const layouted = layoutNodes(model.nodes, model.edges, {
      direction: model.direction,
    })
    userDispatch({ type: "SET_NODES", nodes: layouted })
  }, [model, layoutNodes, userDispatch])

  const handleSelectionChange = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      setSelectedNodeIds(nodeIds)
      setSelectedEdgeIds(edgeIds)
    },
    [],
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      userDispatch({ type: "REMOVE_NODES", ids: selectedNodeIds })
    }
    if (selectedEdgeIds.length > 0) {
      userDispatch({ type: "REMOVE_EDGES", ids: selectedEdgeIds })
    }
    setSelectedNodeIds([])
    setSelectedEdgeIds([])
  }, [selectedNodeIds, selectedEdgeIds, userDispatch])

  return (
    <div className="flex h-full flex-col">
      <DiagramToolbar
        model={model}
        dispatch={userDispatch}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={userUndo}
        onRedo={userRedo}
        onAutoLayout={handleAutoLayout}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeIds={selectedEdgeIds}
        onDeleteSelected={handleDeleteSelected}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={30}>
          <VisualCanvas
            model={model}
            dispatch={userDispatch}
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
