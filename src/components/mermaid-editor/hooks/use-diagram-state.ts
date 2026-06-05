import { useReducer, useCallback } from "react"
import type {
  DiagramModel,
  DiagramAction,
  DiagramNodeData,
} from "../types"

interface DiagramState {
  model: DiagramModel
  past: DiagramModel[]
  future: DiagramModel[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
}

const MAX_HISTORY = 50

function pushHistory(state: DiagramState): { past: DiagramModel[]; future: DiagramModel[] } {
  const past = [...state.past, state.model].slice(-MAX_HISTORY)
  return { past, future: [] }
}

function reducer(state: DiagramState, action: DiagramAction): DiagramState {
  switch (action.type) {
    case "SET_MODEL":
      return {
        ...state,
        model: action.model,
        ...pushHistory(state),
      }

    case "ADD_NODE": {
      const hist = pushHistory(state)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          nodes: [...state.model.nodes, action.node],
        },
      }
    }

    case "REMOVE_NODES": {
      const hist = pushHistory(state)
      const idSet = new Set(action.ids)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          nodes: state.model.nodes.filter((n) => !idSet.has(n.id)),
          edges: state.model.edges.filter(
            (e) => !idSet.has(e.source) && !idSet.has(e.target),
          ),
        },
        selectedNodeIds: state.selectedNodeIds.filter((id) => !idSet.has(id)),
      }
    }

    case "UPDATE_NODE": {
      const hist = pushHistory(state)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          nodes: state.model.nodes.map((n) =>
            n.id === action.id
              ? { ...n, data: { ...n.data, ...action.data } as DiagramNodeData }
              : n,
          ),
        },
      }
    }

    case "MOVE_NODE": {
      // No undo for position changes (too noisy)
      return {
        ...state,
        model: {
          ...state.model,
          nodes: state.model.nodes.map((n) =>
            n.id === action.id ? { ...n, position: action.position } : n,
          ),
        },
      }
    }

    case "ADD_EDGE": {
      const hist = pushHistory(state)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          edges: [...state.model.edges, action.edge],
        },
      }
    }

    case "REMOVE_EDGES": {
      const hist = pushHistory(state)
      const idSet = new Set(action.ids)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          edges: state.model.edges.filter((e) => !idSet.has(e.id)),
        },
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => !idSet.has(id)),
      }
    }

    case "UPDATE_EDGE": {
      const hist = pushHistory(state)
      return {
        ...state,
        ...hist,
        model: {
          ...state.model,
          edges: state.model.edges.map((e) =>
            e.id === action.id
              ? { ...e, data: { ...e.data, ...action.data } }
              : e,
          ),
        },
      }
    }

    case "SET_DIRECTION": {
      const hist = pushHistory(state)
      return {
        ...state,
        ...hist,
        model: { ...state.model, direction: action.direction },
      }
    }

    case "SET_NODES":
      return {
        ...state,
        model: { ...state.model, nodes: action.nodes },
      }

    case "SET_EDGES":
      return {
        ...state,
        model: { ...state.model, edges: action.edges },
      }

    case "UNDO": {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        model: previous,
        past: state.past.slice(0, -1),
        future: [state.model, ...state.future].slice(0, MAX_HISTORY),
      }
    }

    case "REDO": {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        ...state,
        model: next,
        past: [...state.past, state.model],
        future: state.future.slice(1),
      }
    }

    default:
      return state
  }
}

export function useDiagramState(initialModel: DiagramModel) {
  const [state, dispatch] = useReducer(reducer, {
    model: initialModel,
    past: [],
    future: [],
    selectedNodeIds: [],
    selectedEdgeIds: [],
  })

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  const undo = useCallback(() => dispatch({ type: "UNDO" }), [])
  const redo = useCallback(() => dispatch({ type: "REDO" }), [])

  return {
    model: state.model,
    nodes: state.model.nodes,
    edges: state.model.edges,
    canUndo,
    canRedo,
    dispatch,
    undo,
    redo,
  }
}
