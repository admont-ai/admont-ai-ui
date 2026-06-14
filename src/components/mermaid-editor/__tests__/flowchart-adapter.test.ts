import { describe, it, expect } from "vitest"
import { flowchartAdapter } from "@/components/mermaid-editor/adapters/flowchart-adapter"
import type { FlowchartNodeData } from "@/components/mermaid-editor/types"

function nodeById(model: Awaited<ReturnType<typeof flowchartAdapter.parse>>, id: string) {
  const node = model.nodes.find((n) => n.id === id)
  if (!node) throw new Error(`node ${id} not found`)
  return node.data as FlowchartNodeData
}

describe("flowchartAdapter.parse", () => {
  it("keeps edges and labels when both endpoints have inline shapes", async () => {
    const model = await flowchartAdapter.parse(
      ["graph TD", "    A[Start] --> B[Process]", "    B[Process] --> C[End]"].join("\n"),
    )

    expect(model.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"])
    expect(model.edges).toHaveLength(2)
    expect(model.edges.map((e) => [e.source, e.target])).toEqual([
      ["A", "B"],
      ["B", "C"],
    ])
    // The Start node stays connected (regression: it used to be detached) and
    // B keeps its "Process" label rather than collapsing to a bare "B".
    expect(nodeById(model, "A").label).toBe("Start")
    expect(nodeById(model, "A").shape).toBe("rect")
    expect(nodeById(model, "B").label).toBe("Process")
    expect(nodeById(model, "C").label).toBe("End")
  })

  it("parses inline shapes on the source even when the target is bare", async () => {
    const model = await flowchartAdapter.parse(["graph LR", "    A[Start] --> B"].join("\n"))
    expect(model.edges).toEqual([
      expect.objectContaining({ source: "A", target: "B" }),
    ])
    expect(nodeById(model, "A").label).toBe("Start")
    expect(nodeById(model, "B").label).toBe("B")
  })

  it("parses shapes, edge labels and arrow styles", async () => {
    const model = await flowchartAdapter.parse(
      [
        "flowchart TD",
        "    A([Start]) -->|go| B{Decision}",
        "    B -.-> C[(DB)]",
      ].join("\n"),
    )

    expect(nodeById(model, "A").shape).toBe("stadium")
    expect(nodeById(model, "B").shape).toBe("diamond")
    expect(nodeById(model, "C").shape).toBe("cylinder")
    expect(model.edges[0].data?.label).toBe("go")
    expect(model.edges[1].data?.strokeStyle).toBe("dotted")
  })

  it("round-trips a parsed model back through generate without losing edges", async () => {
    const source = ["graph TD", "    A[Start] --> B[Process]", "    B[Process] --> C[End]"].join("\n")
    const model = await flowchartAdapter.parse(source)
    const regenerated = flowchartAdapter.generate(model)
    const reparsed = await flowchartAdapter.parse(regenerated)

    expect(reparsed.edges.map((e) => [e.source, e.target])).toEqual([
      ["A", "B"],
      ["B", "C"],
    ])
    expect(nodeById(reparsed, "A").label).toBe("Start")
    expect(nodeById(reparsed, "B").label).toBe("Process")
    expect(nodeById(reparsed, "C").label).toBe("End")
  })
})
