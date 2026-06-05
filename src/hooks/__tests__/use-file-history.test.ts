import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useFileHistory, fetchFileDiff, fetchFileAtCommit } from "@/hooks/use-file-history"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useFileHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not fetch on mount (lazy)", () => {
    renderHook(() => useFileHistory("repo", "file.md"))
    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("fetches history when fetch is called", async () => {
    const entries = [
      { commit_hash: "abc123", author: "User", author_email: "u@test.com", date: "2025-01-01", message: "init" },
    ]
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ entries }), { status: 200 }),
    )

    const { result } = renderHook(() => useFileHistory("repo", "doc.md"))

    act(() => {
      result.current.fetch()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].commit_hash).toBe("abc123")
    expect(result.current.error).toBeNull()
  })

  it("handles fetch error", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useFileHistory("repo", "file.md"))

    act(() => {
      result.current.fetch()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain("500")
  })

  it("does not fetch when repoSlug is empty", () => {
    const { result } = renderHook(() => useFileHistory("", "file.md"))

    act(() => {
      result.current.fetch()
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("does not fetch when filePath is empty", () => {
    const { result } = renderHook(() => useFileHistory("repo", ""))

    act(() => {
      result.current.fetch()
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })
})

describe("fetchFileDiff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches diff for a commit", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ diff: "--- a/file\n+++ b/file" }), { status: 200 }),
    )

    const diff = await fetchFileDiff("repo", "file.md", "abc123")

    expect(diff).toBe("--- a/file\n+++ b/file")
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/filediff/file.md?commit=abc123",
    )
  })

  it("throws on error", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    await expect(fetchFileDiff("repo", "file.md", "abc")).rejects.toThrow("Failed to fetch diff")
  })
})

describe("fetchFileAtCommit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches file content at a specific commit", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ content: "old content" }), { status: 200 }),
    )

    const content = await fetchFileAtCommit("repo", "file.md", "abc123")

    expect(content).toBe("old content")
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/fileatcommit/file.md?commit=abc123",
    )
  })

  it("throws on error", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 404 }))

    await expect(fetchFileAtCommit("repo", "file.md", "abc")).rejects.toThrow("Failed to fetch file at commit")
  })
})
