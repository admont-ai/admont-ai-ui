import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDocumentSave } from "@/hooks/use-document-save"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useDocumentSave", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("saves draft content", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useDocumentSave("my-repo", "docs/file.md"))

    await act(async () => {
      await result.current.save("# Updated content")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/my-repo/draft/docs/file.md",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "# Updated content" }),
      }),
    )
    expect(result.current.saving).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("sets error on save failure", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocumentSave("repo", "file.md"))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.save("content")
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught).toBeDefined()
    expect(result.current.error).toContain("500")
  })

  it("publishes draft", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useDocumentSave("repo", "file.md"))

    await act(async () => {
      await result.current.publish()
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/draft/publish/file.md",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("deletes draft", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useDocumentSave("repo", "file.md"))

    await act(async () => {
      await result.current.deleteDraft()
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/draft/file.md",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("does nothing when repoSlug is empty", async () => {
    const { result } = renderHook(() => useDocumentSave("", "file.md"))

    await act(async () => {
      await result.current.save("content")
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("does nothing when filePath is empty", async () => {
    const { result } = renderHook(() => useDocumentSave("repo", ""))

    await act(async () => {
      await result.current.save("content")
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("sets error on publish failure", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocumentSave("repo", "file.md"))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.publish()
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught).toBeDefined()
    expect(result.current.error).toContain("Failed to publish")
    expect(result.current.publishing).toBe(false)
  })

  it("sets error on deleteDraft failure", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocumentSave("repo", "file.md"))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.deleteDraft()
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught).toBeDefined()
    expect(result.current.error).toContain("Failed to discard draft")
  })

  it("publish does nothing when repoSlug is empty", async () => {
    const { result } = renderHook(() => useDocumentSave("", "file.md"))

    await act(async () => {
      await result.current.publish()
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("deleteDraft does nothing when filePath is empty", async () => {
    const { result } = renderHook(() => useDocumentSave("repo", ""))

    await act(async () => {
      await result.current.deleteDraft()
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })
})
