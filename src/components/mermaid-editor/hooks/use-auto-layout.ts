import { useCallback } from "react"
import dagre from "@dagrejs/dagre"
import type { DiagramNode, DiagramEdge } from "../types"
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from "../constants"

interface LayoutOptions {
  direction?: string // TB, BT, LR, RL
  nodeWidth?: number
  nodeHeight?: number
}

export function useAutoLayout() {
  const layoutNodes = useCallback(
    (
      nodes: DiagramNode[],
      edges: DiagramEdge[],
      options: LayoutOptions = {},
    ): DiagramNode[] => {
      const {
        direction = "TB",
        nodeWidth = DEFAULT_NODE_WIDTH,
        nodeHeight = DEFAULT_NODE_HEIGHT,
      } = options

      if (nodes.length === 0) return nodes

      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({
        rankdir: direction === "TD" ? "TB" : direction,
        nodesep: 60,
        ranksep: 80,
        marginx: 40,
        marginy: 40,
      })

      for (const node of nodes) {
        g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
      }

      for (const edge of edges) {
        g.setEdge(edge.source, edge.target)
      }

      dagre.layout(g)

      return nodes.map((node) => {
        const pos = g.node(node.id)
        if (!pos) return node
        return {
          ...node,
          position: {
            x: pos.x - nodeWidth / 2,
            y: pos.y - nodeHeight / 2,
          },
        }
      })
    },
    [],
  )

  return { layoutNodes }
}
