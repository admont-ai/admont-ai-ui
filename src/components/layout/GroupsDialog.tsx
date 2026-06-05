import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { authFetch } from "@/lib/auth-fetch"
import { inputClass, parseIdentity, TagList } from "./UserListSection"
import { IdentityInput } from "./IdentityInput"

interface Group {
  name: string
  members: string[]
}

export function GroupsDialog({
  open,
  onOpenChange,
  repoSlug,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoSlug: string
  onSaved?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const baseUrl = `/repos/${encodeURIComponent(repoSlug)}/groups`

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(baseUrl)
      if (res.ok) {
        const data = await res.json()
        console.log("[groups]", data)
        const parsed: Group[] = (Array.isArray(data) ? data : []).map((g: { name: string; members?: string[] | null }) => ({
          name: g.name,
          members: g.members ?? [],
        }))
        setGroups(parsed)
      }
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    if (open) {
      fetchGroups()
      setEditingGroup(null)
      setAdding(false)
    }
  }, [open, fetchGroups])

  async function handleSave(name: string, members: string[]) {
    setSaving(true)
    try {
      const res = await authFetch(`${baseUrl}/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })
      if (res.ok) {
        toast.success(`Group "${name}" saved`)
        setEditingGroup(null)
        await fetchGroups()
        onSaved?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(name: string, members: string[]) {
    setSaving(true)
    try {
      const res = await authFetch(`${baseUrl}/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })
      if (res.ok) {
        toast.success(`Group "${name}" created`)
        setAdding(false)
        await fetchGroups()
        onSaved?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    setSaving(true)
    try {
      const res = await authFetch(`${baseUrl}/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`Group "${name}" deleted`)
        if (editingGroup === name) setEditingGroup(null)
        await fetchGroups()
        onSaved?.()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Groups</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {groups.length === 0 && !adding && (
              <p className="text-xs text-muted-foreground">No groups defined yet.</p>
            )}

            {groups.map((group) => (
              <div key={group.name} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{group.name}</h4>
                  <div className="flex gap-1">
                    {editingGroup !== group.name && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingGroup(group.name)}
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(group.name)}
                      disabled={saving}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {editingGroup === group.name ? (
                  <GroupMemberEditor
                    initialMembers={group.members}
                    saving={saving}
                    onSave={(members) => handleSave(group.name, members)}
                    onCancel={() => setEditingGroup(null)}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {group.members.length === 0
                      ? "No members"
                      : <div className="flex flex-wrap gap-1.5 mt-1">
                          {group.members.map((m) => {
                            const { provider, email } = parseIdentity(m)
                            return (
                              <span key={m} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                                {provider && <ProviderIcon provider={provider} className="size-3 shrink-0" />}
                                {email}
                              </span>
                            )
                          })}
                        </div>}
                  </div>
                )}
              </div>
            ))}

            {adding ? (
              <NewGroupForm
                saving={saving}
                onCreate={handleCreate}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                New Group
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function GroupMemberEditor({
  initialMembers,
  saving,
  onSave,
  onCancel,
}: {
  initialMembers: string[]
  saving: boolean
  onSave: (members: string[]) => void
  onCancel: () => void
}) {
  const [members, setMembers] = useState(initialMembers)

  return (
    <div className="space-y-2">
      <TagList
        items={members}
        onRemove={(item) => setMembers((prev) => prev.filter((m) => m !== item))}
      />
      <IdentityInput
        onAdd={(identity) => setMembers((prev) => prev.includes(identity) ? prev : [...prev, identity])}
        existingKeys={members}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(members)} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function NewGroupForm({
  saving,
  onCreate,
  onCancel,
}: {
  saving: boolean
  onCreate: (name: string, members: string[]) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [members, setMembers] = useState<string[]>([])

  return (
    <div className="rounded-md border p-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        className={inputClass}
        autoFocus
      />
      <TagList
        items={members}
        onRemove={(item) => setMembers((prev) => prev.filter((m) => m !== item))}
      />
      <IdentityInput
        onAdd={(identity) => setMembers((prev) => prev.includes(identity) ? prev : [...prev, identity])}
        existingKeys={members}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onCreate(name.trim(), members)} disabled={!name.trim() || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Create
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}


