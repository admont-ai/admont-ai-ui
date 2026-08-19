import { Bot, Check, Cloud, DatabaseZap, Eye, EyeOff, FolderOpen, Gauge, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Search, Shield, Trash2, Users, UserPlus, FolderGit2, X as XIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { authFetch } from "@/lib/auth-fetch"
import { ProviderIcon, formatProviderName, LlmProviderIcon, formatLlmProviderName, SearchProviderIcon, formatSearchProviderName } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"
import { inputClass, TagList } from "./UserListSection"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────

interface RepoEntry {
  slug: string
  repo_url: string
  branch: string
  name?: string | null
  doc_path?: string | null
  lfs_enabled?: boolean
  search_provider?: string | null
  authenticated?: boolean
  username?: string | null
  auth_token?: string | null
  public_access?: boolean
  read_only?: boolean
  backend_type?: string
  s3_bucket?: string
  s3_prefix?: string
  s3_region?: string
  s3_access_key?: string
  s3_secret_key?: string
  s3_endpoint?: string
}

type RepoBackendType = "remote_git" | "local_git" | "s3_git" | "s3_store"

const REPO_BACKEND_LABELS: Record<RepoBackendType, string> = {
  remote_git: "Remote Git",
  local_git: "Local Git",
  s3_git: "S3 Git",
  s3_store: "S3 Store",
}

function isS3Backend(type?: string): boolean {
  return type === "s3_git" || type === "s3_store"
}

function RepoTypeIcon({ type, className }: { type?: string; className?: string }) {
  switch (type) {
    case "local_git": return <FolderOpen className={className} />
    case "s3_git":
    case "s3_store": return <Cloud className={className} />
    default: return <FolderGit2 className={className} />
  }
}

type Tab = "internal_users" | "external_users" | "groups" | "repos" | "auth" | "llm" | "llm_usage" | "search"

const ROLES: { value: string; label: string }[] = [
  { value: "system_admin", label: "System Admin" },
  { value: "user_admin", label: "User Admin" },
  { value: "repo_admin", label: "Repo Admin" },
]

// ── Main Admin Panel ────────────────────────────────────

export function AdminPanel({
  onClose,
}: {
  onClose: () => void
}) {
  const { permissions } = useAuth()
  const canManageUsers = permissions.admin
  const [tab, setTab] = useState<Tab>(canManageUsers ? "internal_users" : "repos")

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 border-r flex flex-col gap-1 p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 mb-1" onClick={onClose}>
          <XIcon className="size-4" />
          Close
        </Button>
        {canManageUsers && (
          <>
            <button
              onClick={() => setTab("internal_users")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "internal_users"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Users className="size-4" />
              Internal Users
            </button>
            <button
              onClick={() => setTab("external_users")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "external_users"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <UserPlus className="size-4" />
              External Users
            </button>
            <button
              onClick={() => setTab("groups")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "groups"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Users className="size-4" />
              Groups
            </button>
            <button
              onClick={() => setTab("auth")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "auth"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Shield className="size-4" />
              Auth
            </button>
            <div className="border-t my-1" />
          </>
        )}
        <button
          onClick={() => setTab("repos")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
            tab === "repos"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          <FolderGit2 className="size-4" />
          Repositories
        </button>
        {canManageUsers && (
          <>
            <button
              onClick={() => setTab("search")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "search"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Search className="size-4" />
              Search Providers
            </button>
            <button
              onClick={() => setTab("llm")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "llm"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Bot className="size-4" />
              LLM Providers
            </button>
            <button
              onClick={() => setTab("llm_usage")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors",
                tab === "llm_usage"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Gauge className="size-4" />
              LLM Usage
            </button>
          </>
        )}
      </nav>
      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-editor px-4 py-3">
        {tab === "internal_users" && canManageUsers ? (
          <InternalUsersTab />
        ) : tab === "external_users" && canManageUsers ? (
          <ExternalUsersTab />
        ) : tab === "groups" && canManageUsers ? (
          <GroupsTab />
        ) : tab === "auth" && canManageUsers ? (
          <AuthProvidersTab />
        ) : tab === "llm" && canManageUsers ? (
          <LlmProvidersTab />
        ) : tab === "llm_usage" && canManageUsers ? (
          <LlmUsageTab />
        ) : tab === "search" && canManageUsers ? (
          <SearchProvidersTab />
        ) : (
          <ReposTab />
        )}
      </div>
    </div>
  )
}

// ── Internal Users Tab ──────────────────────────────────

interface InternalUser {
  email: string
  username?: string
  first_name?: string
  last_name?: string
  roles: string[]
  super_admin?: boolean
  totp_enabled?: boolean
  password_expired?: boolean
  suspended?: boolean
  daily_input_token_limit?: number
  daily_output_token_limit?: number
  password_changed_at?: string
  created_at?: string
  updated_at?: string
}

function InternalUsersTab() {
  const [users, setUsers] = useState<InternalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editFirstname, setEditFirstname] = useState("")
  const [editLastname, setEditLastname] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editSuperAdmin, setEditSuperAdmin] = useState(false)
  const [editSuspended, setEditSuspended] = useState(false)
  const [editInputLimit, setEditInputLimit] = useState("")
  const [editOutputLimit, setEditOutputLimit] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [newFirstname, setNewFirstname] = useState("")
  const [newLastname, setNewLastname] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRoles, setNewRoles] = useState<string[]>([])
  const [newSuperAdmin, setNewSuperAdmin] = useState(false)
  const [adding, setAdding] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/admin/users/internal")
      if (res.ok) {
        const data = await res.json()
        setUsers(data ?? [])
      }
    } catch {
      // toasted
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleAddUser() {
    const username = newUsername.trim()
    if (!username || !newFirstname.trim() || !newLastname.trim() || !newPassword) return
    setAdding(true)
    try {
      const res = await authFetch("/admin/users/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, first_name: newFirstname.trim(), last_name: newLastname.trim(), password: newPassword, roles: newRoles, super_admin: newSuperAdmin }),
      })
      if (res.ok) {
        toast.success(`User "${username}" created`)
        setNewUsername("")
        setNewFirstname("")
        setNewLastname("")
        setNewPassword("")
        setNewRoles([])
        setNewSuperAdmin(false)
        setShowAddForm(false)
        await fetchUsers()
      }
    } catch {
      // toasted
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdateUser(originalEmail: string) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      body.first_name = editFirstname.trim()
      body.last_name = editLastname.trim()
      if (editPassword) body.password = editPassword
      body.roles = editRoles
      body.super_admin = editSuperAdmin
      body.suspended = editSuspended
      body.daily_input_token_limit = inputToLimit(editInputLimit)
      body.daily_output_token_limit = inputToLimit(editOutputLimit)
      const res = await authFetch(`/admin/users/internal/${encodeURIComponent(originalEmail)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("User updated")
        setEditingUser(null)
        await fetchUsers()
      }
    } catch {
      // toasted
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteUser(email: string) {
    setDeletingUser(email)
    try {
      const res = await authFetch(`/admin/users/internal/${encodeURIComponent(email)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`User "${email}" deleted`)
        await fetchUsers()
      }
    } catch {
      // toasted
    } finally {
      setDeletingUser(null)
    }
  }

  function startEdit(user: InternalUser) {
    setEditingUser(user.email)
    setEditUsername(user.username ?? user.email)
    setEditFirstname(user.first_name ?? "")
    setEditLastname(user.last_name ?? "")
    setEditPassword("")
    setEditRoles([...user.roles])
    setEditSuperAdmin(!!user.super_admin)
    setEditSuspended(!!user.suspended)
    setEditInputLimit(limitToInput(user.daily_input_token_limit))
    setEditOutputLimit(limitToInput(user.daily_output_token_limit))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!showAddForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="size-4" />
          Add User
        </Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <h4 className="text-sm font-medium">Add Internal User</h4>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newFirstname}
              onChange={(e) => setNewFirstname(e.target.value)}
              placeholder="First Name *"
              className={inputClass}
            />
            <input
              type="text"
              value={newLastname}
              onChange={(e) => setNewLastname(e.target.value)}
              placeholder="Last Name *"
              className={inputClass}
            />
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username *"
              className={inputClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password *"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This is a temporary password — the user must set a new one at their first login.
          </p>
          <RoleCheckboxes roles={newRoles} onChange={setNewRoles} superAdmin={newSuperAdmin} onSuperAdminChange={setNewSuperAdmin} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddUser}
              disabled={!newUsername.trim() || !newFirstname.trim() || !newLastname.trim() || !newPassword || adding}
            >
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add User
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewUsername(""); setNewFirstname(""); setNewLastname(""); setNewPassword(""); setNewRoles([]); setNewSuperAdmin(false) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingUser && (
        <div className="border rounded-md p-4 space-y-3">
          <h4 className="text-sm font-medium">Edit Internal User</h4>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="First Name *">
              <input type="text" value={editFirstname} onChange={(e) => setEditFirstname(e.target.value)} className={inputClass} />
            </LabeledField>
            <LabeledField label="Last Name *">
              <input type="text" value={editLastname} onChange={(e) => setEditLastname(e.target.value)} className={inputClass} />
            </LabeledField>
            <LabeledField label="Username">
              <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className={inputClass} disabled />
            </LabeledField>
            <LabeledField label="New Password">
              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current" className={inputClass} />
            </LabeledField>
          </div>
          {editPassword && (
            <p className="text-xs text-muted-foreground">
              Resetting the password signs the user out and forces them to set a new one at next login.
            </p>
          )}
          <RoleCheckboxes roles={editRoles} onChange={setEditRoles} superAdmin={editSuperAdmin} onSuperAdminChange={setEditSuperAdmin} />
          <DailyLimitFields input={editInputLimit} output={editOutputLimit} onInput={setEditInputLimit} onOutput={setEditOutputLimit} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editSuspended} onChange={(e) => setEditSuspended(e.target.checked)} />
            Suspended (blocks sign-in)
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleUpdateUser(editingUser)} disabled={savingEdit || !editFirstname.trim() || !editLastname.trim()}>
              {savingEdit && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
              <th className="sticky left-0 bg-neutral-100 dark:bg-neutral-800 pl-1.5 pr-0.5 py-1.5 w-[52px]" />
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Username</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">First Name</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Last Name</th>
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Super Admin</th>
              {ROLES.map((r) => (
                <th key={r.value} className="px-3 py-1.5 text-center font-medium text-muted-foreground">{r.label}</th>
              ))}
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">2FA</th>
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Suspended</th>
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">PW Expired</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">PW Changed</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={11 + ROLES.length} className="px-3 py-2 text-muted-foreground">No internal users yet.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.email} className="hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <td className="sticky left-0 bg-editor pl-1.5 pr-0.5 py-1.5">
                    <div className="flex items-center gap-0">
                      <Button variant="ghost" size="icon-xs" onClick={() => startEdit(user)}>
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs" disabled={deletingUser === user.email}>
                            {deletingUser === user.email ? <Loader2 className="size-3 animate-spin" /> : <Trash2 />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete user &quot;{user.username ?? user.email}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove the user account.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => handleDeleteUser(user.email)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">{user.username ?? user.email}</td>
                  <td className="px-3 py-1.5">{user.first_name}</td>
                  <td className="px-3 py-1.5">{user.last_name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <RoleBadge active={!!user.super_admin} />
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.value} className="px-3 py-1.5 text-center"><RoleBadge active={!!user.super_admin || user.roles.includes(r.value)} /></td>
                  ))}
                  <td className="px-3 py-1.5 text-center"><RoleBadge active={!!user.totp_enabled} /></td>
                  <td className="px-3 py-1.5 text-center"><RoleBadge active={!!user.suspended} /></td>
                  <td className="px-3 py-1.5 text-center"><RoleBadge active={!!user.password_expired} /></td>
                  <td className="px-3 py-1.5 text-muted-foreground">{formatTs(user.password_changed_at)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{formatTs(user.created_at)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{formatTs(user.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatTs(ts?: string): string {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// fmtUsage formats "used / limit" with ∞ for an unlimited (0) cap.
function fmtUsage(used: number, limit: number): string {
  return `${used.toLocaleString()} / ${limit === 0 ? "∞" : limit.toLocaleString()}`
}

// Daily token-limit field helpers. "" = inherit the global default; "0" = unlimited.
function limitToInput(n?: number): string {
  return n === undefined || n === null ? "" : String(n)
}
function inputToLimit(s: string): number | null {
  const t = s.trim()
  if (t === "") return null
  const n = Math.floor(Number(t))
  return Number.isFinite(n) && n >= 0 ? n : null
}

// DailyLimitFields renders the per-user daily input/output token cap inputs used
// in both the internal and external user edit forms.
function DailyLimitFields({ input, output, onInput, onOutput }: {
  input: string
  output: string
  onInput: (v: string) => void
  onOutput: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <LabeledField label="Daily input tokens">
          <input type="number" min="0" value={input} onChange={(e) => onInput(e.target.value)} placeholder="inherit default" className={inputClass} />
        </LabeledField>
        <LabeledField label="Daily output tokens">
          <input type="number" min="0" value={output} onChange={(e) => onOutput(e.target.value)} placeholder="inherit default" className={inputClass} />
        </LabeledField>
      </div>
      <p className="text-xs text-muted-foreground">Blank = inherit the global default · 0 = unlimited.</p>
    </div>
  )
}

// ── External Users Tab ──────────────────────────────────

interface ExternalUser {
  provider: string
  email: string
  first_name?: string
  last_name?: string
  roles: string[]
  super_admin?: boolean
  status?: string
  daily_input_token_limit?: number
  daily_output_token_limit?: number
  created_at?: string
  updated_at?: string
}

function ExternalUsersTab() {
  const [authProviders, setAuthProviders] = useState<string[]>([])
  const [users, setUsers] = useState<ExternalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editFirstname, setEditFirstname] = useState("")
  const [editLastname, setEditLastname] = useState("")
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editSuperAdmin, setEditSuperAdmin] = useState(false)
  const [editSuspended, setEditSuspended] = useState(false)
  const [editInputLimit, setEditInputLimit] = useState("")
  const [editOutputLimit, setEditOutputLimit] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [approvingKey, setApprovingKey] = useState<string | null>(null)

  // Add form — provider + email only; profile comes from the IdP on first login.
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProvider, setNewProvider] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)

  const userKey = (u: ExternalUser) => `${u.provider}:${u.email}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, authRes] = await Promise.all([
        authFetch("/admin/users/external"),
        authFetch("/admin/auth"),
      ])
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data ?? [])
      }
      if (authRes.ok) {
        const data: Array<Record<string, unknown>> = await authRes.json()
        setAuthProviders((data ?? []).map((p) => (p.provider ?? p.name) as string).filter(Boolean))
      }
    } catch {
      // toasted
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleAddUser() {
    const provider = newProvider.trim()
    const email = newEmail.trim().toLowerCase()
    if (!provider || !email) return
    setAdding(true)
    try {
      const res = await authFetch("/admin/users/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, email }),
      })
      if (res.ok) {
        toast.success(`External user "${email}" authorized`)
        setNewProvider("")
        setNewEmail("")
        setShowAddForm(false)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setAdding(false)
    }
  }

  async function handleApproveUser(user: ExternalUser) {
    const key = userKey(user)
    setApprovingKey(key)
    try {
      const res = await authFetch(`/admin/users/external/${encodeURIComponent(user.provider)}/${encodeURIComponent(user.email)}/approve`, {
        method: "POST",
      })
      if (res.ok) {
        toast.success(`Approved "${user.email}"`)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setApprovingKey(null)
    }
  }

  async function handleUpdateUser(user: ExternalUser) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      body.first_name = editFirstname.trim()
      body.last_name = editLastname.trim()
      body.roles = editRoles
      body.super_admin = editSuperAdmin
      body.suspended = editSuspended
      body.daily_input_token_limit = inputToLimit(editInputLimit)
      body.daily_output_token_limit = inputToLimit(editOutputLimit)
      const res = await authFetch(`/admin/users/external/${encodeURIComponent(user.provider)}/${encodeURIComponent(user.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("User updated")
        setEditingKey(null)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteUser(user: ExternalUser) {
    const key = userKey(user)
    setDeletingKey(key)
    try {
      const res = await authFetch(`/admin/users/external/${encodeURIComponent(user.provider)}/${encodeURIComponent(user.email)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`User "${user.email}" deleted`)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setDeletingKey(null)
    }
  }

  function startEdit(user: ExternalUser) {
    setEditingKey(userKey(user))
    setEditFirstname(user.first_name ?? "")
    setEditLastname(user.last_name ?? "")
    setEditRoles([...user.roles])
    setEditSuperAdmin(!!user.super_admin)
    setEditSuspended(user.status === "suspended")
    setEditInputLimit(limitToInput(user.daily_input_token_limit))
    setEditOutputLimit(limitToInput(user.daily_output_token_limit))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!showAddForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="size-4" />
          Add User
        </Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <h4 className="text-sm font-medium">Authorize External User</h4>
          <p className="text-xs text-muted-foreground">
            Enter the provider and email. The name is filled from the identity provider on first login; assign roles afterward by editing the user.
          </p>
          <div className="flex gap-2">
            <Select value={newProvider} onValueChange={setNewProvider}>
              <SelectTrigger className="w-48 shrink-0">
                <SelectValue placeholder="Provider *" />
              </SelectTrigger>
              <SelectContent>
                {authProviders.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <ProviderIcon provider={p} className="size-4" />
                      {formatProviderName(p)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email *"
              className={inputClass + " flex-1"}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddUser}
              disabled={!newProvider.trim() || !newEmail.trim() || adding}
            >
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add User
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewProvider(""); setNewEmail("") }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingKey && (() => {
        const user = users.find((u) => userKey(u) === editingKey)
        if (!user) return null
        return (
          <div className="border rounded-md p-4 space-y-3">
            <h4 className="text-sm font-medium">Edit External User</h4>
            <p className="text-sm flex items-center gap-1.5">
              <ProviderIcon provider={user.provider} className="size-3.5 shrink-0" />
              {user.email}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <LabeledField label="First Name">
                <input type="text" value={editFirstname} onChange={(e) => setEditFirstname(e.target.value)} className={inputClass} />
              </LabeledField>
              <LabeledField label="Last Name">
                <input type="text" value={editLastname} onChange={(e) => setEditLastname(e.target.value)} className={inputClass} />
              </LabeledField>
            </div>
            <RoleCheckboxes roles={editRoles} onChange={setEditRoles} superAdmin={editSuperAdmin} onSuperAdminChange={setEditSuperAdmin} />
            <DailyLimitFields input={editInputLimit} output={editOutputLimit} onInput={setEditInputLimit} onOutput={setEditOutputLimit} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editSuspended} onChange={(e) => setEditSuspended(e.target.checked)} />
              Suspended (blocks sign-in)
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleUpdateUser(user)} disabled={savingEdit}>
                {savingEdit && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingKey(null)}>Cancel</Button>
            </div>
          </div>
        )
      })()}

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
              <th className="sticky left-0 bg-neutral-100 dark:bg-neutral-800 pl-1.5 pr-0.5 py-1.5 w-[52px]" />
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Provider</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">First Name</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Last Name</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Super Admin</th>
              {ROLES.map((r) => (
                <th key={r.value} className="px-3 py-1.5 text-center font-medium text-muted-foreground">{r.label}</th>
              ))}
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={9 + ROLES.length} className="px-3 py-2 text-muted-foreground">No external users yet.</td>
              </tr>
            ) : (
              users.map((user) => {
                const key = userKey(user)
                return (
                  <tr key={key} className="hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <td className="sticky left-0 bg-editor pl-1.5 pr-0.5 py-1.5">
                      <div className="flex items-center gap-0">
                        {user.status === "pending" && (
                          <Button variant="ghost" size="icon-xs" title="Approve" disabled={approvingKey === key} onClick={() => handleApproveUser(user)}>
                            {approvingKey === key ? <Loader2 className="size-3 animate-spin" /> : <Check />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-xs" onClick={() => startEdit(user)}>
                          <Pencil />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon-xs" disabled={deletingKey === key}>
                              {deletingKey === key ? <Loader2 className="size-3 animate-spin" /> : <Trash2 />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete external user &quot;{user.email}&quot;?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this external user.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => handleDeleteUser(user)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <ProviderIcon provider={user.provider} className="size-3 shrink-0" />
                        {formatProviderName(user.provider)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{user.email}</td>
                    <td className="px-3 py-1.5">{user.first_name}</td>
                    <td className="px-3 py-1.5">{user.last_name}</td>
                    <td className="px-3 py-1.5">
                      {user.status === "pending" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">pending</span>
                      ) : user.status === "invited" ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">invited</span>
                      ) : user.status === "suspended" ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-400">suspended</span>
                      ) : (
                        <span className="text-muted-foreground">active</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <RoleBadge active={!!user.super_admin} />
                    </td>
                    {ROLES.map((r) => (
                      <td key={r.value} className="px-3 py-1.5 text-center"><RoleBadge active={!!user.super_admin || user.roles.includes(r.value)} /></td>
                    ))}
                    <td className="px-3 py-1.5 text-muted-foreground">{formatTs(user.created_at)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{formatTs(user.updated_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoleCheckboxes({
  roles,
  onChange,
  superAdmin,
  onSuperAdminChange,
}: {
  roles: string[]
  onChange: (roles: string[]) => void
  superAdmin?: boolean
  onSuperAdminChange?: (v: boolean) => void
}) {
  function toggle(role: string) {
    if (roles.includes(role)) {
      onChange(roles.filter((r) => r !== role))
    } else {
      onChange([...roles, role])
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {onSuperAdminChange && (
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={!!superAdmin} onChange={(e) => onSuperAdminChange(e.target.checked)} className="rounded" />
          Super Admin
        </label>
      )}
      {!superAdmin && ROLES.map(({ value, label }) => (
        <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={roles.includes(value)}
            onChange={() => toggle(value)}
            className="rounded"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

function RoleBadge({ active }: { active: boolean }) {
  return active
    ? <Check className="size-4 text-green-600 mx-auto" />
    : <XIcon className="size-4 text-red-400 mx-auto" />
}

// ── Groups Tab ────────────────────────────────────────

interface GroupEntry {
  name: string
  description?: string
  identities: string[]
  roles: string[]
}

interface AllUser {
  identity: string
  provider: string
  email: string
  name: string
}

function UserSelector({
  users,
  selected,
  onAdd,
}: {
  users: AllUser[]
  selected: string[]
  onAdd: (identity: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const available = users.filter(
    (u) => !selected.includes(u.identity) && (
      !query ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.provider.toLowerCase().includes(query.toLowerCase())
    ),
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search users to add…"
          className={inputClass + " pl-8"}
        />
      </div>
      {open && available.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          {available.map((u) => (
            <button
              key={u.identity}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
              onClick={() => { onAdd(u.identity); setQuery(""); setOpen(false) }}
            >
              <ProviderIcon provider={u.provider} className="size-3.5 shrink-0" />
              <span className="truncate">{u.email}</span>
              {u.name && u.name !== u.email && (
                <span className="text-muted-foreground truncate">({u.name})</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && query && available.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
          No matching users
        </div>
      )}
    </div>
  )
}

function GroupsTab() {
  const [groups, setGroups] = useState<GroupEntry[]>([])
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editIdentities, setEditIdentities] = useState<string[]>([])
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newIdentities, setNewIdentities] = useState<string[]>([])
  const [newRoles, setNewRoles] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, internalRes, externalRes] = await Promise.all([
        authFetch("/admin/groups"),
        authFetch("/admin/users/internal"),
        authFetch("/admin/users/external"),
      ])
      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data ?? [])
      }
      const users: AllUser[] = []
      if (internalRes.ok) {
        const data: Array<{ email: string; first_name?: string; last_name?: string }> = await internalRes.json()
        for (const u of data ?? []) {
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ")
          users.push({ identity: `hydra:${u.email}`, provider: "hydra", email: u.email, name })
        }
      }
      if (externalRes.ok) {
        const data: Array<{ provider: string; email: string; first_name?: string; last_name?: string }> = await externalRes.json()
        for (const u of data ?? []) {
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ")
          users.push({ identity: `${u.provider}:${u.email}`, provider: u.provider, email: u.email, name })
        }
      }
      setAllUsers(users)
    } catch {
      // toasted
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function startEdit(group: GroupEntry) {
    setEditingGroup(group.name)
    setEditDescription(group.description ?? "")
    setEditIdentities([...(group.identities ?? [])])
    setEditRoles([...(group.roles ?? [])])
  }

  async function handleAddGroup() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      const body: Record<string, unknown> = { name }
      if (newDescription.trim()) body.description = newDescription.trim()
      if (newIdentities.length > 0) body.identities = newIdentities
      if (newRoles.length > 0) body.roles = newRoles
      const res = await authFetch("/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setNewName("")
        setNewDescription("")
        setNewIdentities([])
        setNewRoles([])
        setShowAddForm(false)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdateGroup(name: string) {
    setSavingEdit(true)
    try {
      const res = await authFetch(`/admin/groups/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescription.trim() || undefined,
          identities: editIdentities,
          roles: editRoles,
        }),
      })
      if (res.ok) {
        setEditingGroup(null)
        await fetchData()
      }
    } catch {
      // toasted
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteGroup(name: string) {
    setDeletingGroup(name)
    try {
      const res = await authFetch(`/admin/groups/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (res.ok) await fetchData()
    } catch {
      // toasted
    } finally {
      setDeletingGroup(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!showAddForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="size-4" />
          Add Group
        </Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <h4 className="text-sm font-medium">Add Group</h4>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group name *" className={inputClass} />
            <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description (optional)" className={inputClass} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Members</span>
            <TagList items={newIdentities} onRemove={(item) => setNewIdentities(newIdentities.filter((i) => i !== item))} />
            <div className="mt-1">
              <UserSelector
                users={allUsers}
                selected={newIdentities}
                onAdd={(id) => { if (!newIdentities.includes(id)) setNewIdentities((prev) => [...prev, id]) }}
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Roles</span>
            <RoleCheckboxes roles={newRoles} onChange={setNewRoles} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddGroup} disabled={!newName.trim() || adding}>
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add Group
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewName(""); setNewDescription(""); setNewIdentities([]); setNewRoles([]) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingGroup && (() => {
        const group = groups.find((g) => g.name === editingGroup)
        if (!group) return null
        return (
          <div className="border rounded-md p-4 space-y-3">
            <h4 className="text-sm font-medium">Edit Group: {group.name}</h4>
            <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)" className={inputClass} />
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Members</span>
              <TagList items={editIdentities} onRemove={(item) => setEditIdentities(editIdentities.filter((i) => i !== item))} />
              <div className="mt-1">
                <UserSelector
                  users={allUsers}
                  selected={editIdentities}
                  onAdd={(id) => { if (!editIdentities.includes(id)) setEditIdentities((prev) => [...prev, id]) }}
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Roles</span>
              <RoleCheckboxes roles={editRoles} onChange={setEditRoles} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleUpdateGroup(group.name)} disabled={savingEdit}>
                {savingEdit && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingGroup(null)}>Cancel</Button>
            </div>
          </div>
        )
      })()}

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
              <th className="sticky left-0 bg-neutral-100 dark:bg-neutral-800 pl-1.5 pr-0.5 py-1.5 w-[52px]" />
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-3 py-1.5 text-center font-medium text-muted-foreground">Members</th>
              {ROLES.map((r) => (
                <th key={r.value} className="px-3 py-1.5 text-center font-medium text-muted-foreground">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={4 + ROLES.length} className="px-3 py-2 text-muted-foreground">No groups yet.</td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.name} className="hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <td className="sticky left-0 bg-editor pl-1.5 pr-0.5 py-1.5">
                    <div className="flex items-center gap-0">
                      <Button variant="ghost" size="icon-xs" onClick={() => startEdit(group)}>
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs" disabled={deletingGroup === group.name}>
                            {deletingGroup === group.name ? <Loader2 className="size-3 animate-spin" /> : <Trash2 />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete group &quot;{group.name}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove the group and its member assignments.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => handleDeleteGroup(group.name)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-medium">{group.name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{group.description}</td>
                  <td className="px-3 py-1.5 text-center">{(group.identities ?? []).length}</td>
                  {ROLES.map((r) => (
                    <td key={r.value} className="px-3 py-1.5 text-center"><RoleBadge active={(group.roles ?? []).includes(r.value)} /></td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Repos Tab ──────────────────────────────────────────

function ReposTab() {
  const [repos, setRepos] = useState<RepoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [recloning, setRecloning] = useState<string | null>(null)
  const [reindexing, setReindexing] = useState<string | null>(null)
  const [searchProviders, setSearchProviders] = useState<string[]>([])
  const [deletingRepo, setDeletingRepo] = useState<string | null>(null)
  const [selectedRepoSlug, setSelectedRepoSlug] = useState<string | null>(null)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newBackendType, setNewBackendType] = useState<RepoBackendType>("remote_git")
  const [newRepoUrl, setNewRepoUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [newBranch, setNewBranch] = useState("")
  const [newDocPath, setNewDocPath] = useState("")

  const [newS3Bucket, setNewS3Bucket] = useState("")
  const [newS3Prefix, setNewS3Prefix] = useState("")
  const [newS3Region, setNewS3Region] = useState("")
  const [newS3AccessKey, setNewS3AccessKey] = useState("")
  const [newS3SecretKey, setNewS3SecretKey] = useState("")
  const [newS3Endpoint, setNewS3Endpoint] = useState("")
  const [newLfs, setNewLfs] = useState(false)
  const [newSearchProvider, setNewSearchProvider] = useState("")
  const [newPublicAccess, setNewPublicAccess] = useState(false)
  const [newReadOnly, setNewReadOnly] = useState(false)
  const [newAuthenticated, setNewAuthenticated] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [newToken, setNewToken] = useState("")
  const [adding, setAdding] = useState(false)

  // Edit form state
  const [editRepoUrl, setEditRepoUrl] = useState("")
  const [editName, setEditName] = useState("")
  const [editBranch, setEditBranch] = useState("")
  const [editDocPath, setEditDocPath] = useState("")
  const [editLfs, setEditLfs] = useState(false)
  const [editSearchProvider, setEditSearchProvider] = useState("")
  const [editAuthenticated, setEditAuthenticated] = useState(false)
  const [editUsername, setEditUsername] = useState("")
  const [editToken, setEditToken] = useState("")
  const [editTokenOriginal, setEditTokenOriginal] = useState("")
  const [editPublicAccess, setEditPublicAccess] = useState(false)
  const [editReadOnly, setEditReadOnly] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const selectedRepo = repos.find((r) => r.slug === selectedRepoSlug) ?? null

  const fetchRepos = useCallback(async () => {
    setLoading(true)
    try {
      const [reposRes, provRes] = await Promise.all([
        authFetch("/admin/repos"),
        authFetch("/admin/search/providers"),
      ])
      if (reposRes.ok) {
        const data = await reposRes.json()
        setRepos(data ?? [])
      }
      if (provRes.ok) {
        const data = await provRes.json()
        const names = (Array.isArray(data) ? data : [])
          .map((p: { name?: string }) => p.name)
          .filter(Boolean) as string[]
        setSearchProviders(names)
      }
    } catch {
      // toasted
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRepos()
  }, [fetchRepos])

  // Populate edit state when selection changes or repo data loads
  const selectedRepoId = selectedRepo?.slug ?? null
  useEffect(() => {
    if (!selectedRepo) return
    setEditRepoUrl(selectedRepo.repo_url)
    setEditName(selectedRepo.name ?? "")
    setEditBranch(selectedRepo.branch ?? "")
    setEditDocPath(selectedRepo.doc_path ?? "")
    setEditLfs(selectedRepo.lfs_enabled ?? false)
    setEditSearchProvider(selectedRepo.search_provider ?? "")
    setEditAuthenticated(selectedRepo.authenticated ?? false)
    setEditUsername(selectedRepo.username ?? "")
    const token = selectedRepo.auth_token ?? ""
    setEditToken(token)
    setEditTokenOriginal(token)
    setEditPublicAccess(selectedRepo.public_access ?? false)
    setEditReadOnly(selectedRepo.read_only ?? false)
  }, [selectedRepoId]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetAddForm() {
    setNewBackendType("remote_git")
    setNewRepoUrl(""); setNewName(""); setNewSlug(""); setNewBranch(""); setNewDocPath("")
    setNewS3Bucket(""); setNewS3Prefix(""); setNewS3Region(""); setNewS3AccessKey(""); setNewS3SecretKey(""); setNewS3Endpoint("")
    setNewLfs(false); setNewSearchProvider(""); setNewPublicAccess(false); setNewReadOnly(false)
    setNewAuthenticated(false); setNewUsername(""); setNewToken("")
  }

  function canAddRepo(): boolean {
    if (!newName.trim()) return false
    if (newBackendType === "remote_git") {
      if (!newRepoUrl.trim()) return false
      if (newAuthenticated && (!newUsername.trim() || !newToken.trim())) return false
    } else if (newBackendType === "local_git") {
      if (!newSlug.trim()) return false
    } else if (isS3Backend(newBackendType)) {
      if (!newS3Bucket.trim()) return false
      if (!newSlug.trim()) return false
    }
    return true
  }

  async function handleAddRepo() {
    if (!canAddRepo()) return
    setAdding(true)
    try {
      const body: Record<string, unknown> = {
        backend_type: newBackendType,
        name: newName.trim(),
        public_access: newPublicAccess,
        read_only: newReadOnly,
      }
      if (newDocPath.trim()) body.doc_path = newDocPath.trim()
      if (newSearchProvider) body.search_provider = newSearchProvider
      if (newBackendType === "remote_git") {
        body.repo_url = newRepoUrl.trim()
        body.lfs_enabled = newLfs
        body.authenticated = newAuthenticated
        if (newBranch.trim()) body.branch = newBranch.trim()
        if (newUsername.trim()) body.username = newUsername.trim()
        if (newToken.trim()) body.auth_token = newToken.trim()
      } else if (newBackendType === "local_git") {
        body.lfs_enabled = newLfs
        if (newBranch.trim()) body.branch = newBranch.trim()
        if (newSlug.trim()) body.slug = newSlug.trim()
      } else if (isS3Backend(newBackendType)) {
        body.slug = newSlug.trim()
        body.s3_bucket = newS3Bucket.trim()
        if (newS3Prefix.trim()) body.s3_prefix = newS3Prefix.trim()
        if (newS3Region.trim()) body.s3_region = newS3Region.trim()
        if (newS3AccessKey.trim()) body.s3_access_key = newS3AccessKey.trim()
        if (newS3SecretKey.trim()) body.s3_secret_key = newS3SecretKey.trim()
        if (newS3Endpoint.trim()) body.s3_endpoint = newS3Endpoint.trim()
      }
      const res = await authFetch("/admin/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        resetAddForm()
        setShowAddForm(false)
        await fetchRepos()
      }
    } catch {
      // toasted
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveSettings(slug: string) {
    setSavingSettings(true)
    try {
      const body: Record<string, unknown> = { lfs_enabled: editLfs, search_provider: editSearchProvider || null, authenticated: editAuthenticated, public_access: editPublicAccess, read_only: editReadOnly }
      if (editRepoUrl.trim()) body.repo_url = editRepoUrl.trim()
      if (editName.trim()) body.name = editName.trim()
      if (editBranch.trim()) body.branch = editBranch.trim()
      if (editDocPath.trim()) body.doc_path = editDocPath.trim()
      if (editUsername.trim()) body.username = editUsername.trim()
      if (editToken !== editTokenOriginal) body.auth_token = editToken.trim()
      const res = await authFetch(`/admin/repos/${encodeURIComponent(slug)}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Settings saved")
        await fetchRepos()
      }
    } catch {
      // toasted
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleDeleteRepo(slug: string) {
    setDeletingRepo(slug)
    try {
      const res = await authFetch(`/admin/repos/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setSelectedRepoSlug(null)
        await fetchRepos()
      }
    } catch {
      // toasted
    } finally {
      setDeletingRepo(null)
    }
  }

  async function handleReclone(slug: string) {
    setRecloning(slug)
    try {
      await authFetch(`/admin/repos/${encodeURIComponent(slug)}/reclone`, {
        method: "POST",
      })
    } catch {
      // toasted
    } finally {
      setRecloning(null)
    }
  }

  async function handleReindex(slug: string) {
    setReindexing(slug)
    try {
      const res = await authFetch(`/admin/repos/${encodeURIComponent(slug)}/reindex`, {
        method: "POST",
      })
      if (res.ok) toast.success("Reindex started")
    } catch {
      // toasted
    } finally {
      setReindexing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add repo */}
      {!showAddForm ? (
        <Button variant="outline" size="sm" onClick={() => { setShowAddForm(true); setSelectedRepoSlug(null) }}>
          <Plus className="size-4" />
          Add Repository
        </Button>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium">Add Repository</h4>
            <Select value={newBackendType} onValueChange={(v) => { setNewBackendType(v as RepoBackendType); resetAddForm(); setNewBackendType(v as RepoBackendType) }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(REPO_BACKEND_LABELS) as [RepoBackendType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    <span className="flex items-center gap-2">
                      <RepoTypeIcon type={val} className="size-4" />
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {newBackendType === "remote_git" && "Clone of a remote Git repo, pushes changes back to the remote on every save."}
            {newBackendType === "local_git" && "Git repo on local disk only, no remote — can be promoted to remote_git later."}
            {newBackendType === "s3_git" && "Local Git repo with S3 as the sync remote — full Git history, S3 as source of truth."}
            {newBackendType === "s3_store" && "Pure S3 object storage, no Git — optional version history via S3 bucket versioning."}
          </p>
          <RepoSettingsForm
            repo={{ slug: "", repo_url: "", branch: "", backend_type: newBackendType }}
            mode="add"
            name={newName}
            setName={setNewName}
            slug={newSlug}
            setSlug={setNewSlug}
            repoUrl={newRepoUrl}
            setRepoUrl={setNewRepoUrl}
            branch={newBranch}
            setBranch={setNewBranch}
            docPath={newDocPath}
            setDocPath={setNewDocPath}
            authenticated={newAuthenticated}
            setAuthenticated={setNewAuthenticated}
            username={newUsername}
            setUsername={setNewUsername}
            token={newToken}
            setToken={setNewToken}
            lfsEnabled={newLfs}
            setLfsEnabled={setNewLfs}
            searchProvider={newSearchProvider}
            setSearchProvider={setNewSearchProvider}
            searchProviders={searchProviders}
            publicAccess={newPublicAccess}
            setPublicAccess={setNewPublicAccess}
            readOnly={newReadOnly}
            setReadOnly={setNewReadOnly}
            s3Bucket={newS3Bucket}
            setS3Bucket={setNewS3Bucket}
            s3Region={newS3Region}
            setS3Region={setNewS3Region}
            s3Prefix={newS3Prefix}
            setS3Prefix={setNewS3Prefix}
            s3Endpoint={newS3Endpoint}
            setS3Endpoint={setNewS3Endpoint}
            s3AccessKey={newS3AccessKey}
            setS3AccessKey={setNewS3AccessKey}
            s3SecretKey={newS3SecretKey}
            setS3SecretKey={setNewS3SecretKey}
            saving={adding}
            onSave={handleAddRepo}
            saveDisabled={!canAddRepo()}
            saveLabel="Add Repository"
            onCancel={() => { setShowAddForm(false); resetAddForm() }}
          />
        </div>
      )}

      {/* Repo list */}
      <div className="border rounded-md divide-y">
        {repos.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No repositories configured.</p>
        ) : (
          repos.map((repo) => (
            <div key={repo.slug} className="px-4 py-3">
              {selectedRepoSlug === repo.slug ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <RepoTypeIcon type={repo.backend_type} className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{repo.name || repo.slug}</span>
                    <span className="text-xs text-muted-foreground">{REPO_BACKEND_LABELS[(repo.backend_type ?? "remote_git") as RepoBackendType] ?? repo.backend_type}</span>
                  </div>
                  <RepoSettingsForm
                    repo={repo}
                    name={editName}
                    setName={setEditName}
                    repoUrl={editRepoUrl}
                    setRepoUrl={setEditRepoUrl}
                    branch={editBranch}
                    setBranch={setEditBranch}
                    docPath={editDocPath}
                    setDocPath={setEditDocPath}
                    authenticated={editAuthenticated}
                    setAuthenticated={setEditAuthenticated}
                    username={editUsername}
                    setUsername={setEditUsername}
                    token={editToken}
                    setToken={setEditToken}
                    lfsEnabled={editLfs}
                    setLfsEnabled={setEditLfs}
                    searchProvider={editSearchProvider}
                    setSearchProvider={setEditSearchProvider}
                    searchProviders={searchProviders}
                    publicAccess={editPublicAccess}
                    setPublicAccess={setEditPublicAccess}
                    readOnly={editReadOnly}
                    setReadOnly={setEditReadOnly}
                    saving={savingSettings}
                    onSave={() => handleSaveSettings(repo.slug)}
                    onCancel={() => setSelectedRepoSlug(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RepoTypeIcon type={repo.backend_type} className="size-5 text-muted-foreground" />
                      <span className="text-sm font-medium">{repo.name || repo.slug}</span>
                      <span className="text-xs text-muted-foreground">{REPO_BACKEND_LABELS[(repo.backend_type ?? "remote_git") as RepoBackendType] ?? repo.backend_type}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {isS3Backend(repo.backend_type) ? (
                        <>
                          <p>Bucket: {repo.s3_bucket}{repo.s3_prefix ? ` / ${repo.s3_prefix}` : ""}</p>
                          {repo.s3_region && <p>Region: {repo.s3_region}</p>}
                          {repo.s3_endpoint && <p>Endpoint: {repo.s3_endpoint}</p>}
                        </>
                      ) : repo.backend_type === "local_git" ? (
                        <>
                          {repo.branch && <p>Branch: {repo.branch}</p>}
                        </>
                      ) : (
                        <>
                          <p>URL: {repo.repo_url}</p>
                          {repo.branch && <p>Branch: {repo.branch}</p>}
                        </>
                      )}
                      {repo.doc_path && <p>Doc path: {repo.doc_path}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", repo.public_access ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300")}>{repo.public_access ? "Public" : "Private"}</span>
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", repo.read_only ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300")}>{repo.read_only ? "Read Only" : "Read/Write"}</span>
                        {repo.authenticated && <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">Authenticated</span>}
                        {repo.lfs_enabled && <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">LFS</span>}
                        {repo.search_provider && <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Search: {repo.search_provider}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    {!isS3Backend(repo.backend_type) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" title="Reclone" disabled={recloning === repo.slug}>
                          <RefreshCw className={cn("size-4", recloning === repo.slug && "animate-spin")} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reclone {repo.slug}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the local copy and clone the repository again. Any unpublished drafts may be lost.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleReclone(repo.slug)}>Reclone</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                    {repo.search_provider && (
                      <Button variant="ghost" size="icon-sm" title="Reindex" disabled={reindexing === repo.slug} onClick={() => handleReindex(repo.slug)}>
                        <DatabaseZap className={cn("size-4", reindexing === repo.slug && "animate-pulse")} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setSelectedRepoSlug(repo.slug)}>
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" title="Delete" disabled={deletingRepo === repo.slug}>
                          {deletingRepo === repo.slug ? <Loader2 className="size-4 animate-spin" /> : <Trash2 />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {repo.slug}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the repository from the server. The remote git repository will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => handleDeleteRepo(repo.slug)}>Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Repo Settings Form ──────────────────────────────────

interface RepoSettingsFormProps {
  repo: RepoEntry
  mode?: "add" | "edit"
  name: string
  setName: (v: string) => void
  slug?: string
  setSlug?: (v: string) => void
  repoUrl: string
  setRepoUrl: (v: string) => void
  branch: string
  setBranch: (v: string) => void
  docPath: string
  setDocPath: (v: string) => void
  authenticated: boolean
  setAuthenticated: (v: boolean) => void
  username: string
  setUsername: (v: string) => void
  token: string
  setToken: (v: string) => void
  lfsEnabled: boolean
  setLfsEnabled: (v: boolean) => void
  searchProvider: string
  setSearchProvider: (v: string) => void
  searchProviders: string[]
  publicAccess: boolean
  setPublicAccess: (v: boolean) => void
  readOnly: boolean
  setReadOnly: (v: boolean) => void
  s3Bucket?: string
  setS3Bucket?: (v: string) => void
  s3Region?: string
  setS3Region?: (v: string) => void
  s3Prefix?: string
  setS3Prefix?: (v: string) => void
  s3Endpoint?: string
  setS3Endpoint?: (v: string) => void
  s3AccessKey?: string
  setS3AccessKey?: (v: string) => void
  s3SecretKey?: string
  setS3SecretKey?: (v: string) => void
  saving: boolean
  onSave: () => void
  saveDisabled?: boolean
  saveLabel?: string
  onCancel: () => void
}

function RepoSettingsForm({
  repo,
  mode = "edit",
  name,
  setName,
  slug,
  setSlug,
  repoUrl,
  setRepoUrl,
  branch,
  setBranch,
  docPath,
  setDocPath,
  authenticated,
  setAuthenticated,
  username,
  setUsername,
  token,
  setToken,
  lfsEnabled,
  setLfsEnabled,
  searchProvider,
  setSearchProvider,
  searchProviders,
  publicAccess,
  setPublicAccess,
  readOnly,
  setReadOnly,
  s3Bucket,
  setS3Bucket,
  s3Region,
  setS3Region,
  s3Prefix,
  setS3Prefix,
  s3Endpoint,
  setS3Endpoint,
  s3AccessKey,
  setS3AccessKey,
  s3SecretKey,
  setS3SecretKey,
  saving,
  onSave,
  saveDisabled,
  saveLabel,
  onCancel,
}: RepoSettingsFormProps) {
  const bt = repo.backend_type ?? "remote_git"
  const isGit = !isS3Backend(bt)
  const isRemote = isGit && bt !== "local_git"
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <LabeledField label={mode === "add" ? "Name *" : "Name"}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </LabeledField>
        {mode === "add" && !isRemote && setSlug && (
          <LabeledField label="Slug *">
            <input type="text" value={slug ?? ""} onChange={(e) => setSlug(e.target.value)} placeholder="unique-identifier" className={inputClass} />
          </LabeledField>
        )}
      </div>
      {isRemote && (
        <>
          {mode === "add" && (
            <p className="text-xs text-muted-foreground">
              It is highly recommended to add authentication for public repositories to avoid rate limits.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <LabeledField label={mode === "add" ? "Git Repository URL *" : "Repository URL"}>
              <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className={inputClass} />
            </LabeledField>
            <LabeledField label="Branch">
              <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={mode === "add" ? "optional" : ""} className={inputClass} />
            </LabeledField>
            <LabeledField label="Doc Path">
              <input type="text" value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder={mode === "add" ? "optional" : ""} className={inputClass} />
            </LabeledField>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={lfsEnabled} onChange={(e) => setLfsEnabled(e.target.checked)} className="rounded" />
              Git LFS Enabled
            </label>
          </div>
        </>
      )}
      {bt === "local_git" && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LabeledField label="Branch">
            <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={mode === "add" ? "optional" : ""} className={inputClass} />
          </LabeledField>
          <LabeledField label="Doc Path">
            <input type="text" value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder={mode === "add" ? "optional" : ""} className={inputClass} />
          </LabeledField>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={lfsEnabled} onChange={(e) => setLfsEnabled(e.target.checked)} className="rounded" />
            Git LFS Enabled
          </label>
        </div>
      )}
      {isS3Backend(bt) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LabeledField label={mode === "add" ? "S3 Bucket *" : "S3 Bucket"}>
            <input type="text" value={mode === "add" ? (s3Bucket ?? "") : (repo.s3_bucket ?? "")} onChange={setS3Bucket ? (e) => setS3Bucket(e.target.value) : undefined} disabled={mode === "edit"} className={inputClass + (mode === "edit" ? " opacity-60" : "")} />
          </LabeledField>
          <LabeledField label="S3 Region">
            <input type="text" value={mode === "add" ? (s3Region ?? "") : (repo.s3_region ?? "")} onChange={setS3Region ? (e) => setS3Region(e.target.value) : undefined} disabled={mode === "edit"} placeholder={mode === "add" ? "us-east-1" : ""} className={inputClass + (mode === "edit" ? " opacity-60" : "")} />
          </LabeledField>
          {(mode === "add" || repo.s3_prefix) && (
            <LabeledField label="S3 Prefix">
              <input type="text" value={mode === "add" ? (s3Prefix ?? "") : (repo.s3_prefix ?? "")} onChange={setS3Prefix ? (e) => setS3Prefix(e.target.value) : undefined} disabled={mode === "edit"} placeholder={mode === "add" ? "optional key prefix" : ""} className={inputClass + (mode === "edit" ? " opacity-60" : "")} />
            </LabeledField>
          )}
          {(mode === "add" || repo.s3_endpoint) && (
            <LabeledField label="S3 Endpoint">
              <input type="text" value={mode === "add" ? (s3Endpoint ?? "") : (repo.s3_endpoint ?? "")} onChange={setS3Endpoint ? (e) => setS3Endpoint(e.target.value) : undefined} disabled={mode === "edit"} placeholder={mode === "add" ? "For S3-compatible (MinIO)" : ""} className={inputClass + (mode === "edit" ? " opacity-60" : "")} />
            </LabeledField>
          )}
          {mode === "add" && (
            <>
              <LabeledField label="Access Key">
                <input type="text" value={s3AccessKey ?? ""} onChange={setS3AccessKey ? (e) => setS3AccessKey(e.target.value) : undefined} placeholder="Falls back to AWS credential chain" className={inputClass} />
              </LabeledField>
              <LabeledField label="Secret Key">
                <input type="password" value={s3SecretKey ?? ""} onChange={setS3SecretKey ? (e) => setS3SecretKey(e.target.value) : undefined} placeholder="Falls back to AWS credential chain" className={inputClass} />
              </LabeledField>
            </>
          )}
          <LabeledField label="Doc Path">
            <input type="text" value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder={mode === "add" ? "optional" : ""} className={inputClass} />
          </LabeledField>
        </div>
      )}
      {(isRemote || authenticated) && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={authenticated}
              onClick={() => setAuthenticated(!authenticated)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                authenticated ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
              )}
            >
              <span className={cn(
                "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                authenticated ? "translate-x-4" : "translate-x-0",
              )} />
            </button>
            <span className="text-sm">Authenticated</span>
          </div>
          {authenticated && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <LabeledField label="Username *">
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
              </LabeledField>
              <LabeledField label="Auth Token *">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} />
              </LabeledField>
            </div>
          )}
        </>
      )}
      <fieldset className="border rounded-md p-3 space-y-2">
        <legend className="text-xs font-medium px-1">Default Permissions</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={publicAccess} onChange={(e) => setPublicAccess(e.target.checked)} className="rounded" />
            Public Access
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} className="rounded" />
            Read Only
          </label>
        </div>
      </fieldset>
      {searchProviders.length > 0 && (
        <LabeledField label="Search Provider">
        <Select value={searchProvider || "none"} onValueChange={(v) => setSearchProvider(v === "none" ? "" : v)}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Search Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {searchProviders.map((name) => (
              <SelectItem key={name} value={name}>
                <span className="flex items-center gap-2">
                  <SearchProviderIcon provider={name} className="size-4" />
                  {formatSearchProviderName(name)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </LabeledField>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving || saveDisabled || (authenticated && (!username.trim() || !token.trim()))}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saveLabel ?? "Save"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

// ── Auth Providers Tab ──────────────────────────────────

interface AuthProviderEntry {
  provider: string
  client_id: string
  client_secret?: string
  base_url?: string
  issuer_url?: string
  scopes?: string
  tenant_id?: string
  domain?: string
  source?: string
}

interface ProviderExtraField {
  key: string
  label: string
  required: boolean
  placeholder?: string
}

const PROVIDER_CONFIG: Record<string, { extraFields?: ProviderExtraField[]; defaultScopes: string }> = {
  google:          { defaultScopes: "openid, email, profile" },
  github:          { defaultScopes: "user:email, read:user" },
  microsoftonline: { extraFields: [{ key: "tenant_id", label: "Tenant ID", required: false, placeholder: "common" }], defaultScopes: "openid, profile, email" },
  azureadv2:       { extraFields: [{ key: "tenant_id", label: "Tenant ID", required: false, placeholder: "common" }], defaultScopes: "openid, profile, email" },
  gitlab:          { defaultScopes: "read_user, openid, email" },
  okta:            { extraFields: [{ key: "issuer_url", label: "Issuer URL", required: true, placeholder: "https://your-org.okta.com" }], defaultScopes: "openid, profile, email" },
  auth0:           { extraFields: [{ key: "domain", label: "Domain", required: true, placeholder: "your-tenant.auth0.com" }], defaultScopes: "openid, profile, email" },
  openidConnect:   { extraFields: [{ key: "issuer_url", label: "Issuer URL", required: true, placeholder: "https://issuer.example.com" }], defaultScopes: "openid, profile, email" },
  facebook:        { defaultScopes: "email" },
  discord:         { defaultScopes: "identify, email" },
  apple:           { defaultScopes: "name, email" },
  slack:           { defaultScopes: "users:read, users:read.email" },
  bitbucket:       { defaultScopes: "account, email" },
  linkedin:        { defaultScopes: "r_liteprofile, r_emailaddress" },
  cognito:         { extraFields: [{ key: "domain", label: "Domain", required: true, placeholder: "your-pool.auth.region.amazoncognito.com" }], defaultScopes: "openid, profile, email" },
  hydra:           { extraFields: [{ key: "issuer_url", label: "Issuer URL", required: true, placeholder: "https://hydra.example.com" }], defaultScopes: "openid, profile, email" },
}

function getProviderConfig(provider: string) {
  return PROVIDER_CONFIG[provider] ?? { defaultScopes: "openid, profile, email" }
}

function AuthProvidersTab() {
  const [providers, setProviders] = useState<AuthProviderEntry[]>([])
  const [supported, setSupported] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit form state
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [editOriginalSecret, setEditOriginalSecret] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // Add form state
  const [newProvider, setNewProvider] = useState("")
  const [newFields, setNewFields] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showNewSecret, setShowNewSecret] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [provRes, supRes] = await Promise.all([
        authFetch("/admin/auth"),
        authFetch("/admin/auth/supported"),
      ])
      if (provRes.ok) {
        const data = await provRes.json()
        console.log("[admin/auth]", data)
        const list: AuthProviderEntry[] = (Array.isArray(data) ? data : []).map(
          (p: Record<string, unknown>) => ({ ...p, provider: p.provider ?? p.name } as AuthProviderEntry),
        )
        setProviders(list)
      }
      if (supRes.ok) {
        const data = await supRes.json()
        console.log("[auth/supported]", data)
        setSupported(Array.isArray(data) ? data : [])
      } else {
        console.log("[auth/supported] error", supRes.status, await supRes.text())
      }
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function setNewField(key: string, value: string) {
    setNewFields((prev) => ({ ...prev, [key]: value }))
  }

  function setEditField(key: string, value: string) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(p: AuthProviderEntry) {
    setEditingProvider(p.provider)
    const secret = p.client_secret ?? ""
    setEditOriginalSecret(secret)
    setEditFields({
      client_id: p.client_id ?? "",
      client_secret: secret,
      base_url: p.base_url ?? "",
      issuer_url: p.issuer_url ?? "",
      scopes: p.scopes ?? "",
      tenant_id: p.tenant_id ?? "",
      domain: p.domain ?? "",
    })
  }

  async function handleUpdate(provider: string) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editFields)) {
        if (k === "client_secret") {
          if (v !== editOriginalSecret && v.trim()) body[k] = v.trim()
        } else if (v.trim()) {
          body[k] = v.trim()
        }
      }
      const res = await authFetch(`/admin/auth/${encodeURIComponent(provider)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`Provider "${formatProviderName(provider)}" updated`)
        setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(provider: string) {
    setDeletingProvider(provider)
    try {
      const res = await authFetch(`/admin/auth/${encodeURIComponent(provider)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`Provider "${formatProviderName(provider)}" deleted`)
        if (editingProvider === provider) setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setDeletingProvider(null)
    }
  }

  async function handleAdd() {
    const cfg = getProviderConfig(newProvider)
    const extraRequired = cfg.extraFields?.filter((f) => f.required) ?? []
    const missingExtra = extraRequired.some((f) => !newFields[f.key]?.trim())
    if (!newProvider || !newFields.client_id?.trim() || !newFields.client_secret?.trim() || missingExtra) return
    setAdding(true)
    try {
      const body: Record<string, unknown> = { name: newProvider }
      for (const [k, v] of Object.entries(newFields)) {
        if (v.trim()) body[k] = v.trim()
      }
      const res = await authFetch("/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`Provider "${formatProviderName(newProvider)}" added`)
        setNewProvider("")
        setNewFields({})
        setShowAddForm(false)
        setShowNewSecret(false)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setAdding(false)
    }
  }

  const configuredProviderNames = new Set(providers.map((p) => p.provider))
  const availableForAdd = supported.filter((s) => !configuredProviderNames.has(s))

  const newCfg = newProvider ? getProviderConfig(newProvider) : null
  const newExtraRequired = newCfg?.extraFields?.filter((f) => f.required) ?? []
  const canAdd = !!newProvider
    && !!newFields.client_id?.trim()
    && !!newFields.client_secret?.trim()
    && !newExtraRequired.some((f) => !newFields[f.key]?.trim())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add provider */}
      {!showAddForm ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="size-4" />
            Add Provider
          </Button>
          {supported.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No supported provider types found. Check the backend configuration.
            </p>
          )}
        </>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <h4 className="text-sm font-medium">Add Auth Provider</h4>
          {availableForAdd.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {supported.length === 0
                  ? "No supported provider types available from the backend."
                  : "All supported provider types are already configured."}
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Close
              </Button>
            </>
          ) : (
          <>
          <LabeledField label="Provider *">
            <Select value={newProvider} onValueChange={(v) => { setNewProvider(v); setNewFields({}) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider type" />
              </SelectTrigger>
              <SelectContent>
                {availableForAdd.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <ProviderIcon provider={s} className="size-4" />
                      {formatProviderName(s)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledField>
          {newProvider && (
            <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <LabeledField label="Client ID *">
                <input type="text" value={newFields.client_id ?? ""} onChange={(e) => setNewField("client_id", e.target.value)} className={inputClass} />
              </LabeledField>
              <LabeledField label="Client Secret *">
                <div className="relative">
                  <input
                    type={showNewSecret ? "text" : "password"}
                    value={newFields.client_secret ?? ""}
                    onChange={(e) => setNewField("client_secret", e.target.value)}
                    className={inputClass + " pr-9"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewSecret(!showNewSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </LabeledField>
              {newCfg?.extraFields?.map((f) => (
                <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                  <input
                    type="text"
                    value={newFields[f.key] ?? ""}
                    onChange={(e) => setNewField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                </LabeledField>
              ))}
              <LabeledField label="Scopes">
                <input type="text" value={newFields.scopes ?? ""} onChange={(e) => setNewField("scopes", e.target.value)} placeholder={newCfg?.defaultScopes} className={inputClass} />
              </LabeledField>
            </div>
            {newCfg?.defaultScopes && (
              <p className="text-xs text-muted-foreground">
                Default scopes: {newCfg.defaultScopes}
              </p>
            )}
            </>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd || adding}
            >
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add Provider
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setShowNewSecret(false); setNewProvider(""); setNewFields({}) }}>
              Cancel
            </Button>
          </div>
          </>
          )}
        </div>
      )}

      {/* Provider list */}
      <div className="border rounded-md divide-y">
        {providers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No auth providers configured.</p>
        ) : (
          providers.map((p) => {
            const cfg = getProviderConfig(p.provider)
            return (
            <div key={p.provider} className="px-4 py-3">
              {editingProvider === p.provider ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ProviderIcon provider={p.provider} className="size-5" />
                    <span className="text-sm font-medium">{formatProviderName(p.provider)}</span>
                    {p.source && <span className="text-xs text-muted-foreground">({p.source})</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <LabeledField label="Client ID">
                      <input type="text" value={editFields.client_id ?? ""} onChange={(e) => setEditField("client_id", e.target.value)} className={inputClass} />
                    </LabeledField>
                    <LabeledField label="Client Secret">
                      <input
                        type="text"
                        value={editFields.client_secret ?? ""}
                        onChange={(e) => setEditField("client_secret", e.target.value)}
                        className={inputClass}
                      />
                    </LabeledField>
                    {cfg.extraFields?.map((f) => (
                      <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                        <input
                          type="text"
                          value={editFields[f.key] ?? ""}
                          onChange={(e) => setEditField(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className={inputClass}
                        />
                      </LabeledField>
                    ))}
                    <LabeledField label="Scopes">
                      <input type="text" value={editFields.scopes ?? ""} onChange={(e) => setEditField("scopes", e.target.value)} placeholder={cfg.defaultScopes} className={inputClass} />
                    </LabeledField>
                    <LabeledField label="Base URL">
                      <input type="text" value={editFields.base_url ?? ""} onChange={(e) => setEditField("base_url", e.target.value)} placeholder="Override (optional)" className={inputClass} />
                    </LabeledField>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(p.provider)} disabled={savingEdit}>
                      {savingEdit && <Loader2 className="size-4 animate-spin" />}
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingProvider(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ProviderIcon provider={p.provider} className="size-5" />
                      <span className="text-sm font-medium">{formatProviderName(p.provider)}</span>
                      {p.source && <span className="text-xs text-muted-foreground">({p.source})</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <p>Client ID: {p.client_id}</p>
                      {p.tenant_id && <p>Tenant ID: {p.tenant_id}</p>}
                      {p.domain && <p>Domain: {p.domain}</p>}
                      {p.issuer_url && <p>Issuer: {p.issuer_url}</p>}
                      {p.base_url && <p>Base URL: {p.base_url}</p>}
                      {p.scopes ? <p>Scopes: {p.scopes}</p> : <p>Scopes: {cfg.defaultScopes} (default)</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)}>
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deletingProvider === p.provider}
                        >
                          {deletingProvider === p.provider ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete provider &quot;{formatProviderName(p.provider)}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Users authenticating via this provider will no longer be able to log in.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDelete(p.provider)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── LLM Providers Tab ──────────────────────────────────

interface LlmProviderEntry {
  name: string
  provider_type: string
  api_key?: string
  base_url?: string
  region?: string
  model?: string
  default_model?: string
  favourite_models?: string[]
  max_tokens?: number
  source?: string
  [key: string]: unknown
}

interface LlmTokenLimits {
  ask: number
  generate: number
  summarize: number
  edit: number
  agent: number
}

interface LlmProviderUsage {
  provider: string
  input_used: number
  output_used: number
}

interface LlmUsageRow {
  identity: string
  email?: string
  input_used: number
  output_used: number
  input_limit: number
  output_limit: number
  providers?: LlmProviderUsage[]
}

interface LlmModelEntry {
  id: string
  name: string
}

interface LlmProviderSupported {
  name: string
  fields?: { key: string; label: string; required: boolean; placeholder?: string }[]
  models?: (string | { id: string; name: string })[]
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••••••"
  return secret.slice(0, 4) + "••••" + secret.slice(-4)
}

const SELF_HOSTED_LLM = new Set(["ollama", "vllm", "localai", "lmstudio", "textgenwebui", "llamacpp"])

function isSelfHostedLlm(name: string) {
  return SELF_HOSTED_LLM.has(name.toLowerCase().replace(/[\s_-]/g, ""))
}

// Bedrock authenticates via the standard AWS credential chain (IAM role, env
// vars, shared config, etc.) — it never uses an API key, but it does need a region.
function isBedrockLlm(name: string) {
  return name.toLowerCase() === "bedrock"
}

function LlmProvidersTab() {
  const [providers, setProviders] = useState<LlmProviderEntry[]>([])
  const [supported, setSupported] = useState<LlmProviderSupported[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit form state
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [editOriginalKey, setEditOriginalKey] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [editFavourites, setEditFavourites] = useState<string[]>([])
  const [editModels, setEditModels] = useState<LlmModelEntry[]>([])
  const [editModelsLoading, setEditModelsLoading] = useState(false)

  // Add form state
  const [newProvider, setNewProvider] = useState("")
  const [newName, setNewName] = useState("")
  const [newFields, setNewFields] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showNewKey, setShowNewKey] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [provRes, supRes] = await Promise.all([
        authFetch("/admin/llm"),
        authFetch("/admin/llm/supported"),
      ])
      if (provRes.ok) {
        const data = await provRes.json()
        console.log("[admin/llm]", data)
        setProviders(Array.isArray(data) ? data : [])
      }
      if (supRes.ok) {
        const data = await supRes.json()
        console.log("[llm/supported]", data)
        if (Array.isArray(data)) {
          setSupported(
            data.map((d: string | LlmProviderSupported) =>
              typeof d === "string" ? { name: d } : d
            ),
          )
        }
      }
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getSupportedFields(name: string) {
    return supported.find((s) => s.name === name)?.fields ?? []
  }

  function getSupportedModels(name: string): LlmModelEntry[] {
    const raw = supported.find((s) => s.name === name)?.models ?? []
    return raw.map((m) => (typeof m === "string" ? { id: m, name: m } : m))
  }

  function setNewField(key: string, value: string) {
    setNewFields((prev) => ({ ...prev, [key]: value }))
  }

  function setEditField(key: string, value: string) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(p: LlmProviderEntry) {
    setEditingProvider(p.name)
    const apiKey = (p.api_key as string) ?? ""
    setEditOriginalKey(apiKey)
    const fields: Record<string, string> = {
      api_key: apiKey,
      base_url: (p.base_url as string) ?? "",
      region: (p.region as string) ?? "",
      model: p.default_model ?? (p.model as string) ?? "",
      max_tokens: p.max_tokens ? String(p.max_tokens) : "",
    }
    for (const f of getSupportedFields(p.provider_type)) {
      if (!(f.key in fields)) {
        fields[f.key] = (p[f.key] as string) ?? ""
      }
    }
    setEditFields(fields)
    setEditFavourites(p.favourite_models ?? [])

    // Load the provider's live model list for the favourites picker.
    setEditModels([])
    setEditModelsLoading(true)
    authFetch(`/admin/llm/${encodeURIComponent(p.name)}/models`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LlmModelEntry[]) => setEditModels(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setEditModelsLoading(false))
  }

  function toggleFavourite(id: string) {
    setEditFavourites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    )
  }

  async function handleUpdate(name: string) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editFields)) {
        if (k === "api_key") {
          if (v !== editOriginalKey && v.trim()) body[k] = v.trim()
        } else if (k === "max_tokens") {
          if (v.trim()) body[k] = Number(v) || 0
        } else if (v.trim()) {
          body[k === "model" ? "default_model" : k] = v.trim()
        }
      }
      // Always send favourites so an empty selection clears them.
      body.favourite_models = editFavourites
      const res = await authFetch(`/admin/llm/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`LLM provider "${formatLlmProviderName(name)}" updated`)
        setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(name: string) {
    setDeletingProvider(name)
    try {
      const res = await authFetch(`/admin/llm/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`LLM provider "${formatLlmProviderName(name)}" deleted`)
        if (editingProvider === name) setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setDeletingProvider(null)
    }
  }

  async function handleAdd() {
    if (!newProvider || !newName.trim()) return
    if (isBedrockLlm(newProvider) ? !newFields.region?.trim() : !newFields.api_key?.trim()) return
    const extra = getSupportedFields(newProvider)
    const missingRequired = extra.filter((f) => f.required).some((f) => !newFields[f.key]?.trim())
    if (missingRequired) return
    setAdding(true)
    try {
      const body: Record<string, unknown> = { name: newName.trim(), provider_type: newProvider }
      for (const [k, v] of Object.entries(newFields)) {
        if (!v.trim()) continue
        if (k === "max_tokens") {
          body[k] = Number(v) || 0
        } else {
          body[k === "model" ? "default_model" : k] = v.trim()
        }
      }
      const res = await authFetch("/admin/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`LLM provider "${newName.trim()}" added`)
        setNewProvider("")
        setNewName("")
        setNewFields({})
        setShowAddForm(false)
        setShowNewKey(false)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setAdding(false)
    }
  }

  const newExtra = newProvider ? getSupportedFields(newProvider) : []
  const canAdd = !!newProvider
    && !!newName.trim()
    && (isBedrockLlm(newProvider) ? !!newFields.region?.trim() : !!newFields.api_key?.trim())
    && !newExtra.filter((f) => f.required).some((f) => !newFields[f.key]?.trim())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add provider */}
      {!showAddForm ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="size-4" />
            Add LLM Provider
          </Button>
          {supported.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No supported LLM provider types found. Check the backend configuration.
            </p>
          )}
        </>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium">Add LLM Provider</h4>
            {supported.length > 0 && (
              <Select value={newProvider} onValueChange={(v) => { setNewProvider(v); setNewFields({}) }}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent>
                  {supported.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      <span className="flex items-center gap-2">
                        <LlmProviderIcon provider={s.name} className="size-4" />
                        {formatLlmProviderName(s.name)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {supported.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                No supported LLM provider types available from the backend.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Close
              </Button>
            </>
          ) : (
          <>
          {newProvider && (
            <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <LabeledField label="Name *">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. my-anthropic" className={inputClass} />
              </LabeledField>
              {isBedrockLlm(newProvider) ? (
                <LabeledField label="Region *">
                  <input
                    type="text"
                    value={newFields.region ?? ""}
                    onChange={(e) => setNewField("region", e.target.value)}
                    placeholder="us-east-1"
                    className={inputClass}
                  />
                </LabeledField>
              ) : (
                <LabeledField label="API Key *">
                  <div className="relative">
                    <input
                      type={showNewKey ? "text" : "password"}
                      value={newFields.api_key ?? ""}
                      onChange={(e) => setNewField("api_key", e.target.value)}
                      className={inputClass + " pr-9"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKey(!showNewKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </LabeledField>
              )}
              {isSelfHostedLlm(newProvider) && (
                <LabeledField label="Base URL *">
                  <input type="text" value={newFields.base_url ?? ""} onChange={(e) => setNewField("base_url", e.target.value)} placeholder="http://localhost:11434" className={inputClass} />
                </LabeledField>
              )}
              <LabeledField label="Model">
                {getSupportedModels(newProvider).length > 0 ? (
                  <Select value={newFields.model ?? ""} onValueChange={(v) => setNewField("model", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSupportedModels(newProvider).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input type="text" value={newFields.model ?? ""} onChange={(e) => setNewField("model", e.target.value)} placeholder="Default model (optional)" className={inputClass} />
                )}
              </LabeledField>
              <LabeledField label="Max Tokens (cost ceiling)">
                <input type="number" min="1" value={newFields.max_tokens ?? ""} onChange={(e) => setNewField("max_tokens", e.target.value)} placeholder="16384" className={inputClass} />
              </LabeledField>
              {newExtra.map((f) => (
                <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                  <input
                    type="text"
                    value={newFields[f.key] ?? ""}
                    onChange={(e) => setNewField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                </LabeledField>
              ))}
            </div>
            </>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd || adding}
            >
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add Provider
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setShowNewKey(false); setNewProvider(""); setNewName(""); setNewFields({}) }}>
              Cancel
            </Button>
          </div>
          </>
          )}
        </div>
      )}

      {/* Provider list */}
      <div className="border rounded-md divide-y">
        {providers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No LLM providers configured.</p>
        ) : (
          providers.map((p) => {
            const pt = p.provider_type ?? p.name
            const extra = getSupportedFields(pt)
            return (
            <div key={p.name} className="px-4 py-3">
              {editingProvider === p.name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <LlmProviderIcon provider={pt} className="size-5" />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{formatLlmProviderName(pt)}</span>
                    {p.source && <span className="text-xs text-muted-foreground">({p.source})</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {isBedrockLlm(pt) ? (
                      <LabeledField label="Region *">
                        <input
                          type="text"
                          value={editFields.region ?? ""}
                          onChange={(e) => setEditField("region", e.target.value)}
                          placeholder="us-east-1"
                          className={inputClass}
                        />
                      </LabeledField>
                    ) : (
                      <LabeledField label="API Key">
                        <input
                          type="text"
                          value={editFields.api_key ?? ""}
                          onChange={(e) => setEditField("api_key", e.target.value)}
                          className={inputClass}
                        />
                      </LabeledField>
                    )}
                    {isSelfHostedLlm(pt) && (
                      <LabeledField label="Base URL *">
                        <input type="text" value={editFields.base_url ?? ""} onChange={(e) => setEditField("base_url", e.target.value)} placeholder="http://localhost:11434" className={inputClass} />
                      </LabeledField>
                    )}
                    <LabeledField label="Default Model">
                      {editModels.length > 0 ? (
                        <Select value={editFields.model ?? ""} onValueChange={(v) => setEditField("model", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {editModels.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input type="text" value={editFields.model ?? ""} onChange={(e) => setEditField("model", e.target.value)} placeholder="Default model (optional)" className={inputClass} />
                      )}
                    </LabeledField>
                    <LabeledField label="Max Tokens (cost ceiling)">
                      <input type="number" min="1" value={editFields.max_tokens ?? ""} onChange={(e) => setEditField("max_tokens", e.target.value)} placeholder="16384" className={inputClass} />
                    </LabeledField>
                    {extra.map((f) => (
                      <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                        <input
                          type="text"
                          value={editFields[f.key] ?? ""}
                          onChange={(e) => setEditField(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className={inputClass}
                        />
                      </LabeledField>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">
                      Favourite models
                      {editFavourites.length > 0 && (
                        <span className="text-muted-foreground font-normal"> — {editFavourites.length} selected</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Users only see favourites in the model selector. With no selection, all current models are shown.
                    </p>
                    {editModelsLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Loading models…
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                        {/* Keep stale favourites visible so they can be unchecked. */}
                        {[...editModels, ...editFavourites
                          .filter((id) => !editModels.some((m) => m.id === id))
                          .map((id) => ({ id, name: id }))]
                          .map((m) => (
                            <label key={m.id} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editFavourites.includes(m.id)}
                                onChange={() => toggleFavourite(m.id)}
                              />
                              <span className="truncate" title={m.id}>{m.name}</span>
                            </label>
                          ))}
                        {editModels.length === 0 && editFavourites.length === 0 && (
                          <p className="col-span-2 text-xs text-muted-foreground py-1">
                            No models reported by the provider yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(p.name)} disabled={savingEdit}>
                      {savingEdit && <Loader2 className="size-4 animate-spin" />}
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingProvider(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LlmProviderIcon provider={pt} className="size-5" />
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{formatLlmProviderName(pt)}</span>
                      {p.source && <span className="text-xs text-muted-foreground">({p.source})</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {p.api_key && <p>API Key: {maskSecret(p.api_key)}</p>}
                      {p.base_url && <p>Base URL: {p.base_url}</p>}
                      {p.region && <p>Region: {p.region}</p>}
                      {(p.default_model || p.model) && <p>Default Model: {p.default_model || p.model}</p>}
                      {!!p.max_tokens && <p>Max Tokens: {p.max_tokens}</p>}
                      {extra.map((f) => p[f.key] ? <p key={f.key}>{f.label}: {String(p[f.key])}</p> : null)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)}>
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deletingProvider === p.name}
                        >
                          {deletingProvider === p.name ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete LLM provider &quot;{formatLlmProviderName(p.name)}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            LLM features using this provider will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDelete(p.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── LLM Usage Tab ──────────────────────────────────

function LlmUsageTab() {
  const [loading, setLoading] = useState(true)

  // Per-action output limits ("" = provider ceiling).
  const [tokenLimits, setTokenLimits] = useState<Record<string, string>>({ ask: "", generate: "", summarize: "", edit: "", agent: "" })
  const [savingLimits, setSavingLimits] = useState(false)

  // Per-user daily token quota: global default + live usage.
  const [defaultLimits, setDefaultLimits] = useState<{ input: string; output: string }>({ input: "", output: "" })
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [usage, setUsage] = useState<LlmUsageRow[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [resetting, setResetting] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true)
    try {
      const res = await authFetch("/admin/llm/usage")
      if (res.ok) {
        const data: LlmUsageRow[] = await res.json()
        setUsage(Array.isArray(data) ? data : [])
      }
    } catch {
      // handled by authFetch
    } finally {
      setUsageLoading(false)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [limitsRes, defRes, usageRes] = await Promise.all([
        authFetch("/admin/llm/token-limits"),
        authFetch("/admin/llm/usage-limits"),
        authFetch("/admin/llm/usage"),
      ])
      if (limitsRes.ok) {
        const data: LlmTokenLimits = await limitsRes.json()
        setTokenLimits({
          ask: data.ask ? String(data.ask) : "",
          generate: data.generate ? String(data.generate) : "",
          summarize: data.summarize ? String(data.summarize) : "",
          edit: data.edit ? String(data.edit) : "",
          agent: data.agent ? String(data.agent) : "",
        })
      }
      if (defRes.ok) {
        const data: { input?: number; output?: number } = await defRes.json()
        setDefaultLimits({ input: data.input ? String(data.input) : "", output: data.output ? String(data.output) : "" })
      }
      if (usageRes.ok) {
        const data: LlmUsageRow[] = await usageRes.json()
        setUsage(Array.isArray(data) ? data : [])
      }
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSaveLimits() {
    setSavingLimits(true)
    try {
      const body = {
        ask: Number(tokenLimits.ask) || 0,
        generate: Number(tokenLimits.generate) || 0,
        summarize: Number(tokenLimits.summarize) || 0,
        edit: Number(tokenLimits.edit) || 0,
        agent: Number(tokenLimits.agent) || 0,
      }
      const res = await authFetch("/admin/llm/token-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) toast.success("Token limits saved")
    } catch {
      // handled by authFetch
    } finally {
      setSavingLimits(false)
    }
  }

  async function handleSaveDefaults() {
    setSavingDefaults(true)
    try {
      const body = { input: Number(defaultLimits.input) || 0, output: Number(defaultLimits.output) || 0 }
      const res = await authFetch("/admin/llm/usage-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) toast.success("Default daily limits saved")
    } catch {
      // handled by authFetch
    } finally {
      setSavingDefaults(false)
    }
  }

  async function handleResetUsage(identity: string) {
    setResetting(identity)
    try {
      const res = await authFetch("/admin/llm/usage/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      })
      if (res.ok) {
        toast.success("Usage reset")
        await fetchUsage()
      }
    } catch {
      // handled by authFetch
    } finally {
      setResetting(null)
    }
  }

  async function handleResetAllUsage() {
    setResetting("*")
    try {
      const res = await authFetch("/admin/llm/usage/reset-all", { method: "POST" })
      if (res.ok) {
        toast.success("All usage reset")
        await fetchUsage()
      }
    } catch {
      // handled by authFetch
    } finally {
      setResetting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Token limits */}
      <div className="border rounded-md p-4 space-y-3">
        <h4 className="text-sm font-medium">Token Limits</h4>
        <p className="text-xs text-muted-foreground">
          Output token limits per request type. Each request is additionally capped by the provider&apos;s max tokens. Empty = provider ceiling.
        </p>
        <div className="grid grid-cols-5 gap-2">
          <LabeledField label="Ask / Chat">
            <input type="number" min="0" value={tokenLimits.ask} onChange={(e) => setTokenLimits((p) => ({ ...p, ask: e.target.value }))} placeholder="provider ceiling" className={inputClass} />
          </LabeledField>
          <LabeledField label="Generate documents">
            <input type="number" min="0" value={tokenLimits.generate} onChange={(e) => setTokenLimits((p) => ({ ...p, generate: e.target.value }))} placeholder="provider ceiling" className={inputClass} />
          </LabeledField>
          <LabeledField label="Summarize">
            <input type="number" min="0" value={tokenLimits.summarize} onChange={(e) => setTokenLimits((p) => ({ ...p, summarize: e.target.value }))} placeholder="provider ceiling" className={inputClass} />
          </LabeledField>
          <LabeledField label="Edit actions">
            <input type="number" min="0" value={tokenLimits.edit} onChange={(e) => setTokenLimits((p) => ({ ...p, edit: e.target.value }))} placeholder="provider ceiling" className={inputClass} />
          </LabeledField>
          <LabeledField label="Agent">
            <input type="number" min="0" value={tokenLimits.agent} onChange={(e) => setTokenLimits((p) => ({ ...p, agent: e.target.value }))} placeholder="provider ceiling" className={inputClass} />
          </LabeledField>
        </div>
        <Button size="sm" onClick={handleSaveLimits} disabled={savingLimits}>
          {savingLimits && <Loader2 className="size-4 animate-spin" />}
          Save Limits
        </Button>
      </div>

      {/* Per-user daily token quota */}
      <div className="border rounded-md p-4 space-y-3">
        <h4 className="text-sm font-medium">Per-User Daily Token Quota</h4>
        <p className="text-xs text-muted-foreground">
          Default daily caps applied to every user (override per user in the Internal/External Users tabs). 0 = unlimited.
          Usage is tracked in memory and resets at 00:00 UTC.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <LabeledField label="Default daily input tokens">
            <input type="number" min="0" value={defaultLimits.input} onChange={(e) => setDefaultLimits((p) => ({ ...p, input: e.target.value }))} placeholder="unlimited" className={inputClass} />
          </LabeledField>
          <LabeledField label="Default daily output tokens">
            <input type="number" min="0" value={defaultLimits.output} onChange={(e) => setDefaultLimits((p) => ({ ...p, output: e.target.value }))} placeholder="unlimited" className={inputClass} />
          </LabeledField>
        </div>
        <Button size="sm" onClick={handleSaveDefaults} disabled={savingDefaults}>
          {savingDefaults && <Loader2 className="size-4 animate-spin" />}
          Save Defaults
        </Button>

        <div className="flex items-center justify-between pt-2">
          <h5 className="text-sm font-medium">Current Usage</h5>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsage} disabled={usageLoading}>
              {usageLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={resetting === "*" || usage.length === 0}>
                  {resetting === "*" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Reset All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all token usage?</AlertDialogTitle>
                  <AlertDialogDescription>This clears the current daily usage for every user.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetAllUsage}>Reset All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">User</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Input used / limit</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Output used / limit</th>
                <th className="px-3 py-1.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {usage.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-2 text-muted-foreground">No usage recorded yet.</td></tr>
              ) : (
                usage.map((row) => (
                  <tr key={row.identity} className="hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <td className="px-3 py-1.5 align-top">
                      <div>{row.email || row.identity}</div>
                      {row.providers && row.providers.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.providers.map((p) => (
                            <span key={p.provider} className="mr-2 inline-block tabular-nums">
                              {p.provider} {p.input_used.toLocaleString()}↑ {p.output_used.toLocaleString()}↓
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right align-top tabular-nums">{fmtUsage(row.input_used, row.input_limit)}</td>
                    <td className="px-3 py-1.5 text-right align-top tabular-nums">{fmtUsage(row.output_used, row.output_limit)}</td>
                    <td className="px-3 py-1.5 text-right align-top">
                      <Button variant="ghost" size="icon-xs" onClick={() => handleResetUsage(row.identity)} disabled={resetting === row.identity} title="Reset this user">
                        {resetting === row.identity ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Search Providers Tab ──────────────────────────────────

/** Convert snake_case/kebab-case keys like "api_key" → "API Key", "base_url" → "Base URL" */
function formatFieldLabel(key: string): string {
  const ACRONYMS = new Set(["api", "url", "id", "ip", "ssl", "tls", "http", "https", "uri"])
  return key
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((w) => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface SearchProviderEntry {
  name: string
  provider_type: string
  active?: boolean
  source?: string
  config?: Record<string, unknown>
}

interface SearchProviderSupported {
  name: string
  fields?: Record<string, unknown>[]
}

function SearchProvidersTab() {
  const [providers, setProviders] = useState<SearchProviderEntry[]>([])
  const [supported, setSupported] = useState<SearchProviderSupported[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit form state
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Add form state
  const [newProviderType, setNewProviderType] = useState("")
  const [newName, setNewName] = useState("")
  const [newFields, setNewFields] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showNewKey, setShowNewKey] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [provRes, supRes] = await Promise.all([
        authFetch("/admin/search/providers"),
        authFetch("/admin/search/supported"),
      ])
      if (provRes.ok) {
        const data = await provRes.json()
        setProviders(Array.isArray(data) ? data : [])
      }
      if (supRes.ok) {
        const data = await supRes.json()
        if (Array.isArray(data)) {
          setSupported(
            data.map((d: string | Record<string, unknown>) =>
              typeof d === "string"
                ? { name: d }
                : { ...d, name: (d.name ?? d.type ?? d.id ?? "") as string } as SearchProviderSupported
            ).filter((d) => !!d.name),
          )
        }
      }
    } catch {
      // handled by authFetch
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getSupportedFields(providerType: string) {
    const raw = supported.find((s) => s.name === providerType)?.fields ?? []
    return raw.map((f: Record<string, unknown>) => {
      const key = ((f.key ?? f.field ?? f.id ?? f.name ?? "") as string)
      const rawLabel = ((f.label ?? f.title) as string | undefined)
      const label = rawLabel || formatFieldLabel(key)
      return { key, label, required: !!(f.required), placeholder: (f.placeholder as string | undefined) }
    }).filter((f) => !!f.key)
  }

  // Fallback config fields for known provider types when backend provides none
  const KNOWN_CONFIG_FIELDS: Record<string, { key: string; label: string; required: boolean; placeholder?: string }[]> = {
    pgvector: [
      { key: "host", label: "Host", required: false, placeholder: "localhost" },
      { key: "port", label: "Port", required: false, placeholder: "5432" },
      { key: "database", label: "Database", required: false, placeholder: "admont_search" },
      { key: "username", label: "Username", required: false, placeholder: undefined },
      { key: "password", label: "Password", required: false, placeholder: undefined },
    ],
    elasticsearch: [
      { key: "url", label: "URL", required: true, placeholder: "https://elastic.example.com:9200" },
      { key: "api_key", label: "API Key", required: false, placeholder: undefined },
      { key: "index_prefix", label: "Index Prefix", required: false, placeholder: "admont" },
      { key: "embedding_model_id", label: "Embedding Model ID", required: false, placeholder: ".elser_model_2" },
    ],
    typesense: [
      { key: "url", label: "URL", required: true, placeholder: "http://typesense.example.com:8108" },
      { key: "api_key", label: "API Key", required: true, placeholder: undefined },
    ],
    meilisearch: [
      { key: "url", label: "URL", required: true, placeholder: "http://localhost:7700" },
      { key: "api_key", label: "API Key", required: false, placeholder: undefined },
    ],
  }

  function getConfigFields(providerType: string) {
    const fields = getSupportedFields(providerType)
    const result = fields.length > 0 ? fields : (KNOWN_CONFIG_FIELDS[providerType.toLowerCase()] ?? [])
    // ssl_enabled and external_db are rendered as dedicated switches for pgvector
    if (providerType.toLowerCase() === "pgvector") return result.filter((f) => f.key !== "ssl_enabled" && f.key !== "external_db")
    return result
  }

  function setNewField(key: string, value: string) {
    setNewFields((prev) => ({ ...prev, [key]: value }))
  }

  function setEditField(key: string, value: string) {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(p: SearchProviderEntry) {
    setEditingProvider(p.name)
    const cfg = p.config ?? {}
    const fields: Record<string, string> = {}
    for (const f of getConfigFields(p.provider_type)) {
      fields[f.key] = (cfg[f.key] as string) ?? ""
    }
    // Restore pgvector switch fields
    if (p.provider_type.toLowerCase() === "pgvector") {
      fields.external_db = (cfg.external_db as string) === "true" ? "true" : "false"
      fields.ssl_enabled = (cfg.ssl_enabled as string) === "true" ? "true" : "false"
    }
    setEditFields(fields)
  }

  async function handleUpdate(name: string) {
    setSavingEdit(true)
    try {
      const config: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editFields)) {
        if (k === "ssl_enabled" || k === "external_db") { config[k] = v; continue }
        if (v.trim()) config[k] = v.trim()
      }
      const res = await authFetch(`/admin/search/providers/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      })
      if (res.ok) {
        toast.success(`Search provider "${name}" updated`)
        setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(name: string) {
    setDeletingProvider(name)
    try {
      const res = await authFetch(`/admin/search/providers/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success(`Search provider "${name}" deleted`)
        if (editingProvider === name) setEditingProvider(null)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setDeletingProvider(null)
    }
  }

  const PG_DB_FIELDS = ["host", "database", "username", "password"]

  async function handleAdd() {
    if (!newProviderType || !newName.trim()) return
    const fields = getConfigFields(newProviderType)
    const missingRequired = fields.filter((f) => f.required).some((f) => !newFields[f.key]?.trim())
    if (missingRequired) return
    // When external_db is enabled, DB fields are required
    if (newProviderType.toLowerCase() === "pgvector" && newFields.external_db === "true") {
      if (PG_DB_FIELDS.some((k) => !newFields[k]?.trim())) return
    }
    setAdding(true)
    try {
      const config: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(newFields)) {
        if (k === "ssl_enabled" || k === "external_db") { config[k] = v; continue }
        if (v.trim()) config[k] = v.trim()
      }
      const res = await authFetch("/admin/search/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), provider_type: newProviderType, config }),
      })
      if (res.ok) {
        toast.success(`Search provider "${newName.trim()}" added`)
        setNewProviderType("")
        setNewName("")
        setNewFields({})
        setShowAddForm(false)
        setShowNewKey(false)
        await fetchData()
      }
    } catch {
      // handled by authFetch
    } finally {
      setAdding(false)
    }
  }

  const newConfigFields = newProviderType ? getConfigFields(newProviderType) : []
  const newPgExternalDb = newProviderType?.toLowerCase() === "pgvector" && newFields.external_db === "true"
  const canAdd = !!newProviderType && !!newName.trim()
    && !newConfigFields.filter((f) => f.required).some((f) => !newFields[f.key]?.trim())
    && !(newPgExternalDb && PG_DB_FIELDS.some((k) => !newFields[k]?.trim()))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Add provider */}
      {!showAddForm ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="size-4" />
            Add Search Provider
          </Button>
          {supported.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No supported search provider types found. Check the backend configuration.
            </p>
          )}
        </>
      ) : (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium">Add Search Provider</h4>
            <Select value={newProviderType} onValueChange={(v) => { setNewProviderType(v); setNewFields({}) }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {supported.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    <span className="flex items-center gap-2">
                      <SearchProviderIcon provider={s.name} className="size-4" />
                      {formatSearchProviderName(s.name)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {supported.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                No supported search provider types available from the backend.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Close
              </Button>
            </>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <LabeledField label="Name *">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-search-provider" className={inputClass} />
            </LabeledField>
          </div>
          {newProviderType && newConfigFields.length > 0 && (
            newProviderType.toLowerCase() === "pgvector" ? (
              <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newFields.external_db === "true"}
                  onClick={() => setNewField("external_db", newFields.external_db === "true" ? "false" : "true")}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                    newFields.external_db === "true" ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
                  )}
                >
                  <span className={cn(
                    "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    newFields.external_db === "true" ? "translate-x-4" : "translate-x-0",
                  )} />
                </button>
                <span className="text-xs font-medium">External Database</span>
              </div>
              {newFields.external_db === "true" && (
              <fieldset className="border rounded-md p-3">
                <legend className="text-xs font-medium px-1">PgVector Database</legend>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <LabeledField label="Host *">
                    <input type="text" value={newFields.host ?? ""} onChange={(e) => setNewField("host", e.target.value)} placeholder="localhost" className={inputClass} />
                  </LabeledField>
                  <LabeledField label="Port">
                    <input type="text" value={newFields.port ?? ""} onChange={(e) => setNewField("port", e.target.value)} placeholder="5432" className={inputClass} />
                  </LabeledField>
                  <LabeledField label="Database *">
                    <input type="text" value={newFields.database ?? ""} onChange={(e) => setNewField("database", e.target.value)} placeholder="admont_search" className={inputClass} />
                  </LabeledField>
                  <div className="flex items-center gap-2 pt-5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newFields.ssl_enabled === "true"}
                      onClick={() => setNewField("ssl_enabled", newFields.ssl_enabled === "true" ? "false" : "true")}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                        newFields.ssl_enabled === "true" ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                        newFields.ssl_enabled === "true" ? "translate-x-4" : "translate-x-0",
                      )} />
                    </button>
                    <span className="text-xs font-medium text-muted-foreground">SSL</span>
                  </div>
                  <LabeledField label="Username *">
                    <input type="text" value={newFields.username ?? ""} onChange={(e) => setNewField("username", e.target.value)} className={inputClass} />
                  </LabeledField>
                  <LabeledField label="Password *">
                    <input type="password" value={newFields.password ?? ""} onChange={(e) => setNewField("password", e.target.value)} className={inputClass} />
                  </LabeledField>
                </div>
              </fieldset>
              )}
              </>
            ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {newConfigFields.map((f) =>
                f.key === "api_key" ? (
                  <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                    <div className="relative">
                      <input
                        type={showNewKey ? "text" : "password"}
                        value={newFields.api_key ?? ""}
                        onChange={(e) => setNewField("api_key", e.target.value)}
                        className={inputClass + " pr-9"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewKey(!showNewKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </LabeledField>
                ) : (
                  <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                    <input
                      type="text"
                      value={newFields[f.key] ?? ""}
                      onChange={(e) => setNewField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={inputClass}
                    />
                  </LabeledField>
                )
              )}
            </div>
            )
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd || adding}
            >
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add Provider
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setShowNewKey(false); setNewProviderType(""); setNewName(""); setNewFields({}) }}>
              Cancel
            </Button>
          </div>
          </>
          )}
        </div>
      )}

      {/* Provider list */}
      <div className="border rounded-md divide-y">
        {providers.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No search providers configured.</p>
        ) : (
          providers.map((p) => (
            <div key={p.name} className="px-4 py-3">
              {editingProvider === p.name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <SearchProviderIcon provider={p.provider_type} className="size-5" />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSearchProviderName(p.provider_type)}</span>
                  </div>
                  {getConfigFields(p.provider_type).length > 0 && (
                    p.provider_type.toLowerCase() === "pgvector" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={editFields.external_db === "true"}
                            onClick={() => setEditField("external_db", editFields.external_db === "true" ? "false" : "true")}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                              editFields.external_db === "true" ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
                            )}
                          >
                            <span className={cn(
                              "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                              editFields.external_db === "true" ? "translate-x-4" : "translate-x-0",
                            )} />
                          </button>
                          <span className="text-xs font-medium">External Database</span>
                        </div>
                        {editFields.external_db === "true" && (
                        <fieldset className="border rounded-md p-3">
                          <legend className="text-xs font-medium px-1">PgVector Database</legend>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <LabeledField label="Host *">
                              <input type="text" value={editFields.host ?? ""} onChange={(e) => setEditField("host", e.target.value)} placeholder="localhost" className={inputClass} />
                            </LabeledField>
                            <LabeledField label="Port">
                              <input type="text" value={editFields.port ?? ""} onChange={(e) => setEditField("port", e.target.value)} placeholder="5432" className={inputClass} />
                            </LabeledField>
                            <LabeledField label="Database *">
                              <input type="text" value={editFields.database ?? ""} onChange={(e) => setEditField("database", e.target.value)} placeholder="admont_search" className={inputClass} />
                            </LabeledField>
                            <div className="flex items-center gap-2 pt-5">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={editFields.ssl_enabled === "true"}
                                onClick={() => setEditField("ssl_enabled", editFields.ssl_enabled === "true" ? "false" : "true")}
                                className={cn(
                                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                                  editFields.ssl_enabled === "true" ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
                                )}
                              >
                                <span className={cn(
                                  "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                  editFields.ssl_enabled === "true" ? "translate-x-4" : "translate-x-0",
                                )} />
                              </button>
                              <span className="text-xs font-medium text-muted-foreground">SSL</span>
                            </div>
                            <LabeledField label="Username *">
                              <input type="text" value={editFields.username ?? ""} onChange={(e) => setEditField("username", e.target.value)} className={inputClass} />
                            </LabeledField>
                            <LabeledField label="Password *">
                              <input type="password" value={editFields.password ?? ""} onChange={(e) => setEditField("password", e.target.value)} className={inputClass} />
                            </LabeledField>
                          </div>
                        </fieldset>
                        )}
                      </div>
                    ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {getConfigFields(p.provider_type).map((f) => (
                      <LabeledField key={f.key} label={f.label + (f.required ? " *" : "")}>
                        <input
                          type="text"
                          value={editFields[f.key] ?? ""}
                          onChange={(e) => setEditField(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className={inputClass}
                        />
                      </LabeledField>
                    ))}
                  </div>
                    )
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(p.name)} disabled={savingEdit}>
                      {savingEdit && <Loader2 className="size-4 animate-spin" />}
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingProvider(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SearchProviderIcon provider={p.provider_type} className="size-5" />
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{formatSearchProviderName(p.provider_type)}</span>
                    </div>
                    {p.config && Object.keys(p.config).length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {getConfigFields(p.provider_type).map((f) => {
                        const val = p.config?.[f.key]
                        if (!val) return null
                        if (f.key === "api_key" || f.key === "password") return <p key={f.key}>{f.label}: {maskSecret(String(val))}</p>
                        return <p key={f.key}>{f.label}: {String(val)}</p>
                      })}
                      {p.provider_type.toLowerCase() === "pgvector" && p.config?.external_db === "true" && (
                        <>
                          <p>External Database: Yes</p>
                          <p>SSL: {p.config?.ssl_enabled === "true" ? "Enabled" : "Disabled"}</p>
                        </>
                      )}
                    </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)}>
                      <Pencil />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={deletingProvider === p.name}
                        >
                          {deletingProvider === p.name ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete search provider &quot;{p.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This search provider configuration will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDelete(p.name)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
