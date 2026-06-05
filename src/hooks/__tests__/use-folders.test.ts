import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFolders } from "@/hooks/use-folders"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useFolders", () => {
  const onMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a folder", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 201 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await act(async () => {
      await result.current.createFolder("parent", "new-folder")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder/parent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "new-folder" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("renames a folder", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await act(async () => {
      await result.current.updateFolder("old-folder", "renamed")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder/old-folder",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "renamed" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("deletes a folder", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await act(async () => {
      await result.current.deleteFolder("to-delete")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder/to-delete",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("moves a folder", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await act(async () => {
      await result.current.moveFolder("source", "destination")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder/source",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ destination: "destination" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("throws on failed create", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await expect(
      act(async () => {
        await result.current.createFolder("parent", "name")
      }),
    ).rejects.toThrow("Failed to create folder")
  })

  it("builds root folder URL when parentPath is empty", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 201 }))

    const { result } = renderHook(() => useFolders("repo", onMutate))

    await act(async () => {
      await result.current.createFolder("", "root-folder")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder",
      expect.anything(),
    )
  })
})
