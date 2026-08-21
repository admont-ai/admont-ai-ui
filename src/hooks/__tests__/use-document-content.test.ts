import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useDocumentContent } from "@/hooks/use-document-content"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useDocumentContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches fileinfo then file content", async () => {
    const fileInfo = {
      name: "doc.md",
      path: "docs/doc.md",
      last_modified: "2025-01-01T00:00:00Z",
      permission: "contributor",
    }
    const fileContent = "# Hello World"

    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(fileInfo), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(fileContent, {
          status: 200,
          headers: { "X-Is-Draft": "false" },
        }),
      )

    const { result } = renderHook(() => useDocumentContent("my-repo", "docs/doc.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.content).toBe("# Hello World")
    expect(result.current.permission).toBe("contributor")
    expect(result.current.lastModified).toBe("2025-01-01T00:00:00Z")
    expect(result.current.isDraft).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("resets state when repoSlug is empty", () => {
    const { result } = renderHook(() => useDocumentContent("", "file.md"))

    expect(result.current.content).toBeNull()
    expect(result.current.permission).toBe("none")
    expect(result.current.loading).toBe(false)
  })

  it("resets state when filePath is empty", () => {
    const { result } = renderHook(() => useDocumentContent("repo", ""))

    expect(result.current.content).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("handles 404 with error message", async () => {
    mockAuthFetch.mockResolvedValueOnce(new Response("", { status: 404 }))

    const { result } = renderHook(() => useDocumentContent("repo", "missing.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("File not found.")
    expect(result.current.content).toBeNull()
  })

  it("detects draft from X-Is-Draft header", async () => {
    const fileInfo = {
      last_modified: "2025-01-01T00:00:00Z",
      permission: "contributor",
    }
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(fileInfo), { status: 200 }))
      .mockResolvedValueOnce(
        new Response("draft content", {
          status: 200,
          headers: { "X-Is-Draft": "true" },
        }),
      )

    const { result } = renderHook(() => useDocumentContent("repo", "doc.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isDraft).toBe(true)
  })

  it("defaults unknown permission to none", async () => {
    const fileInfo = {
      last_modified: "2025-01-01T00:00:00Z",
      permission: "unknown_level",
    }
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(fileInfo), { status: 200 }))
      .mockResolvedValueOnce(new Response("content", { status: 200 }))

    const { result } = renderHook(() => useDocumentContent("repo", "doc.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permission).toBe("none")
  })

  it("surfaces another user's pending draft", async () => {
    const fileInfo = {
      last_modified: "2025-01-01T00:00:00Z",
      permission: "contributor",
      pending_draft_owner_name: "Bob",
      pending_draft_owner_email: "bob@example.com",
      pending_draft_updated_at: "2025-01-02T00:00:00Z",
      locked_by_pending_draft: true,
    }
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(fileInfo), { status: 200 }))
      .mockResolvedValueOnce(new Response("published content", { status: 200 }))

    const { result } = renderHook(() => useDocumentContent("repo", "doc.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.lockedByPendingDraft).toBe(true)
    expect(result.current.pendingDraftOwnerName).toBe("Bob")
    expect(result.current.pendingDraftOwnerEmail).toBe("bob@example.com")
    expect(result.current.pendingDraftUpdatedAt).toBe("2025-01-02T00:00:00Z")
  })

  it("defaults pending-draft fields to unlocked/null when absent", async () => {
    const fileInfo = {
      last_modified: "2025-01-01T00:00:00Z",
      permission: "contributor",
    }
    mockAuthFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(fileInfo), { status: 200 }))
      .mockResolvedValueOnce(new Response("content", { status: 200 }))

    const { result } = renderHook(() => useDocumentContent("repo", "doc.md"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.lockedByPendingDraft).toBe(false)
    expect(result.current.pendingDraftOwnerName).toBeNull()
    expect(result.current.pendingDraftOwnerEmail).toBeNull()
    expect(result.current.pendingDraftUpdatedAt).toBeNull()
  })
})
