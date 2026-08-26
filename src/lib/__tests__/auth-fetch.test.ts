import { describe, it, expect, vi, beforeEach } from "vitest"
import { getAuthToken, setAuthToken, clearAuthToken, authFetch, setRefreshToken, getRefreshToken } from "@/lib/auth-fetch"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe("token management", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("getAuthToken returns null when no token is set", () => {
    expect(getAuthToken()).toBeNull()
  })

  it("setAuthToken stores and getAuthToken retrieves it", () => {
    setAuthToken("my-jwt-token")
    expect(getAuthToken()).toBe("my-jwt-token")
  })

  it("clearAuthToken removes the stored token", () => {
    setAuthToken("token-to-remove")
    clearAuthToken()
    expect(getAuthToken()).toBeNull()
  })

  it("setAuthToken overwrites existing token", () => {
    setAuthToken("first")
    setAuthToken("second")
    expect(getAuthToken()).toBe("second")
  })
})

describe("authFetch", () => {
  let fakeTime = 1_000_000
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    fakeTime += 10_000
    vi.spyOn(Date, "now").mockReturnValue(fakeTime)
  })

  it("adds Authorization header when token exists", async () => {
    setAuthToken("test-token")
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await authFetch("/api/test")

    const [, init] = mockFetch.mock.calls[0]
    const headers = init?.headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer test-token")
  })

  it("does not add Authorization header when no token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await authFetch("/api/test")

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    const headers = init?.headers as Headers
    expect(headers.get("Authorization")).toBeNull()
  })

  it("passes through additional init options", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await authFetch("/api/test", {
      method: "POST",
      body: JSON.stringify({ data: 1 }),
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/test")
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(JSON.stringify({ data: 1 }))
  })

  it("clears token and dispatches event on 401", async () => {
    setAuthToken("expired-token")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 401 }),
    )
    const dispatchSpy = vi.spyOn(window, "dispatchEvent")

    await authFetch("/api/test")

    expect(getAuthToken()).toBeNull()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    )
  })

  it("silently refreshes and retries once on 401 when a refresh token exists", async () => {
    setAuthToken("expired-token")
    setRefreshToken("valid-refresh-token")
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/auth/refresh")) {
        return new Response(JSON.stringify({ token: "new-access-token" }), { status: 200 })
      }
      // Original request: 401 with the stale token, 200 once it's been refreshed.
      return getAuthToken() === "new-access-token"
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response("", { status: 401 })
    })
    const dispatchSpy = vi.spyOn(window, "dispatchEvent")

    const res = await authFetch("/api/test")

    expect(res.status).toBe(200)
    expect(getAuthToken()).toBe("new-access-token")
    expect(getRefreshToken()).toBe("valid-refresh-token")
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    )
  })

  it("clears token and dispatches event on 401 when refresh also fails", async () => {
    setAuthToken("expired-token")
    setRefreshToken("stale-refresh-token")
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/auth/refresh")) {
        return new Response("", { status: 401 })
      }
      return new Response("", { status: 401 })
    })
    const dispatchSpy = vi.spyOn(window, "dispatchEvent")

    await authFetch("/api/test")

    expect(getAuthToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    )
  })

  it("does not clear token on 401 when no token exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 401 }),
    )
    const dispatchSpy = vi.spyOn(window, "dispatchEvent")

    await authFetch("/api/test")

    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:unauthorized" }),
    )
  })

  it("returns response on 404 without toasting", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    )
    const { toast } = await import("sonner")

    const res = await authFetch("/api/missing")

    expect(res.status).toBe(404)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("shows toast on non-404 error responses with JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Validation failed" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Validation failed", expect.anything())
  })

  it("throws on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(authFetch("/api/test")).rejects.toThrow("Network error")
  })

  it("re-throws AbortError without wrapping", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError")
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError)

    await expect(authFetch("/api/test")).rejects.toThrow(abortError)
  })

  it("detects proxy errors on 502/503/504", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 502 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("detects proxy error on 500 with empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("detects proxy error on 500 with ECONNREFUSED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ECONNREFUSED", { status: 500 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("detects proxy error on 500 with HTML body (DOCTYPE)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>Error</body></html>", { status: 500 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("treats 500 with real JSON body as normal error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Internal error", expect.anything())
  })

  it("shows toast with title field from JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Rate limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Rate limited", expect.anything())
  })

  it("shows toast with detail field as description", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Bad request", detail: "Field X is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Bad request", { description: "Field X is required" })
  })

  it("shows toast with errors array as description", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Validation failed",
          errors: [
            { name: "email", reason: "is required" },
            { name: "name", reason: "is too short" },
          ],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Validation failed", {
      description: "email: is required, name: is too short",
    })
  })

  it("shows default message when JSON body has no error/title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ foo: "bar" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("400"),
      expect.anything(),
    )
  })

  it("shows default message when body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("plain text error", { status: 400 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("400"),
      expect.anything(),
    )
  })

  it("detects proxy error on 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 503 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("detects proxy error on 504", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 504 }),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Backend unreachable")
  })

  it("treats 502 with real JSON body as a normal backend error, not proxy-down", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Bad Gateway", status: 502, detail: "checker service unavailable" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    )
    const { toast } = await import("sonner")

    await authFetch("/api/test")

    expect(toast.error).toHaveBeenCalledWith("Bad Gateway", { description: "checker service unavailable" })
    expect(toast.error).not.toHaveBeenCalledWith("Backend unreachable")
  })
})
