import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

type Mode = "login" | "totp" | "signup"

export function LoginPanel() {
  const { providers, signupOpen, login, loginInternal, verifyTotp, signup } = useAuth()
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      if (mode === "signup") {
        await signup(username, password, firstName, lastName)
      } else if (mode === "totp") {
        await verifyTotp(pendingToken, code.trim())
      } else {
        const res = await loginInternal(username, password)
        if (res.totpRequired) {
          setPendingToken(res.pendingToken ?? "")
          setCode("")
          setMode("totp")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const isSignup = signupOpen && mode === "signup"

  const title = isSignup
    ? "Create admin account"
    : mode === "totp"
      ? "Two-factor authentication"
      : "Sign in"

  const subtitle = isSignup
    ? "No users exist yet. Create the first administrator account."
    : "Sign in to access your document repositories."

  return (
    <div className="flex h-full items-start justify-center px-6 pt-[15vh]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/admont-ai-icon.png" alt="" width="48" height="48" className="mx-auto rounded-lg" />
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
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
                minLength={isSignup ? 8 : undefined}
                required
              />
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isSignup ? "Create account" : mode === "totp" ? "Verify" : "Sign in"}
          </Button>
        </form>

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
