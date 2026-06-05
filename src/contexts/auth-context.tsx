import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { authFetch, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth-fetch"
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

interface AuthContextValue {
  user: User | null
  permissions: Permissions
  isAuthenticated: boolean
  isLoading: boolean
  providers: AuthProvider[]
  login: (provider?: string) => void
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

  // Fetch available auth providers
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
  }, [])

  const logout = useCallback(() => {
    clearAuthToken()
    window.location.reload()
  }, [])

  // Schedule auto-logout 1 min before token expires
  const scheduleExpiry = useCallback(
    (token: string) => {
      const expMs = getExpMs(token)
      if (!expMs) return
      const delay = expMs - Date.now() - 60_000
      if (delay <= 0) {
        logout()
        return
      }
      const timer = setTimeout(logout, delay)
      return () => clearTimeout(timer)
    },
    [logout],
  )

  const login = useCallback(async (provider?: string) => {
    const redirectUri = `${window.location.origin}${AUTH_CALLBACK_PATH}`
    let url = `/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`
    if (provider) {
      url += `&provider=${encodeURIComponent(provider)}`
    }
    console.log("[auth] login request:", url)
    const res = await fetch(url)
    const data = await res.json() as { auth_url: string }
    console.log("[auth] login response:", data)
    window.location.href = data.auth_url
  }, [])

  // Handle OAuth callback token or restore existing session.
  // Uses initialUrl ref because child effects (AppLayout URL-sync)
  // fire before this parent effect and can overwrite the URL.
  useEffect(() => {
    const { pathname, search } = initialUrl.current

    if (pathname === AUTH_CALLBACK_PATH) {
      const params = new URLSearchParams(search)
      const token = params.get("token")

      // Clean URL to prevent double-processing in React Strict Mode
      window.history.replaceState({}, "", "/")

      if (token) {
        setAuthToken(token)
        restoreSession(token, setUser, setPermissions, scheduleExpiry)
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
  }, [scheduleExpiry])

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
      login,
      logout,
    }),
    [user, permissions, isLoading, providers, login, logout],
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
