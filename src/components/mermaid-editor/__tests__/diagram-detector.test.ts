import { describe, it, expect } from "vitest"
import { detectDiagramType, isVisualDiagramType } from "@/components/mermaid-editor/diagram-detector"

describe("detectDiagramType", () => {
  it("detects flowchart from 'flowchart' keyword", () => {
    expect(detectDiagramType("flowchart TD\n  A --> B")).toEqual({
      type: "flowchart",
      isVisual: true,
    })
  })

  it("detects flowchart from 'graph' keyword", () => {
    expect(detectDiagramType("graph LR\n  A --> B")).toEqual({
      type: "flowchart",
      isVisual: true,
    })
  })

  it("detects stateDiagram", () => {
    expect(detectDiagramType("stateDiagram-v2\n  [*] --> Active")).toEqual({
      type: "stateDiagram",
      isVisual: true,
    })
  })

  it("detects classDiagram", () => {
    expect(detectDiagramType("classDiagram\n  class Animal")).toEqual({
      type: "classDiagram",
      isVisual: true,
    })
  })

  it("detects erDiagram", () => {
    expect(detectDiagramType("erDiagram\n  CUSTOMER ||--o{ ORDER : places")).toEqual({
      type: "erDiagram",
      isVisual: true,
    })
  })

  it("detects sequence diagram", () => {
    expect(detectDiagramType("sequenceDiagram\n  Alice->>Bob: Hello")).toEqual({
      type: "sequence",
      isVisual: false,
    })
  })

  it("detects gantt chart", () => {
    expect(detectDiagramType("gantt\n  title A Gantt Diagram")).toEqual({
      type: "gantt",
      isVisual: false,
    })
  })

  it("detects pie chart", () => {
    expect(detectDiagramType("pie\n  title Pets")).toEqual({
      type: "pie",
      isVisual: false,
    })
  })

  it("detects gitGraph", () => {
    expect(detectDiagramType("gitGraph\n  commit")).toEqual({
      type: "gitGraph",
      isVisual: false,
    })
  })

  it("returns 'other' for unknown diagram types", () => {
    expect(detectDiagramType("unknown\n  something")).toEqual({
      type: "other",
      isVisual: false,
    })
  })

  it("returns 'other' for empty string", () => {
    expect(detectDiagramType("")).toEqual({
      type: "other",
      isVisual: false,
    })
  })

  it("is case-insensitive", () => {
    expect(detectDiagramType("FlowChart TD\n  A --> B")).toEqual({
      type: "flowchart",
      isVisual: true,
    })
  })

  it("handles leading whitespace", () => {
    expect(detectDiagramType("  \n  flowchart TD\n  A --> B")).toEqual({
      type: "flowchart",
      isVisual: true,
    })
  })
})

describe("isVisualDiagramType", () => {
  it("returns true for flowchart", () => {
    expect(isVisualDiagramType("flowchart")).toBe(true)
  })

  it("returns true for stateDiagram", () => {
    expect(isVisualDiagramType("stateDiagram")).toBe(true)
  })

  it("returns true for classDiagram", () => {
    expect(isVisualDiagramType("classDiagram")).toBe(true)
  })

  it("returns true for erDiagram", () => {
    expect(isVisualDiagramType("erDiagram")).toBe(true)
  })

  it("returns false for sequence", () => {
    expect(isVisualDiagramType("sequence")).toBe(false)
  })

  it("returns false for gantt", () => {
    expect(isVisualDiagramType("gantt")).toBe(false)
  })

  it("returns false for pie", () => {
    expect(isVisualDiagramType("pie")).toBe(false)
  })

  it("returns false for gitGraph", () => {
    expect(isVisualDiagramType("gitGraph")).toBe(false)
  })

  it("returns false for other", () => {
    expect(isVisualDiagramType("other")).toBe(false)
  })
})
