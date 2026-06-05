import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFolderOrder } from "@/hooks/use-folder-order"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useFolderOrder", () => {
  const onMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("saves order and calls onMutate on success", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useFolderOrder("repo", onMutate))

    await act(async () => {
      await result.current.saveOrder("docs", ["a.md", "b.md", "c.md"])
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/order/docs",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ order: ["a.md", "b.md", "c.md"] }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("uses root order URL for empty path", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useFolderOrder("repo", onMutate))

    await act(async () => {
      await result.current.saveOrder("", ["a.md"])
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/order/",
      expect.anything(),
    )
  })

  it("reverts optimistic update on failure", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useFolderOrder("repo", onMutate))

    await act(async () => {
      await result.current.saveOrder("dir", ["x", "y"])
    })

    expect(result.current.orderMap.has("dir")).toBe(false)
    expect(onMutate).not.toHaveBeenCalled()
  })

  it("does nothing when repoSlug is empty", async () => {
    const { result } = renderHook(() => useFolderOrder("", onMutate))

    await act(async () => {
      await result.current.saveOrder("dir", ["a"])
    })

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("reverts optimistic update on network error", async () => {
    mockAuthFetch.mockRejectedValue(new Error("network error"))

    const { result } = renderHook(() => useFolderOrder("repo", onMutate))

    await act(async () => {
      await result.current.saveOrder("dir", ["x", "y"])
    })

    expect(result.current.orderMap.has("dir")).toBe(false)
    expect(onMutate).not.toHaveBeenCalled()
  })

  it("sets optimistic order during save", async () => {
    let resolvePromise: (value: Response) => void
    const pending = new Promise<Response>((resolve) => {
      resolvePromise = resolve
    })
    mockAuthFetch.mockReturnValue(pending)

    const { result } = renderHook(() => useFolderOrder("repo", onMutate))

    act(() => {
      result.current.saveOrder("dir", ["a", "b"])
    })

    expect(result.current.orderMap.get("dir")).toEqual(["a", "b"])

    await act(async () => {
      resolvePromise!(new Response("", { status: 200 }))
    })

    expect(result.current.orderMap.has("dir")).toBe(false)
  })
})
