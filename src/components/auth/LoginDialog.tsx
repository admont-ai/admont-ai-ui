import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

type Mode = "login" | "totp" | "signup"

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { providers, signupOpen, login, loginInternal, verifyTotp, signup } = useAuth()
  const [mode, setMode] = useState<Mode>(signupOpen ? "signup" : "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [code, setCode] = useState("")
  const [pendingToken, setPendingToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function close() {
    setPassword("")
    setCode("")
    setError("")
    onOpenChange(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      if (mode === "signup") {
        await signup(email, password, firstName, lastName)
        close()
      } else if (mode === "totp") {
        await verifyTotp(pendingToken, code.trim())
        close()
      } else {
        const res = await loginInternal(email, password)
        if (res.totpRequired) {
          setPendingToken(res.pendingToken ?? "")
          setCode("")
          setMode("totp")
        } else {
          close()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const title = mode === "signup" ? "Create admin account" : mode === "totp" ? "Two-factor authentication" : "Sign in"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <p className="text-muted-foreground text-sm">
              No users exist yet. Create the first administrator account.
            </p>
          )}

          {mode === "totp" ? (
            <input
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Authenticator or recovery code"
              className={inputClass}
              autoFocus
            />
          ) : (
            <>
              {mode === "signup" && (
                <div className="flex gap-2">
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inputClass} autoFocus />
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={inputClass} />
                </div>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
                autoFocus={mode === "login"}
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={inputClass}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
            {mode === "signup" ? "Create account" : mode === "totp" ? "Verify" : "Sign in"}
          </Button>
        </form>

        {mode === "login" && signupOpen && (
          <button type="button" className="text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("signup") }}>
            First time? Create the admin account
          </button>
        )}
        {mode === "signup" && !busy && (
          <button type="button" className="text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("login") }}>
            Back to sign in
          </button>
        )}

        {mode === "login" && providers.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-muted-foreground text-center text-xs">or continue with</p>
            {providers.map((p) => (
              <Button key={p.name} variant="outline" className="w-full gap-2" onClick={() => login(p.name)}>
                <ProviderIcon provider={p.name} className="size-4" />
                {p.display_name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
