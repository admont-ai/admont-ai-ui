import { useEffect, useState } from "react"
import { Loader2, KeyRound } from "lucide-react"
import { browserSupportsWebAuthn } from "@simplewebauthn/browser"

import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { OtpInput } from "@/components/auth/OtpInput"
import { useAuth } from "@/contexts/auth-context"
import { describePasswordPolicy, getPasswordPolicy } from "@/lib/password-policy"

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

type Mode = "login" | "totp" | "reset" | "signup"

export function LoginPanel() {
  const { providers, signupOpen, login, loginInternal, loginPasskey, verifyTotp, resetPassword, signup } = useAuth()
  const [mode, setMode] = useState<Mode>("login")
  const [username, setUsername] = useState("")

  useEffect(() => {
    if (signupOpen) setMode("signup")
  }, [signupOpen])
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setCode("")
      setOtpKey((k) => k + 1) // reset the digit boxes
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
        await signup(username, password, firstName, lastName)
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.")
          return
        }
        await resetPassword(resetToken, password)
      } else {
        const res = await loginInternal(username, password)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  const isSignup = signupOpen && mode === "signup"

  const title = isSignup
    ? "Create admin account"
    : mode === "totp"
      ? "Two-factor authentication"
      : mode === "reset"
        ? "Set a new password"
        : "Sign in"

  const subtitle = isSignup
    ? "No users exist yet. Create the first administrator account."
    : mode === "reset"
      ? "Your password has expired and must be changed before continuing."
      : mode === "totp"
        ? totpRecovery
          ? "Enter one of your recovery codes."
          : "Enter the 6-digit code from your authenticator app."
        : "Sign in to access your document repositories."

  return (
    <div className="flex h-full items-start justify-center px-6 pt-[15vh]">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center space-y-2">
          <img src="/admont-ai-icon.png" alt="" width="48" height="48" className="mx-auto rounded-lg" />
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "totp" ? (
            totpRecovery ? (
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
            )
          ) : mode === "reset" ? (
            <>
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
              {isSignup && (
                <div className="flex gap-2">
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inputClass} autoFocus />
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={inputClass} />
                </div>
              )}
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={inputClass}
                autoFocus={!isSignup}
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={inputClass}
                required
              />
              {isSignup && policyHint && <p className="text-xs text-muted-foreground">{policyHint}</p>}
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
              {isSignup ? "Create account" : mode === "totp" ? "Verify" : mode === "reset" ? "Set new password" : "Sign in"}
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

        {mode === "login" && !isSignup && browserSupportsWebAuthn() && (
          <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={passkeySignIn}>
            <KeyRound className="size-4" />
            Sign in with a passkey
          </Button>
        )}

        {isSignup && !busy && (
          <button type="button" className="block mx-auto text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("login") }}>
            Already have an account? Sign in
          </button>
        )}
        {!signupOpen && mode === "login" && providers.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-muted-foreground text-center text-xs">or continue with</p>
            {providers.map((p) => (
              <Button key={p.name} variant="outline" className="w-full gap-2" onClick={() => login(p.name)}>
                <ProviderIcon provider={p.name} className="size-4" />
                {p.display_name}
              </Button>
            ))}
          </div>
        )}
        {signupOpen && mode === "login" && (
          <div className="space-y-2 border-t pt-4">
            {providers.length > 0 && (
              <>
                <p className="text-muted-foreground text-center text-xs">or continue with</p>
                {providers.map((p) => (
                  <Button key={p.name} variant="outline" className="w-full gap-2" onClick={() => login(p.name)}>
                    <ProviderIcon provider={p.name} className="size-4" />
                    {p.display_name}
                  </Button>
                ))}
              </>
            )}
            <button type="button" className="block mx-auto text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("signup") }}>
              First time? Create the admin account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
