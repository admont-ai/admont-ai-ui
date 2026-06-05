import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { ErEntityNodeData } from "../types"

function ErEntityNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as ErEntityNodeData

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

      {/* Entity name header */}
      <div className="border-b border-gray-300 bg-blue-50 px-3 py-1.5 text-center">
        <div className="font-bold text-sm">{nodeData.label}</div>
      </div>

      {/* Attributes */}
      <div className="px-3 py-1">
        {nodeData.attributes.map((attr, i) => (
          <div key={i} className="flex items-center gap-2 font-mono leading-relaxed">
            <span className="text-blue-600 min-w-[40px]">{attr.type}</span>
            <span>{attr.name}</span>
            {attr.keys.length > 0 && (
              <span className="text-amber-600 text-[10px] font-bold ml-auto">{attr.keys.join(",")}</span>
            )}
          </div>
        ))}
        {nodeData.attributes.length === 0 && (
          <div className="text-gray-300 italic py-0.5">no attributes</div>
        )}
      </div>
    </div>
  )
}

export default memo(ErEntityNode)
