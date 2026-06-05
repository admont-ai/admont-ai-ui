import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiModel } from "@/types"

export function ModelSelector({
  models,
  loading,
  value,
  onValueChange,
}: {
  models: AiModel[]
  loading: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  if (loading) {
    return <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="min-w-36">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent position="popper">
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
