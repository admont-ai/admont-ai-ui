import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/ui/provider-icon"
import { useAuth } from "@/contexts/auth-context"

const inputClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

type Mode = "login" | "totp" | "signup"

export function LoginPanel() {
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      if (mode === "signup") {
        await signup(email, password, firstName, lastName)
      } else if (mode === "totp") {
        await verifyTotp(pendingToken, code.trim())
      } else {
        const res = await loginInternal(email, password)
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

  const title = mode === "signup" ? "Create admin account" : mode === "totp" ? "Two-factor authentication" : "Sign in"

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/admont-ai-icon.png" alt="" width="48" height="48" className="mx-auto rounded-lg" />
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "signup"
              ? "No users exist yet. Create the first administrator account."
              : "Sign in to access your document repositories."}
          </p>
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
          <button type="button" className="block mx-auto text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("signup") }}>
            First time? Create the admin account
          </button>
        )}
        {mode === "signup" && !busy && (
          <button type="button" className="block mx-auto text-muted-foreground hover:text-foreground text-xs" onClick={() => { setError(""); setMode("login") }}>
            Back to sign in
          </button>
        )}

        {mode === "login" && providers.length > 0 && (
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
      </div>
    </div>
  )
}
