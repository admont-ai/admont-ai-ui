import { Check, Globe, Loader2, Plus, RotateCcw, Settings, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { authFetch } from "@/lib/auth-fetch"
import { parseIdentity, inputClass } from "./UserListSection"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

const LEVEL_LABELS: Record<string, string> = {
  none: "No access",
  viewer: "Viewer",
  contributor: "Contributor",
  content_manager: "Content Manager",
  manager: "Manager",
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  none: "No access to files or folders",
  viewer: "View files and folders",
  contributor: "Add, edit files and folders",
  content_manager: "Add, edit, move, delete files and folders",
  manager: "Full control and manage permissions",
}

const ALL_LEVELS = ["none", "viewer", "contributor", "content_manager", "manager"] as const
const NON_ROOT_LEVELS = ["none", "viewer", "contributor", "content_manager"] as const
type Level = (typeof ALL_LEVELS)[number]

const LEVEL_RANK: Record<string, number> = {
  none: 0, viewer: 1, contributor: 2, content_manager: 3, manager: 4,
}

interface PermissionData {
  default?: string
  users: Record<string, string>
  groups: Record<string, string>
  owner?: string
  effective_level?: string
  source?: string
}

interface InheritedPerms {
  default?: string
  users: Record<string, string>
  groups: Record<string, string>
  source: string
}

interface AvailableEntry {
  identity: string
  name: string
  email: string
  provider?: string
  type: "internal" | "external" | "group"
}

const emptyData: PermissionData = { users: {}, groups: {} }

// Generate a consistent color from a string
function avatarColor(str: string): string {
  const colors = [
    "bg-blue-600", "bg-green-600", "bg-amber-600", "bg-red-600",
    "bg-purple-600", "bg-pink-600", "bg-teal-600", "bg-orange-600",
    "bg-indigo-600", "bg-cyan-600",
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}

export function PermissionsDialog({
  open,
  onOpenChange,
  repoSlug,
  path,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoSlug: string
  path: string
  onSaved?: () => void
}) {
  const { providers } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PermissionData | null>(null)
  const [hasPerms, setHasPerms] = useState(false)
  const [inherited, setInherited] = useState<InheritedPerms | null>(null)
  const [available, setAvailable] = useState<AvailableEntry[]>([])
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [manualProvider, setManualProvider] = useState(providers[0]?.name ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  if (!manualProvider && providers.length > 0) {
    setManualProvider(providers[0].name)
  }

  const encodedPath = path || "."
  const isRoot = !path || path === "."
  const apiUrl = `/repos/${encodeURIComponent(repoSlug)}/permissions/${encodedPath}`
  const rootApiUrl = `/repos/${encodeURIComponent(repoSlug)}/permissions/.`
  const groupsUrl = `/repos/${encodeURIComponent(repoSlug)}/groups`

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const fetches: Promise<Response | null>[] = [
        authFetch(apiUrl),
        authFetch(groupsUrl),
        authFetch("/admin/users/internal").catch(() => null),
        authFetch("/admin/users/external").catch(() => null),
      ]
      // Fetch root permissions for inheritance when not at root
      if (!isRoot) {
        fetches.push(authFetch(rootApiUrl).catch(() => null))
      }
      const [permRes, groupsRes, internalRes, externalRes, rootRes] = await Promise.all(fetches)

      if (permRes?.ok) {
        const d = await permRes.json()
        setData({
          default: d.default ?? undefined,
          users: d.users ?? {},
          groups: d.groups ?? {},
          owner: d.owner,
          effective_level: d.effective_level,
          source: d.source,
        })
        // Has direct permissions if there are any users, groups, or a non-default default level
        const hasDirectPerms = Object.keys(d.users ?? {}).length > 0
          || Object.keys(d.groups ?? {}).length > 0
          || (d.default != null && d.default !== "none")
        setHasPerms(hasDirectPerms)
      } else if (permRes?.status === 404) {
        setData({ ...emptyData })
        setHasPerms(false)
      }

      // Parse inherited permissions from root
      if (!isRoot && rootRes?.ok) {
        const rd = await rootRes.json()
        setInherited({
          default: rd.default,
          users: rd.users ?? {},
          groups: rd.groups ?? {},
          source: "root",
        })
      } else {
        setInherited(null)
      }

      const entries: AvailableEntry[] = []

      if (groupsRes?.ok) {
        const gs = await groupsRes.json()
        for (const g of Array.isArray(gs) ? gs : []) {
          entries.push({ identity: g.name, name: g.name, email: "", type: "group" })
        }
      }

      if (internalRes?.ok) {
        const internal: { email: string; first_name?: string; last_name?: string }[] = await internalRes.json() ?? []
        for (const u of internal) {
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ")
          entries.push({ identity: `internal:${u.email}`, name: name || u.email, email: u.email, provider: "internal", type: "internal" })
        }
      }
      if (externalRes?.ok) {
        const external: { provider: string; email: string; first_name?: string; last_name?: string }[] = await externalRes.json() ?? []
        for (const u of external) {
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ")
          entries.push({ identity: `${u.provider}:${u.email}`, name: name || u.email, email: u.email, provider: u.provider, type: "external" })
        }
      }
      setAvailable(entries)
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [apiUrl, groupsUrl, isRoot, rootApiUrl])

  useEffect(() => {
    if (open) fetchData()
  }, [open, fetchData])

  async function handleSave() {
    if (!data) return
    setSaving(true)
    try {
      const body = {
        default: data.default || "none",
        users: data.users,
        groups: data.groups,
      }
      const res = await authFetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Permissions saved")
        setHasPerms(true)
        onSaved?.()
        onOpenChange(false)
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const res = await authFetch(apiUrl, { method: "DELETE" })
      if (res.ok) {
        toast.success("Permissions removed")
        setData({ ...emptyData })
        setHasPerms(false)
        onSaved?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  async function handleResetAll() {
    setSaving(true)
    try {
      const res = await authFetch(`/repos/${encodeURIComponent(repoSlug)}/permissions/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default: "none" }),
      })
      if (res.ok) {
        toast.success("All permissions reset")
        await fetchData()
        onSaved?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  function addEntry(identity: string, isGroup: boolean) {
    if (!data) return
    // Default to one level above inherited, or viewer
    const inheritedLvl = isGroup ? inherited?.groups[identity] : inherited?.users[identity]
    const inheritedRank = inheritedLvl ? LEVEL_RANK[inheritedLvl] : 0
    const defaultLevel = ALL_LEVELS.find((l) => LEVEL_RANK[l] > inheritedRank && l !== "none") ?? "viewer"
    if (isGroup) {
      setData({ ...data, groups: { ...data.groups, [identity]: defaultLevel } })
    } else {
      setData({ ...data, users: { ...data.users, [identity]: defaultLevel } })
    }
    setSearch("")
    setShowDropdown(false)
    setHighlightIndex(-1)
  }

  function handleManualAdd() {
    const trimmed = search.trim().toLowerCase()
    if (!trimmed) return
    const identity = manualProvider ? `${manualProvider}:${trimmed}` : trimmed
    addEntry(identity, false)
  }

  function setLevel(key: string, level: Level, isGroup: boolean) {
    if (!data) return
    if (isGroup) {
      setData({ ...data, groups: { ...data.groups, [key]: level } })
    } else {
      setData({ ...data, users: { ...data.users, [key]: level } })
    }
  }

  function removeEntry(key: string, isGroup: boolean) {
    if (!data) return
    if (isGroup) {
      const { [key]: _removed, ...rest } = data.groups
      void _removed
      setData({ ...data, groups: rest })
    } else {
      const { [key]: _removed, ...rest } = data.users
      void _removed
      setData({ ...data, users: rest })
    }
  }

  // Build combined member list for display
  const existingKeys = new Set([
    ...Object.keys(data?.users ?? {}),
    ...Object.keys(data?.groups ?? {}),
  ])

  // Filter available entries for dropdown
  const filtered = available.filter((e) => {
    if (existingKeys.has(e.identity)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.identity.toLowerCase().includes(q)
  })

  // Check if search looks like an email for manual add
  const isEmailLike = search.includes("@") && search.trim().length > 3

  const levels = isRoot ? ALL_LEVELS : NON_ROOT_LEVELS
  const displayPath = path || "Default"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-lg truncate">
              Permissions — {displayPath}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1 shrink-0">
            {(hasPerms || isRoot) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" title="Settings">
                    <Settings className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hasPerms && (
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="size-4" />
                      Remove permissions
                    </DropdownMenuItem>
                  )}
                  {isRoot && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <RotateCcw className="size-4" />
                          Reset all permissions
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset all permissions?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will reset all file and folder permissions for this repository to default (none). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={handleResetAll}>Reset All</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* Search / Add input */}
            <div className="relative px-5 pb-3">
              <div className="flex items-center gap-1.5">
                {providers.length > 0 && isEmailLike && (
                  <div className="relative shrink-0">
                    <select
                      value={manualProvider}
                      onChange={(e) => setManualProvider(e.target.value)}
                      className={inputClass + " w-auto pr-6 appearance-none cursor-pointer pl-7 h-9"}
                      title="Auth provider"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {providers.map((p) => (
                        <option key={p.name} value={p.name}>{p.display_name}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
                      <ProviderIcon provider={manualProvider} className="size-3.5" />
                    </span>
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 7l3-3.5H2z" /></svg>
                    </span>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setShowDropdown(true)
                    setHighlightIndex(-1)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (showDropdown && filtered.length > 0) {
                      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)); return }
                      if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)); return }
                      if (e.key === "Enter" && highlightIndex >= 0) {
                        e.preventDefault()
                        const entry = filtered[highlightIndex]
                        addEntry(entry.identity, entry.type === "group")
                        return
                      }
                    }
                    if (e.key === "Enter" && isEmailLike) {
                      e.preventDefault()
                      handleManualAdd()
                    }
                  }}
                  placeholder="Add people and groups"
                  className="flex-1 min-w-0 rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Dropdown */}
              {showDropdown && search.trim().length > 0 && (
                <div ref={dropdownRef} className="absolute left-5 right-5 z-50 mt-1 rounded-lg border bg-popover shadow-lg max-h-56 overflow-y-auto">
                  {filtered.length > 0 && filtered.map((entry, i) => (
                    <button
                      key={entry.identity}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addEntry(entry.identity, entry.type === "group")}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                        i === highlightIndex ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      {entry.type === "group" ? (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Users className="size-4 text-muted-foreground" />
                        </span>
                      ) : (
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-medium", avatarColor(entry.identity))}>
                          {(entry.name[0] || entry.email[0] || "?").toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{entry.name}</span>
                          {entry.provider && <ProviderIcon provider={entry.provider} className="size-3 shrink-0 opacity-50" />}
                          <span className="text-[10px] text-muted-foreground shrink-0">{entry.type === "group" ? "Group" : entry.type === "internal" ? "Internal" : "External"}</span>
                        </div>
                        {entry.email && <p className="text-xs text-muted-foreground truncate">{entry.email}</p>}
                      </div>
                    </button>
                  ))}
                  {isEmailLike && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleManualAdd}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/50 border-t"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Plus className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm">Add <strong>{search.trim()}</strong></span>
                        {manualProvider && <span className="text-xs text-muted-foreground ml-1">via {manualProvider}</span>}
                      </div>
                    </button>
                  )}
                  {filtered.length === 0 && !isEmailLike && (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No matches. Type an email to add manually.</p>
                  )}
                </div>
              )}
            </div>

            {/* Member list */}
            <div className="max-h-[50vh] overflow-y-auto px-2">
              {/* Owner info */}
              {data.owner && (
                <div className="px-3 py-1.5 mb-1">
                  <p className="text-xs text-muted-foreground">
                    Owner: {data.owner}
                    {data.source && data.source !== encodedPath && <> (inherited from {data.source})</>}
                  </p>
                </div>
              )}

              {/* Default access */}
              <div className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Globe className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">Default access</span>
                  <p className="text-xs text-muted-foreground">Everyone without a specific role</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      {LEVEL_LABELS[data.default || "none"] || data.default || "No access"}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="opacity-60"><path d="M2 3.5L5 7l3-3.5H2z" /></svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {levels.map((l) => (
                      <DropdownMenuItem
                        key={l}
                        onClick={() => setData({ ...data, default: l })}
                        className="flex items-start gap-3 py-2.5 px-3"
                      >
                        <span className={cn("mt-0.5 size-4 shrink-0", (data.default || "none") === l ? "text-primary" : "text-transparent")}>
                          {(data.default || "none") === l && <Check className="size-4" />}
                        </span>
                        <div>
                          <div className="text-sm font-medium">{LEVEL_LABELS[l]}</div>
                          <div className="text-xs text-muted-foreground">{LEVEL_DESCRIPTIONS[l]}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Direct users */}
              {Object.entries(data.users).map(([key, level]) => {
                const { provider, email } = parseIdentity(key)
                const avail = available.find((a) => a.identity === key)
                const name = avail?.name || email
                const inheritedLevel = inherited?.users[key] as Level | undefined
                return (
                  <MemberRow
                    key={key}
                    name={name}
                    detail={email}
                    provider={provider}
                    level={level as Level}
                    levels={levels}
                    inheritedLevel={inheritedLevel}
                    onChangeLevel={(l) => setLevel(key, l, false)}
                    onRemove={() => removeEntry(key, false)}
                  />
                )
              })}

              {/* Direct groups */}
              {Object.entries(data.groups).map(([key, level]) => {
                const inheritedLevel = inherited?.groups[key] as Level | undefined
                return (
                  <MemberRow
                    key={`group:${key}`}
                    name={key}
                    detail="Group"
                    isGroup
                    level={level as Level}
                    levels={levels}
                    inheritedLevel={inheritedLevel}
                    onChangeLevel={(l) => setLevel(key, l, true)}
                    onRemove={() => removeEntry(key, true)}
                  />
                )
              })}

              {/* Inherited members */}
              {inherited && (() => {
                const inheritedUsers = Object.entries(inherited.users).filter(([key]) => !(key in data.users))
                const inheritedGroups = Object.entries(inherited.groups).filter(([key]) => !(key in data.groups))
                if (inheritedUsers.length === 0 && inheritedGroups.length === 0) return null
                return (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inherited from root</p>
                    </div>
                    {inheritedUsers.map(([key, level]) => {
                      const { provider, email } = parseIdentity(key)
                      const avail = available.find((a) => a.identity === key)
                      const name = avail?.name || email
                      return (
                        <MemberRow
                          key={`inherited:${key}`}
                          name={name}
                          detail={email}
                          provider={provider}
                          level={level as Level}
                          levels={levels}
                          inheritedLevel={level as Level}
                          onChangeLevel={(l) => setLevel(key, l, false)}
                        />
                      )
                    })}
                    {inheritedGroups.map(([key, level]) => (
                      <MemberRow
                        key={`inherited:group:${key}`}
                        name={key}
                        detail="Group"
                        isGroup
                        level={level as Level}
                        levels={levels}
                        inheritedLevel={level as Level}
                        onChangeLevel={(l) => setLevel(key, l, true)}
                      />
                    ))}
                  </>
                )
              })()}

              {Object.keys(data.users).length === 0 && Object.keys(data.groups).length === 0 && !inherited && (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                  {hasPerms ? "No members added yet." : "No permissions set. Add people or groups above."}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Done
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({
  name,
  detail,
  provider,
  isGroup,
  level,
  levels,
  inherited,
  inheritedLevel,
  onChangeLevel,
  onRemove,
}: {
  name: string
  detail: string
  provider?: string
  isGroup?: boolean
  level: Level
  levels: readonly Level[]
  inherited?: boolean
  inheritedLevel?: Level
  onChangeLevel?: (level: Level) => void
  onRemove?: () => void
}) {
  const minRank = inheritedLevel ? LEVEL_RANK[inheritedLevel] : 0
  // Only show levels strictly higher than inherited (can only escalate)
  const selectableLevels = levels.filter((l) => l !== "none" && LEVEL_RANK[l] > minRank)
  const hasInherited = !!inheritedLevel && LEVEL_RANK[inheritedLevel] > 0

  return (
    <div className={cn("group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors", inherited ? "opacity-60" : "hover:bg-muted/50")}>
      {/* Avatar */}
      {isGroup ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Users className="size-4 text-muted-foreground" />
        </span>
      ) : (
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-white text-sm font-medium", avatarColor(name + detail))}>
          {(name[0] || "?").toUpperCase()}
        </span>
      )}

      {/* Name & email */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{name}</span>
          {provider && <ProviderIcon provider={provider} className="size-3 shrink-0 opacity-50" />}
        </div>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>

      {/* Role dropdown or static label */}
      {inherited ? (
        <span className="text-sm text-muted-foreground shrink-0">
          {LEVEL_LABELS[level] || level}
        </span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              {LEVEL_LABELS[level] || level}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="opacity-60"><path d="M2 3.5L5 7l3-3.5H2z" /></svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {selectableLevels.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => onChangeLevel?.(l)}
                className="flex items-start gap-3 py-2.5 px-3"
              >
                <span className={cn("mt-0.5 size-4 shrink-0", level === l ? "text-primary" : "text-transparent")}>
                  {level === l && <Check className="size-4" />}
                </span>
                <div>
                  <div className="text-sm font-medium">{LEVEL_LABELS[l]}</div>
                  <div className="text-xs text-muted-foreground">{LEVEL_DESCRIPTIONS[l]}</div>
                </div>
              </DropdownMenuItem>
            ))}
            {hasInherited && (
              <>
                <DropdownMenuSeparator />
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Inherited: {LEVEL_LABELS[inheritedLevel!]} from root
                </div>
              </>
            )}
            {onRemove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRemove} className="flex items-start gap-3 py-2.5 px-3 text-destructive focus:text-destructive">
                  <span className="mt-0.5 size-4 shrink-0" />
                  <span className="text-sm">{hasInherited ? "Revert to inherited" : "Remove access"}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
