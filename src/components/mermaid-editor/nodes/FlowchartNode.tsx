import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { FlowchartNodeData, FlowchartShape } from "../types"

const shapeStyles: Record<FlowchartShape, string> = {
  rect: "rounded-sm",
  rounded: "rounded-xl",
  stadium: "rounded-full",
  subroutine: "rounded-sm border-double border-4",
  cylinder: "rounded-sm [border-radius:50%/10%]",
  circle: "rounded-full aspect-square",
  asymmetric: "rounded-sm [clip-path:polygon(0%_0%,100%_0%,100%_100%,10%_100%,0%_50%)]",
  diamond: "[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]",
  hexagon: "[clip-path:polygon(10%_0%,90%_0%,100%_50%,90%_100%,10%_100%,0%_50%)]",
  parallelogram: "[clip-path:polygon(15%_0%,100%_0%,85%_100%,0%_100%)]",
  "parallelogram-alt": "[clip-path:polygon(0%_0%,85%_0%,100%_100%,15%_100%)]",
  trapezoid: "[clip-path:polygon(10%_0%,90%_0%,100%_100%,0%_100%)]",
  "trapezoid-alt": "[clip-path:polygon(0%_0%,100%_0%,90%_100%,10%_100%)]",
  "double-circle": "rounded-full ring-2 ring-offset-2 ring-blue-400",
}

function FlowchartNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowchartNodeData
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(nodeData.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleDoubleClick = useCallback(() => {
    setEditValue(nodeData.label)
    setEditing(true)
  }, [nodeData.label])

  const handleBlur = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditing(false)
    }
  }, [])

  const shape = nodeData.shape || "rect"
  const needsExtraWidth = shape === "diamond" || shape === "hexagon" || shape === "parallelogram" || shape === "parallelogram-alt"

  return (
    <div
      className={`
        flex items-center justify-center border-2 bg-white px-4 py-2 text-sm
        ${shapeStyles[shape] || shapeStyles.rect}
        ${selected ? "border-blue-500 shadow-md" : "border-gray-400"}
        ${needsExtraWidth ? "min-w-[120px] min-h-[60px]" : "min-w-[80px] min-h-[40px]"}
      `}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-center text-sm outline-none"
        />
      ) : (
        <span className="text-center leading-tight select-none">{nodeData.label}</span>
      )}
    </div>
  )
}

export default memo(FlowchartNode)
