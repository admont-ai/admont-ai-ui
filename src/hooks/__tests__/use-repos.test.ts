import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useRepos } from "@/hooks/use-repos"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches repos on mount", async () => {
    const repos = [
      { slug: "repo-1", name: "Repo 1", description: "", owner: "user", role: "admin" },
      { slug: "repo-2", name: "Repo 2", description: "", owner: "user", role: "reader" },
    ]
    mockAuthFetch.mockResolvedValue(new Response(JSON.stringify(repos), { status: 200 }))

    const { result } = renderHook(() => useRepos())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.repos).toHaveLength(2)
    expect(result.current.repos[0].slug).toBe("repo-1")
    expect(result.current.error).toBeNull()
  })

  it("handles fetch error", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useRepos())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain("500")
    expect(result.current.repos).toEqual([])
  })

  it("handles null response body", async () => {
    mockAuthFetch.mockResolvedValue(new Response("null", { status: 200 }))

    const { result } = renderHook(() => useRepos())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.repos).toEqual([])
  })

  it("provides refresh function", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )

    const { result } = renderHook(() => useRepos())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockAuthFetch).toHaveBeenCalledTimes(1)

    result.current.refresh()

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
  })
})
