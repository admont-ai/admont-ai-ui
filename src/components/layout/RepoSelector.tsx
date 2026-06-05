import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Repo } from "@/types"

export function RepoSelector({
  repos,
  loading,
  value,
  onValueChange,
}: {
  repos: Repo[]
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
        <SelectValue placeholder="Select repository" />
      </SelectTrigger>
      <SelectContent position="popper">
        {repos.map((repo) => (
          <SelectItem key={repo.slug} value={repo.slug}>
            {repo.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
