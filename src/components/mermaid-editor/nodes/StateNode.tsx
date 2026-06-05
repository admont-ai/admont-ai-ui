import { memo, useCallback, useState, useRef, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { StateNodeData } from "../types"

function StateNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StateNodeData
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
    if (nodeData.variant === "start" || nodeData.variant === "end") return
    setEditValue(nodeData.label)
    setEditing(true)
  }, [nodeData.label, nodeData.variant])

  const handleBlur = useCallback(() => setEditing(false), [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") setEditing(false)
  }, [])

  // Start state: filled circle
  if (nodeData.variant === "start") {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-black" />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />
      </div>
    )
  }

  // End state: filled circle with ring
  if (nodeData.variant === "end") {
    return (
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-black ring-2 ring-black ring-offset-2" />
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
      </div>
    )
  }

  // Choice state: diamond
  if (nodeData.variant === "choice") {
    return (
      <div
        className={`w-10 h-10 bg-white border-2 ${selected ? "border-blue-500" : "border-gray-400"} [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]`}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />
      </div>
    )
  }

  // Fork/Join state: horizontal bar
  if (nodeData.variant === "fork" || nodeData.variant === "join") {
    return (
      <div className="w-40 h-2 bg-black rounded-sm">
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
      </div>
    )
  }

  // Default state: rounded rectangle
  return (
    <div
      className={`
        flex flex-col items-center justify-center rounded-lg border-2 bg-white px-4 py-2 text-sm min-w-[100px]
        ${selected ? "border-blue-500 shadow-md" : "border-gray-400"}
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
        <>
          <span className="font-medium select-none">{nodeData.label}</span>
          {nodeData.description && (
            <span className="text-xs text-gray-500 mt-0.5 select-none">{nodeData.description}</span>
          )}
        </>
      )}
    </div>
  )
}

export default memo(StateNode)
