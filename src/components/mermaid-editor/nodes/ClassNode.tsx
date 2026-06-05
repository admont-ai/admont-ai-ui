import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { ClassNodeData } from "../types"

function ClassNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ClassNodeData

  return (
    <div
      className={`
        flex flex-col rounded border-2 bg-white text-xs min-w-[160px]
        ${selected ? "border-blue-500 shadow-md" : "border-gray-400"}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-gray-400" />

      {/* Class name header */}
      <div className="border-b border-gray-300 bg-gray-50 px-3 py-1.5 text-center">
        {nodeData.annotation && (
          <div className="text-[10px] text-gray-400 italic">&laquo;{nodeData.annotation}&raquo;</div>
        )}
        <div className="font-bold text-sm">{nodeData.label}</div>
      </div>

      {/* Members section */}
      <div className="border-b border-gray-300 px-3 py-1 min-h-[20px]">
        {nodeData.members.map((m, i) => (
          <div key={i} className="font-mono leading-relaxed">
            <span className="text-purple-600">{m.visibility}</span>
            {m.name}
            {m.type && <span className="text-gray-400"> : {m.type}</span>}
          </div>
        ))}
        {nodeData.members.length === 0 && (
          <div className="text-gray-300 italic">no fields</div>
        )}
      </div>

      {/* Methods section */}
      <div className="px-3 py-1 min-h-[20px]">
        {nodeData.methods.map((m, i) => (
          <div key={i} className="font-mono leading-relaxed">
            <span className="text-purple-600">{m.visibility}</span>
            {m.name}({m.parameters || ""})
            {m.returnType && <span className="text-gray-400"> : {m.returnType}</span>}
          </div>
        ))}
        {nodeData.methods.length === 0 && (
          <div className="text-gray-300 italic">no methods</div>
        )}
      </div>
    </div>
  )
}

export default memo(ClassNode)
