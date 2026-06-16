import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { toast } from "sonner"
import { startAuthentication } from "@simplewebauthn/browser"
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser"

import { authFetch, clearAuthToken, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken } from "@/lib/auth-fetch"
import { providerFromIssuer } from "@/components/ui/provider-icon"

interface User {
  email: string
  name: string
  picture: string
  provider: string | null
}

export interface Permissions {
  admin: boolean
  repo_admin: boolean
  ai_user: boolean
  roles: string[]
}

export interface AuthProvider {
  name: string
  display_name: string
}

export interface InternalLoginResult {
  totpRequired: boolean
  pendingToken?: string
}

interface AuthContextValue {
  user: User | null
  permissions: Permissions
  isAuthenticated: boolean
  isLoading: boolean
  providers: AuthProvider[]
  signupOpen: boolean
  login: (provider?: string) => void
  loginInternal: (username: string, password: string) => Promise<InternalLoginResult>
  loginPasskey: () => Promise<void>
  verifyTotp: (pendingToken: string, code: string) => Promise<void>
  signup: (username: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_CALLBACK_PATH = "/auth/callback"

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
  return JSON.parse(atob(base64))
}

function userFromToken(token: string): User | null {
  try {
    const payload = decodeJwtPayload(token)
    // Try explicit provider claim, then fall back to guessing from issuer
    const provider = (typeof payload.provider === "string" ? payload.provider : null)
      ?? providerFromIssuer(payload.iss as string | undefined)
    return {
      email: payload.email as string,
      name: payload.name as string,
      picture: payload.picture as string,
      provider,
    }
  } catch {
    return null
  }
}

function getExpMs(token: string): number | null {
  try {
    const payload = decodeJwtPayload(token)
    if (typeof payload.exp === "number") {
      return payload.exp * 1000
    }
    return null
  } catch {
    return null
  }
}

interface MeDetailsResponse {
  name?: string
  email?: string
  provider?: string
  roles?: string[]
}

export function permissionsFromRoles(roles: string[]): Permissions {
  return {
    admin: roles.includes("admin") || roles.includes("system_admin"),
    repo_admin: roles.includes("repo_admin") || roles.includes("admin") || roles.includes("system_admin"),
    ai_user: roles.includes("ai_user"),
    roles,
  }
}

function restoreSession(
  token: string,
  setUser: (u: User | null) => void,
  setPermissions: (p: Permissions) => void,
  scheduleExpiry: (token: string) => void,
) {
  const u = userFromToken(token)
  if (!u) {
    clearAuthToken()
    return
  }
  setUser(u)
  scheduleExpiry(token)
  authFetch("/me/details")
    .then((res) => {
      if (res.ok) return res.json() as Promise<MeDetailsResponse>
      return null
    })
    .then((d) => {
      if (!d) return
      console.log("[me/details]", d)
      // Update user with server-side details if available
      if (d.name || d.email || d.provider) {
        setUser({
          email: d.email || u.email,
          name: d.name || u.name,
          picture: u.picture,
          provider: d.provider || u.provider,
        })
      }
      setPermissions(permissionsFromRoles(d.roles ?? []))
    })
    .catch(() => {})
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Capture the initial URL at render time, before any child effects
  // (like AppLayout's URL-sync) can overwrite it via replaceState.
  const initialUrl = useRef({
    pathname: window.location.pathname,
    search: window.location.search,
  })

  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permissions>({ admin: false, repo_admin: false, ai_user: false, roles: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [signupOpen, setSignupOpen] = useState(false)

  // Fetch available external auth providers and native-signup availability.
  useEffect(() => {
    authFetch("/auth/providers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!Array.isArray(data)) return setProviders([])
        // Support both new format [{name, display_name}] and legacy [string]
        setProviders(data.map((p: unknown) =>
          typeof p === "string"
            ? { name: p, display_name: p }
            : p as AuthProvider
        ))
      })
      .catch(() => {})

    authFetch("/auth/internal/signup-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { signup_open?: boolean } | null) => {
        setSignupOpen(Boolean(data?.signup_open))
      })
      .catch(() => {})
  }, [])

  const logout = useCallback(() => {
    clearAuthToken()
    window.location.reload()
  }, [])

  // Holds the latest refresh routine so scheduleExpiry's timer can call it
  // without creating a dependency cycle.
  const refreshRef = useRef<() => void>(() => {})

  // Refresh the access token ~1 min before expiry; logout if it fails.
  const scheduleExpiry = useCallback((token: string) => {
    const expMs = getExpMs(token)
    if (!expMs) return
    const delay = expMs - Date.now() - 60_000
    if (delay <= 0) {
      refreshRef.current()
      return
    }
    const timer = setTimeout(() => refreshRef.current(), delay)
    return () => clearTimeout(timer)
  }, [])

  const applySession = useCallback(
    (token: string, refreshToken?: string) => {
      setAuthToken(token)
      if (refreshToken) setRefreshToken(refreshToken)
      restoreSession(token, setUser, setPermissions, scheduleExpiry)
    },
    [scheduleExpiry],
  )

  const tryRefresh = useCallback(async () => {
    const rt = getRefreshToken()
    if (!rt) {
      logout()
      return
    }
    try {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      })
      if (!res.ok) {
        logout()
        return
      }
      const data = (await res.json()) as { token?: string }
      if (data.token) {
        setAuthToken(data.token)
        scheduleExpiry(data.token)
      } else {
        logout()
      }
    } catch {
      logout()
    }
  }, [logout, scheduleExpiry])

  useEffect(() => {
    refreshRef.current = () => void tryRefresh()
  }, [tryRefresh])

  // External IdP login (OAuth redirect). Kept for when external providers exist.
  const login = useCallback(async (provider?: string) => {
    const redirectUri = `${window.location.origin}${AUTH_CALLBACK_PATH}`
    let url = `/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`
    if (provider) {
      url += `&provider=${encodeURIComponent(provider)}`
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error("login is not available")
    const data = (await res.json()) as { auth_url: string }
    window.location.href = data.auth_url
  }, [])

  // Native internal login: returns {totpRequired} or applies the session.
  const loginInternal = useCallback(
    async (username: string, password: string): Promise<InternalLoginResult> => {
      const res = await fetch("/auth/internal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        totp_required?: boolean
        pending_token?: string
        token?: string
        refresh_token?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Login failed")
      if (data.totp_required) {
        return { totpRequired: true, pendingToken: data.pending_token }
      }
      applySession(data.token!, data.refresh_token)
      return { totpRequired: false }
    },
    [applySession],
  )

  const verifyTotp = useCallback(
    async (pendingToken: string, code: string) => {
      const res = await fetch("/auth/internal/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_token: pendingToken, code }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        token?: string
        refresh_token?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      applySession(data.token!, data.refresh_token)
    },
    [applySession],
  )

  // Passkey (WebAuthn) login: discoverable/usernameless. A user-verified
  // passkey is multi-factor, so this logs in directly without a TOTP step.
  const loginPasskey = useCallback(async () => {
    const beginRes = await fetch("/auth/internal/webauthn/login/begin", { method: "POST" })
    const begin = (await beginRes.json().catch(() => ({}))) as {
      error?: string
      session_id?: string
      options?: { publicKey: PublicKeyCredentialRequestOptionsJSON }
    }
    if (!beginRes.ok || !begin.options || !begin.session_id) {
      throw new Error(begin.error ?? "Passkey sign-in is unavailable")
    }
    const assertion = await startAuthentication({ optionsJSON: begin.options.publicKey })
    const res = await fetch(
      `/auth/internal/webauthn/login/finish?session_id=${encodeURIComponent(begin.session_id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      token?: string
      refresh_token?: string
    }
    if (!res.ok) throw new Error(data.error ?? "Passkey sign-in failed")
    applySession(data.token!, data.refresh_token)
  }, [applySession])

  const signup = useCallback(
    async (username: string, password: string, firstName: string, lastName: string) => {
      const res = await fetch("/auth/internal/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, first_name: firstName, last_name: lastName }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        token?: string
        refresh_token?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Signup failed")
      setSignupOpen(false)
      applySession(data.token!, data.refresh_token)
    },
    [applySession],
  )

  // Handle OAuth callback token or restore existing session.
  // Uses initialUrl ref because child effects (AppLayout URL-sync)
  // fire before this parent effect and can overwrite the URL.
  useEffect(() => {
    const { pathname, search } = initialUrl.current

    if (pathname === AUTH_CALLBACK_PATH) {
      const params = new URLSearchParams(search)
      const token = params.get("token")
      const code = params.get("code")
      const errorCode = params.get("error")

      // Clean URL to prevent double-processing in React Strict Mode
      window.history.replaceState({}, "", "/")

      if (errorCode) {
        const messages: Record<string, string> = {
          pending: "Your access request is pending administrator approval.",
          not_authorized: "Your account is not authorized for access. Contact an administrator.",
          suspended: "Your account has been suspended.",
        }
        toast.error(messages[errorCode] ?? "Sign-in was not completed.")
        setIsLoading(false)
        return
      }

      if (token) {
        applySession(token, params.get("refresh_token") ?? undefined)
        setIsLoading(false)
        return
      }
      if (code) {
        // External IdP one-time code → exchange for tokens.
        fetch("/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { token?: string; refresh_token?: string } | null) => {
            if (d?.token) applySession(d.token, d.refresh_token)
          })
          .catch(() => {})
          .finally(() => setIsLoading(false))
        return
      }
      setIsLoading(false)
      return
    }

    // No callback — restore existing session from localStorage
    const token = getAuthToken()
    if (token) {
      const expMs = getExpMs(token)
      if (expMs && expMs - 60_000 > Date.now()) {
        restoreSession(token, setUser, setPermissions, scheduleExpiry)
      } else {
        clearAuthToken()
      }
    }
    setIsLoading(false)
  }, [scheduleExpiry, applySession])

  // Listen for 401 events from authFetch
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener("auth:unauthorized", handler)
    return () => window.removeEventListener("auth:unauthorized", handler)
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated: user !== null,
      isLoading,
      providers,
      signupOpen,
      login,
      loginInternal,
      loginPasskey,
      verifyTotp,
      signup,
      logout,
    }),
    [user, permissions, isLoading, providers, signupOpen, login, loginInternal, loginPasskey, verifyTotp, signup, logout],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
