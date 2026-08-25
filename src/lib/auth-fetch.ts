import { toast } from "sonner"

declare global {
  interface Window {
    __APP_CONFIG__?: { API_BASE_URL?: string }
  }
}

// Base URL of the API. Empty in dev (relative paths go through the Vite proxy).
// Resolved at runtime from window.__APP_CONFIG__ (injected by the Docker image's
// entrypoint), falling back to the Vite build-time env var.
const API_BASE = (
  window.__APP_CONFIG__?.API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "")

/** Prefix an absolute API path with the configured API base URL. */
export function apiUrl(path: string): string {
  return path.startsWith("/") ? API_BASE + path : path
}

const TOKEN_KEY = "auth_token"
const REFRESH_KEY = "refresh_token"

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Refreshes the access token using the stored refresh token. Returns the new
// access token on success, or null (after clearing both tokens) on failure.
// Concurrent callers share one in-flight request so a burst of 401s across
// several in-flight requests doesn't fire multiple refresh calls at once.
let refreshInFlight: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<string | null> {
  const rt = getRefreshToken()
  if (!rt) return null
  try {
    const res = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) {
      clearAuthToken()
      return null
    }
    const data = (await res.json()) as { token?: string }
    if (!data.token) {
      clearAuthToken()
      return null
    }
    setAuthToken(data.token)
    return data.token
  } catch {
    clearAuthToken()
    return null
  }
}

// Deduplicate "backend unreachable" toasts — show at most one per 5 seconds
let lastUnreachableToast = 0
function showUnreachableToast() {
  const now = Date.now()
  if (now - lastUnreachableToast < 5000) return
  lastUnreachableToast = now
  toast.error("Backend unreachable")
}

/** Check if a 5xx response is likely the dev proxy failing to connect */
async function isProxyError(response: Response): Promise<boolean> {
  try {
    const text = await response.clone().text()
    // Vite proxy returns generic HTML or empty body when backend is down
    return (
      text.length === 0 ||
      text.includes("Internal Server Error") ||
      text.includes("ECONNREFUSED") ||
      text.includes("proxy error") ||
      text.includes("<!DOCTYPE")
    )
  } catch {
    return true
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const target = typeof input === "string" ? apiUrl(input) : input
  let response: Response
  try {
    response = await fetch(target, { ...init, headers })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err
    }
    showUnreachableToast()
    throw new Error("Network error")
  }

  if (response.status === 401 && token) {
    // The access token may have simply expired (e.g. the proactive refresh
    // timer was delayed by browser tab throttling) — try a silent refresh
    // and retry once before giving up on the session.
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retryHeaders = new Headers(init?.headers)
      retryHeaders.set("Authorization", `Bearer ${newToken}`)
      try {
        response = await fetch(target, { ...init, headers: retryHeaders })
      } catch {
        // Keep the original 401 response; the outer error handling below
        // will report it.
      }
    }
    if (response.status === 401) {
      clearAuthToken()
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
    }
  }

  // Detect backend-down via proxy error page (empty/HTML body) across the 5xx range
  if (response.status >= 500 && response.status <= 504) {
    if (await isProxyError(response)) {
      showUnreachableToast()
      return response
    }
  }

  if (!response.ok && response.status !== 404) {
    let message = `Request failed: ${response.status} ${response.statusText}`
    let detail: string | undefined
    try {
      const body = await response.clone().json()
      if (body?.error) {
        message = body.error
      } else if (body?.title) {
        message = body.title
      }
      if (body?.detail) {
        detail = body.detail
      }
      if (body?.errors?.length) {
        const reasons = body.errors.map((e: { name?: string; reason?: string }) =>
          e.name ? `${e.name}: ${e.reason}` : e.reason
        )
        detail = reasons.join(", ")
      }
    } catch {
      // no JSON body, use default message
    }
    toast.error(message, { description: detail })
  }

  return response
}
