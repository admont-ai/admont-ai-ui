import type { RefObject } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"
import { Check, ClipboardCopy, Loader2, LogIn, LogOut, MonitorSmartphone, PanelLeftClose, PanelLeftOpen, Settings, Shield, ShieldCheck, ShieldOff, Sparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ProviderIcon, formatProviderName } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"
import { LoginDialog } from "@/components/auth/LoginDialog"
import { authFetch } from "@/lib/auth-fetch"
import type { Repo } from "@/types"
import { RepoSelector } from "./RepoSelector"
import { SearchBar } from "./SearchBar"

export function Header({
  sidebarRef,
  repos,
  reposLoading,
  selectedRepo,
  onRepoChange,
  onSearchSelect,
  onAiAssistant,
  onAdmin,
}: {
  sidebarRef: RefObject<PanelImperativeHandle | null>
  repos: Repo[]
  reposLoading: boolean
  selectedRepo: string
  onRepoChange: (value: string) => void
  onSearchSelect: (repo: string, filePath: string) => void
  onAiAssistant?: () => void
  onAdmin?: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [totpDialogOpen, setTotpDialogOpen] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const { user, permissions, logout } = useAuth()

  function toggleSidebar() {
    const panel = sidebarRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
      setCollapsed(false)
    } else {
      panel.collapse()
      setCollapsed(true)
    }
  }

  return (
  <>
    <header className="flex h-14 items-center border-b px-4 gap-2">
      {repos.length > 0 && (
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      )}
      <span className="flex items-center gap-1.5">
        <img src="/admont-ai-icon.png" alt="" width="28" height="28" className="rounded" />
        <span className="text-lg font-bold tracking-tight">Admont-<span className="text-primary">AI</span></span>
      </span>
      {repos.length > 0 && (
        <RepoSelector repos={repos} loading={reposLoading} value={selectedRepo} onValueChange={onRepoChange} />
      )}
      {repos.length > 0 && (
        <SearchBar repos={repos} selectedRepo={selectedRepo} onSelect={onSearchSelect} />
      )}
      <div className="ml-auto flex items-center gap-2">
        {user && onAiAssistant && (
          <Button
            variant="ghost"
            size="icon"
            title="AI Assistant"
            onMouseDown={(e) => {
              e.preventDefault()
              onAiAssistant()
            }}
          >
            <Sparkles className="size-4" />
          </Button>
        )}
        {user ? (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="size-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {initials(user.name)}
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="size-10 rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {initials(user.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.provider && (
                      <div className="flex items-center gap-1 mt-1">
                        <ProviderIcon provider={user.provider} className="size-3 shrink-0" />
                        <span className="text-xs text-muted-foreground">{formatProviderName(user.provider)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {user.provider === "internal" && (
                  <div className="border-t px-4 py-2 space-y-0.5">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      <ProviderIcon provider="internal" className="size-3.5" />
                      Change Password
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      onClick={() => setTotpDialogOpen(true)}
                    >
                      <Shield className="size-3.5" />
                      Two-Factor Authentication
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <McpClientsButton />
            {(permissions.admin || permissions.repo_admin) && onAdmin && (
              <Button variant="ghost" size="icon" onClick={onAdmin} aria-label="Admin settings">
                <Settings className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOut className="size-4" />
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setLoginDialogOpen(true)}>
            <LogIn className="size-4 mr-2" />
            Sign in
          </Button>
        )}
      </div>
    </header>
    {passwordDialogOpen && (
      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    )}
    {totpDialogOpen && (
      <TotpDialog open={totpDialogOpen} onOpenChange={setTotpDialogOpen} />
    )}
    {loginDialogOpen && (
      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
    )}
  </>
  )
}

function initials(name: string | undefined): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0]?.[0] ?? "").toUpperCase()
}

interface McpClient {
  client_id?: string
  name?: string
  connected_at?: string
  last_activity?: string
  tools?: string[]
}

function McpClientsButton() {
  const [clients, setClients] = useState<McpClient[]>([])

  const fetchClients = useCallback(async () => {
    try {
      const res = await authFetch("/me/mcp-clients")
      if (res.ok) {
        const data = await res.json()
        setClients(Array.isArray(data) ? data : [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchClients()
    const interval = setInterval(fetchClients, 10000)
    return () => clearInterval(interval)
  }, [fetchClients])

  if (clients.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="MCP clients" className="relative">
          <MonitorSmartphone className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {clients.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">MCP Clients</p>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y">
          {clients.map((c, i) => (
            <div key={c.client_id ?? i} className="px-3 py-2 space-y-0.5">
              <p className="text-sm font-medium">{c.name || c.client_id || "Unknown"}</p>
              {c.connected_at && (
                <p className="text-xs text-muted-foreground">
                  Connected: {new Date(c.connected_at).toLocaleString()}
                </p>
              )}
              {c.last_activity && (
                <p className="text-xs text-muted-foreground">
                  Last activity: {new Date(c.last_activity).toLocaleString()}
                </p>
              )}
              {c.tools && c.tools.length > 0 && (
                <p className="text-xs text-muted-foreground truncate" title={c.tools.join(", ")}>
                  Tools: {c.tools.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError("")
  }

  async function handleSubmit() {
    setError("")
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }
    setSaving(true)
    try {
      const res = await authFetch("/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      if (res.ok) {
        reset()
        onOpenChange(false)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? data?.error ?? "Failed to change password.")
      }
    } catch {
      setError("Failed to change password.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className={inputClass}
            autoFocus
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Change Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type TotpStep = "loading" | "status" | "setup" | "verify" | "recovery" | "disable"

interface TotpSetupData {
  secret?: string
  qr_code?: string
  provisioning_uri?: string
}

function TotpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState<TotpStep>("loading")
  const [enabled, setEnabled] = useState(false)
  const [setup, setSetup] = useState<TotpSetupData | null>(null)
  const [code, setCode] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const inputClass =
    "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

  useEffect(() => {
    if (!open) return
    setError("")
    setCode("")
    setPassword("")
    setSetup(null)
    setRecoveryCodes([])
    setCopied(false)
    fetchStatus()
  }, [open])

  async function fetchStatus() {
    setStep("loading")
    try {
      const res = await authFetch("/me/totp/status")
      if (res.ok) {
        const data = await res.json()
        setEnabled(!!data.enabled)
        setStep("status")
      } else {
        setError("Failed to fetch 2FA status.")
        setStep("status")
      }
    } catch {
      setError("Failed to fetch 2FA status.")
      setStep("status")
    }
  }

  async function startSetup() {
    setError("")
    setLoading(true)
    try {
      const res = await authFetch("/me/totp/setup", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setSetup(data)
        setCode("")
        setStep("verify")
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? data?.error ?? "Failed to start 2FA setup.")
      }
    } catch {
      setError("Failed to start 2FA setup.")
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setError("")
    if (!code) return
    setLoading(true)
    try {
      const res = await authFetch("/me/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.recovery_codes) {
          setRecoveryCodes(data.recovery_codes)
        }
        setEnabled(true)
        setStep("recovery")
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? data?.error ?? "Invalid code. Please try again.")
      }
    } catch {
      setError("Verification failed.")
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecoveryCodes() {
    setError("")
    setLoading(true)
    try {
      const res = await authFetch("/me/totp/recovery-codes", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setRecoveryCodes(data.recovery_codes ?? data.codes ?? (Array.isArray(data) ? data : []))
        setStep("recovery")
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? data?.error ?? "Failed to get recovery codes.")
      }
    } catch {
      setError("Failed to get recovery codes.")
    } finally {
      setLoading(false)
    }
  }

  async function disableTotp() {
    setError("")
    if (!password) return
    setLoading(true)
    try {
      const res = await authFetch("/me/totp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setEnabled(false)
        setStep("status")
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? data?.error ?? "Failed to disable 2FA.")
      }
    } catch {
      setError("Failed to disable 2FA.")
    } finally {
      setLoading(false)
    }
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function close() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {step === "status" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              {enabled ? (
                <ShieldCheck className="size-5 text-green-600 shrink-0" />
              ) : (
                <ShieldOff className="size-5 text-muted-foreground shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {enabled ? "2FA is enabled" : "2FA is not enabled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? "Your account is protected with TOTP authentication."
                    : "Add an extra layer of security to your account."}
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={close}>Close</Button>
              {enabled ? (
                <>
                  <Button variant="outline" onClick={fetchRecoveryCodes} disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    Recovery Codes
                  </Button>
                  <Button variant="destructive" onClick={() => setStep("disable")} disabled={loading}>
                    Disable 2FA
                  </Button>
                </>
              ) : (
                <Button onClick={startSetup} disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Enable 2FA
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === "verify" && setup && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app, then enter the verification code.
            </p>
            {setup.qr_code && (
              <div className="flex justify-center">
                <img
                  src={setup.qr_code.startsWith("data:") ? setup.qr_code : `data:image/png;base64,${setup.qr_code}`}
                  alt="TOTP QR Code"
                  className="size-48 rounded-lg border p-2"
                />
              </div>
            )}
            {setup.secret && (
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                <code className="text-xs font-mono select-all break-all">{setup.secret}</code>
              </div>
            )}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className={inputClass}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode() }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("status"); setError("") }}>Back</Button>
              <Button onClick={verifyCode} disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Verify & Enable
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "recovery" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="size-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Save these recovery codes in a safe place. Each code can only be used once.
              </p>
            </div>
            {recoveryCodes.length > 0 && (
              <div className="rounded-md bg-muted px-3 py-2">
                <div className="grid grid-cols-2 gap-1">
                  {recoveryCodes.map((c) => (
                    <code key={c} className="text-xs font-mono">{c}</code>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              {recoveryCodes.length > 0 && (
                <Button variant="outline" onClick={copyRecoveryCodes}>
                  {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
                  {copied ? "Copied" : "Copy Codes"}
                </Button>
              )}
              <Button onClick={() => { setStep("status"); setError(""); setRecoveryCodes([]) }}>Done</Button>
            </DialogFooter>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your password to confirm disabling two-factor authentication.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={inputClass}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") disableTotp() }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep("status"); setError(""); setPassword("") }}>Cancel</Button>
              <Button variant="destructive" onClick={disableTotp} disabled={loading || !password}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Disable 2FA
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
