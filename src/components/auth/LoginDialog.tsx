import { useEffect, useState } from "react"
import { Loader2, KeyRound } from "lucide-react"
import { browserSupportsWebAuthn } from "@simplewebauthn/browser"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { OtpInput } from "@/components/auth/OtpInput"
import { useAuth } from "@/contexts/auth-context"
import { describePasswordPolicy, getPasswordPolicy } from "@/lib/password-policy"

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

type Mode = "login" | "totp" | "reset" | "signup"

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { providers, signupOpen, login, loginInternal, loginPasskey, verifyTotp, resetPassword, signup } = useAuth()
  const [mode, setMode] = useState<Mode>(signupOpen ? "signup" : "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [code, setCode] = useState("")
  const [pendingToken, setPendingToken] = useState("")
  const [totpRecovery, setTotpRecovery] = useState(false)
  const [otpKey, setOtpKey] = useState(0)
  const [resetToken, setResetToken] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [policyHint, setPolicyHint] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    void getPasswordPolicy().then((p) => { if (p) setPolicyHint(describePasswordPolicy(p)) })
  }, [])

  function close() {
    setPassword("")
    setCode("")
    setError("")
    onOpenChange(false)
  }

  async function handleTotp(value: string) {
    const codeVal = value.trim()
    if (!codeVal || busy) return
    setError("")
    setBusy(true)
    try {
      const res = await verifyTotp(pendingToken, codeVal)
      if (res.passwordResetRequired) {
        setResetToken(res.resetToken ?? "")
        setPassword("")
        setConfirmPassword("")
        setMode("reset")
      } else {
        close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setCode("")
      setOtpKey((k) => k + 1)
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === "totp") {
      await handleTotp(code)
      return
    }
    setError("")
    setBusy(true)
    try {
      if (mode === "signup") {
        await signup(email, password, firstName, lastName)
        close()
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.")
          return
        }
        await resetPassword(resetToken, password)
        close()
      } else {
        const res = await loginInternal(email, password)
        if (res.totpRequired) {
          setPendingToken(res.pendingToken ?? "")
          setCode("")
          setTotpRecovery(false)
          setOtpKey((k) => k + 1)
          setMode("totp")
        } else if (res.passwordResetRequired) {
          setResetToken(res.resetToken ?? "")
          setPassword("")
          setConfirmPassword("")
          setMode("reset")
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

  async function passkeySignIn() {
    setError("")
    setBusy(true)
    try {
      await loginPasskey()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  const title = mode === "signup" ? "Create admin account" : mode === "totp" ? "Two-factor authentication" : mode === "reset" ? "Set a new password" : "Sign in"

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
            <>
              <p className="text-muted-foreground text-sm">
                {totpRecovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator app."}
              </p>
              {totpRecovery ? (
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Recovery code"
                  className={inputClass}
                  autoFocus
                />
              ) : (
                <OtpInput key={otpKey} onComplete={handleTotp} disabled={busy} />
              )}
            </>
          ) : mode === "reset" ? (
            <>
              <p className="text-muted-foreground text-sm">
                Your password has expired and must be changed before continuing.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className={inputClass}
                autoFocus
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
                required
              />
              {policyHint && <p className="text-xs text-muted-foreground">{policyHint}</p>}
            </>
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

          {mode === "totp" && !totpRecovery && busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Verifying…
            </p>
          )}

          {!(mode === "totp" && !totpRecovery) && (
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "totp" ? "Verify" : mode === "reset" ? "Set new password" : "Sign in"}
            </Button>
          )}

          {mode === "totp" && (
            <button
              type="button"
              className="block mx-auto text-muted-foreground hover:text-foreground text-xs"
              onClick={() => { setError(""); setCode(""); setOtpKey((k) => k + 1); setTotpRecovery((v) => !v) }}
            >
              {totpRecovery ? "Use your authenticator app" : "Enter a recovery code instead"}
            </button>
          )}
        </form>

        {mode === "login" && browserSupportsWebAuthn() && (
          <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={passkeySignIn}>
            <KeyRound className="size-4" />
            Sign in with a passkey
          </Button>
        )}

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
