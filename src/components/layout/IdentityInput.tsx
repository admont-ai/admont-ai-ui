import { Plus } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"
import { inputClass } from "./UserListSection"

/**
 * Input for entering user identities in "provider:email" format.
 * Shows a provider selector when multiple providers are available.
 * When availableUsers is provided, shows a filterable dropdown list.
 */
export function IdentityInput({
  onAdd,
  existingKeys,
  placeholder = "user@example.com",
  availableUsers,
}: {
  onAdd: (identity: string) => void
  existingKeys?: string[]
  placeholder?: string
  availableUsers?: { identity: string; label: string }[]
}) {
  const { providers } = useAuth()
  const [provider, setProvider] = useState(providers[0]?.name ?? "")
  const [email, setEmail] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep provider in sync if providers load after mount
  if (!provider && providers.length > 0) {
    setProvider(providers[0].name)
  }

  const unusedUsers = availableUsers?.filter((u) => !existingKeys?.includes(u.identity)) ?? []
  const filtered = email.trim()
    ? unusedUsers.filter((u) => u.label.toLowerCase().includes(email.toLowerCase()) || u.identity.toLowerCase().includes(email.toLowerCase()))
    : unusedUsers

  function handleAdd() {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) return
    const identity = provider ? `${provider}:${trimmedEmail}` : trimmedEmail
    if (existingKeys?.includes(identity)) return
    onAdd(identity)
    setEmail("")
    setShowDropdown(false)
    setHighlightIndex(-1)
  }

  function handleSelectUser(identity: string) {
    if (existingKeys?.includes(identity)) return
    onAdd(identity)
    setEmail("")
    setShowDropdown(false)
    setHighlightIndex(-1)
    inputRef.current?.focus()
  }

  const hasAvailableUsers = (availableUsers?.length ?? 0) > 0

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        {!hasAvailableUsers && providers.length > 0 && (
          <div className="relative shrink-0">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={inputClass + " w-auto pr-7 appearance-none cursor-pointer pl-8"}
              title="Auth provider"
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
              <ProviderIcon provider={provider} className="size-3.5" />
            </span>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 7l3-3.5H2z" /></svg>
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setShowDropdown(true)
            setHighlightIndex(-1)
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => setShowDropdown(false), 150)
          }}
          onKeyDown={(e) => {
            if (hasAvailableUsers && showDropdown && filtered.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
                return
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setHighlightIndex((i) => Math.max(i - 1, 0))
                return
              }
              if (e.key === "Enter" && highlightIndex >= 0) {
                e.preventDefault()
                handleSelectUser(filtered[highlightIndex].identity)
                return
              }
            }
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={hasAvailableUsers ? "Search users…" : placeholder}
          className={inputClass + " flex-1 min-w-0"}
        />
        {!hasAvailableUsers && (
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={!email.trim()}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      {hasAvailableUsers && showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {filtered.map((u, i) => {
            const providerKey = u.identity.includes(":") ? u.identity.split(":")[0] : undefined
            return (
              <button
                key={u.identity}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectUser(u.identity)}
                className={
                  "flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors " +
                  (i === highlightIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")
                }
              >
                {providerKey && <ProviderIcon provider={providerKey} className="size-3.5 shrink-0" />}
                <span className="truncate">{u.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
