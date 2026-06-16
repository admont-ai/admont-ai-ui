import { Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { IdentityInput } from "./IdentityInput"

export const inputClass =
  "border-input bg-transparent ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

/** Split "provider:email" into parts; returns [undefined, raw] if no colon */
export function parseIdentity(identity: string): { provider?: string; email: string } {
  if (!identity) return { email: "" }
  const idx = identity.indexOf(":")
  if (idx > 0) return { provider: identity.slice(0, idx), email: identity.slice(idx + 1) }
  return { email: identity }
}

export function TagList({
  items,
  onRemove,
}: {
  items: string[]
  onRemove: (item: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const { provider, email } = parseIdentity(item)
        return (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
          >
            {provider && <ProviderIcon provider={provider} className="size-3 shrink-0" />}
            {email}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

export function UserListSection({
  title,
  items,
  saving,
  onSave,
  onChange,
}: {
  title: string
  items: string[]
  saving?: boolean
  onSave?: (items: string[]) => void
  onChange?: (items: string[]) => void
}) {
  const [list, setList] = useState(items)
  const dirty = JSON.stringify(list) !== JSON.stringify(items)

  useEffect(() => {
    setList(items)
  }, [items])

  function update(next: string[]) {
    setList(next)
    onChange?.(next)
  }

  return (
    <section>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <TagList items={list} onRemove={(item) => update(list.filter((i) => i !== item))} />
      <div className="flex gap-2 mt-2 items-center">
        <div className="flex-1">
          <IdentityInput
            onAdd={(identity) => {
              if (!list.includes(identity)) update([...list, identity])
            }}
            existingKeys={list}
          />
        </div>
        {dirty && onSave && (
          <Button size="sm" onClick={() => onSave(list)} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        )}
      </div>
    </section>
  )
}
