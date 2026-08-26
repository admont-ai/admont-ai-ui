import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { AuthProvider, useAuth, decodeJwtPayload } from "@/contexts/auth-context"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  apiUrl: (path: string) => path,
}))

vi.mock("@/components/ui/provider-icon", () => ({
  providerFromIssuer: vi.fn().mockReturnValue("google"),
}))

import { authFetch, getAuthToken, setAuthToken, clearAuthToken, getRefreshToken, refreshAccessToken } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)
const mockGetAuthToken = vi.mocked(getAuthToken)
const mockSetAuthToken = vi.mocked(setAuthToken)
const mockClearAuthToken = vi.mocked(clearAuthToken)
const mockGetRefreshToken = vi.mocked(getRefreshToken)
const mockRefreshAccessToken = vi.mocked(refreshAccessToken)

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="email">{auth.user?.email ?? "none"}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="admin">{String(auth.permissions.admin)}</span>
      <span data-testid="providers">{auth.providers.length}</span>
      <button data-testid="logout" onClick={auth.logout}>Logout</button>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockGetRefreshToken.mockReturnValue(null)
    mockRefreshAccessToken.mockResolvedValue(null)
    Object.defineProperty(window, "location", {
      value: { pathname: "/", search: "", origin: "http://localhost:3000", href: "http://localhost:3000/", reload: vi.fn() },
      writable: true,
      configurable: true,
    })
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {})
  })

  it("renders children and provides default unauthenticated state", async () => {
    mockGetAuthToken.mockReturnValue(null)
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(screen.getByTestId("email").textContent).toBe("none")
    expect(screen.getByTestId("authenticated").textContent).toBe("false")
    expect(screen.getByTestId("admin").textContent).toBe("false")
  })

  it("restores session from existing token", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({
      email: "user@test.com",
      name: "Test User",
      picture: "https://example.com/pic.jpg",
      exp: futureExp,
      iss: "https://accounts.google.com",
    })
    mockGetAuthToken.mockReturnValue(token)

    // /auth/providers, /auth/internal/signup-status, /me/details
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ signup_open: false }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "Test User", email: "user@test.com", roles: ["admin", "ai_user"] }), { status: 200 }),
      )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(screen.getByTestId("email").textContent).toBe("user@test.com")
    expect(screen.getByTestId("authenticated").textContent).toBe("true")

    await waitFor(() => {
      expect(screen.getByTestId("admin").textContent).toBe("true")
    })
  })

  it("clears expired token on restore", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600
    const token = makeJwt({ email: "x@test.com", name: "X", picture: "", exp: pastExp })
    mockGetAuthToken.mockReturnValue(token)
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockClearAuthToken).toHaveBeenCalled()
    expect(screen.getByTestId("authenticated").textContent).toBe("false")
  })

  it("silently refreshes an expired token on restore when a refresh token exists", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600
    const expiredToken = makeJwt({ email: "x@test.com", name: "X", picture: "", exp: pastExp })
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const freshToken = makeJwt({
      email: "x@test.com", name: "X", picture: "", exp: futureExp, iss: "https://accounts.google.com",
    })
    mockGetAuthToken.mockReturnValue(expiredToken)
    mockGetRefreshToken.mockReturnValue("some-refresh-token")
    mockRefreshAccessToken.mockResolvedValue(freshToken)
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockRefreshAccessToken).toHaveBeenCalled()
    expect(mockClearAuthToken).not.toHaveBeenCalled()
    expect(screen.getByTestId("email").textContent).toBe("x@test.com")
    expect(screen.getByTestId("authenticated").textContent).toBe("true")
  })

  it("gives up when refreshing an expired token fails", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600
    const expiredToken = makeJwt({ email: "x@test.com", name: "X", picture: "", exp: pastExp })
    mockGetAuthToken.mockReturnValue(expiredToken)
    mockGetRefreshToken.mockReturnValue("some-refresh-token")
    mockRefreshAccessToken.mockResolvedValue(null)
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockRefreshAccessToken).toHaveBeenCalled()
    expect(screen.getByTestId("authenticated").textContent).toBe("false")
  })

  it("fetches auth providers on mount", async () => {
    mockGetAuthToken.mockReturnValue(null)
    const providers = [
      { name: "google", display_name: "Google" },
      { name: "github", display_name: "GitHub" },
    ]
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify(providers), { status: 200 }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("providers").textContent).toBe("2")
    })
  })

  it("handles legacy string provider format", async () => {
    mockGetAuthToken.mockReturnValue(null)
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify(["google", "github"]), { status: 200 }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("providers").textContent).toBe("2")
    })
  })

  it("useAuth throws outside provider", () => {
    expect(() => {
      const ThrowComponent = () => {
        useAuth()
        return null
      }
      render(<ThrowComponent />)
    }).toThrow("useAuth must be used within AuthProvider")
  })

  it("listens for auth:unauthorized events", async () => {
    mockGetAuthToken.mockReturnValue(null)
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"))
    })

    expect(window.location.reload).toHaveBeenCalled()
  })

  it("handles OAuth callback with token in URL", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({
      email: "callback@test.com",
      name: "Callback User",
      picture: "",
      exp: futureExp,
      iss: "https://accounts.google.com",
    })

    Object.defineProperty(window, "location", {
      value: {
        pathname: "/auth/callback",
        search: `?token=${token}`,
        origin: "http://localhost:3000",
        href: `http://localhost:3000/auth/callback?token=${token}`,
        reload: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // /auth/providers + /me/details
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ roles: ["ai_user"] }), { status: 200 }),
      )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockSetAuthToken).toHaveBeenCalledWith(token)
    expect(screen.getByTestId("email").textContent).toBe("callback@test.com")
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/")
  })

  it("handles OAuth callback without token", async () => {
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/auth/callback",
        search: "",
        origin: "http://localhost:3000",
        href: "http://localhost:3000/auth/callback",
        reload: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockSetAuthToken).not.toHaveBeenCalled()
    expect(screen.getByTestId("authenticated").textContent).toBe("false")
  })

  it("handles /me/details returning non-ok response", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({
      email: "user@test.com",
      name: "User",
      picture: "",
      exp: futureExp,
      iss: "https://accounts.google.com",
    })
    mockGetAuthToken.mockReturnValue(token)

    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(screen.getByTestId("email").textContent).toBe("user@test.com")
    expect(screen.getByTestId("authenticated").textContent).toBe("true")
    // Permissions remain default since /me/details failed
    expect(screen.getByTestId("admin").textContent).toBe("false")
  })

  it("clears token when JWT payload is invalid on restore", async () => {
    mockGetAuthToken.mockReturnValue("invalid-token-no-dots")
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(mockClearAuthToken).toHaveBeenCalled()
    expect(screen.getByTestId("authenticated").textContent).toBe("false")
  })

  it("handles non-array providers response", async () => {
    mockGetAuthToken.mockReturnValue(null)
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ providers: "invalid" }), { status: 200 }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false")
    })

    expect(screen.getByTestId("providers").textContent).toBe("0")
  })
})

describe("decodeJwtPayload edge cases", () => {
  it("handles tokens with unicode content", () => {
    const token = makeJwt({ name: "Ünïcödé", email: "test@test.com" })
    const payload = decodeJwtPayload(token)
    expect(payload.name).toBe("Ünïcödé")
  })

  it("handles tokens with nested objects", () => {
    const token = makeJwt({ metadata: { org: "acme", tier: "pro" } })
    const payload = decodeJwtPayload(token)
    expect(payload.metadata).toEqual({ org: "acme", tier: "pro" })
  })
})
