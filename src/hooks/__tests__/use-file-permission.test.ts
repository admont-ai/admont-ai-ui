import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { hasPermission, useFilePermission, type PermissionLevel } from "@/hooks/use-file-permission"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("hasPermission", () => {
  const levels: PermissionLevel[] = ["none", "viewer", "contributor", "content_manager", "manager"]

  it("returns true when actual equals required", () => {
    for (const level of levels) {
      expect(hasPermission(level, level)).toBe(true)
    }
  })

  it("manager has all permissions", () => {
    for (const level of levels) {
      expect(hasPermission("manager", level)).toBe(true)
    }
  })

  it("none has no permissions except none", () => {
    expect(hasPermission("none", "none")).toBe(true)
    expect(hasPermission("none", "viewer")).toBe(false)
    expect(hasPermission("none", "contributor")).toBe(false)
    expect(hasPermission("none", "content_manager")).toBe(false)
    expect(hasPermission("none", "manager")).toBe(false)
  })

  it("viewer is below contributor", () => {
    expect(hasPermission("viewer", "contributor")).toBe(false)
  })

  it("contributor is above viewer", () => {
    expect(hasPermission("contributor", "viewer")).toBe(true)
  })

  it("content_manager is above contributor but below manager", () => {
    expect(hasPermission("content_manager", "contributor")).toBe(true)
    expect(hasPermission("content_manager", "manager")).toBe(false)
  })

  it("respects full ordering: none < viewer < contributor < content_manager < manager", () => {
    for (let i = 0; i < levels.length; i++) {
      for (let j = 0; j < levels.length; j++) {
        expect(hasPermission(levels[i], levels[j])).toBe(i >= j)
      }
    }
  })
})

describe("useFilePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches permission for a file path", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ permission: "contributor" }), { status: 200 }),
    )

    const { result } = renderHook(() => useFilePermission("repo", "docs/file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("contributor")
    expect(mockAuthFetch).toHaveBeenCalledWith("/repos/repo/fileinfo/docs/file.md")
  })

  it("returns none when repoSlug is empty", () => {
    const { result } = renderHook(() => useFilePermission("", "file.md"))

    expect(result.current.permission).toBe("none")
    expect(result.current.loading).toBe(false)
  })

  it("returns none when path is empty", () => {
    const { result } = renderHook(() => useFilePermission("repo", ""))

    expect(result.current.permission).toBe("none")
    expect(result.current.loading).toBe(false)
  })

  it("returns none on fetch error", async () => {
    mockAuthFetch.mockRejectedValue(new Error("network"))

    const { result } = renderHook(() => useFilePermission("repo", "file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("none")
  })

  it("returns none for non-ok response", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 404 }))

    const { result } = renderHook(() => useFilePermission("repo", "file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("none")
  })

  it("returns none for unknown permission level", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ permission: "superadmin" }), { status: 200 }),
    )

    const { result } = renderHook(() => useFilePermission("repo", "file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("none")
  })

  it("returns manager permission", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ permission: "manager" }), { status: 200 }),
    )

    const { result } = renderHook(() => useFilePermission("repo", "file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("manager")
  })

  it("provides refetch function", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ permission: "viewer" }), { status: 200 }),
    )

    const { result } = renderHook(() => useFilePermission("repo", "file.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockAuthFetch).toHaveBeenCalledTimes(1)

    result.current.refetch()

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
  })
})
