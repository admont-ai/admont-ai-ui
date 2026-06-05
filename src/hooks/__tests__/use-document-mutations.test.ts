import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  buildDocumentUrl,
  buildFolderUrl,
  buildRenameUrl,
  assetFolderPath,
  useDocumentMutations,
} from "@/hooks/use-document-mutations"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("buildDocumentUrl", () => {
  it("builds URL with encoded repo slug", () => {
    expect(buildDocumentUrl("my-repo", "docs/file.md")).toBe(
      "/repos/my-repo/file/docs/file.md",
    )
  })

  it("encodes special characters in repo slug", () => {
    expect(buildDocumentUrl("repo with spaces", "file.md")).toBe(
      "/repos/repo%20with%20spaces/file/file.md",
    )
  })

  it("handles root-level file path", () => {
    expect(buildDocumentUrl("repo", "README.md")).toBe("/repos/repo/file/README.md")
  })
})

describe("buildFolderUrl", () => {
  it("builds folder URL", () => {
    expect(buildFolderUrl("my-repo", "docs/subfolder")).toBe(
      "/repos/my-repo/folder/docs/subfolder",
    )
  })

  it("encodes special characters in repo slug", () => {
    expect(buildFolderUrl("a/b", "path")).toBe("/repos/a%2Fb/folder/path")
  })
})

describe("buildRenameUrl", () => {
  it("builds rename URL", () => {
    expect(buildRenameUrl("repo", "docs/old.md")).toBe(
      "/repos/repo/rename/docs/old.md",
    )
  })

  it("encodes special characters in repo slug", () => {
    expect(buildRenameUrl("my repo", "file.md")).toBe(
      "/repos/my%20repo/rename/file.md",
    )
  })
})

describe("assetFolderPath", () => {
  it("derives hidden asset folder for simple filename", () => {
    expect(assetFolderPath("example.md")).toBe(".example")
  })

  it("derives hidden asset folder for file in directory", () => {
    expect(assetFolderPath("Folder/example.md")).toBe("Folder/.example")
  })

  it("derives hidden asset folder for deeply nested file", () => {
    expect(assetFolderPath("a/b/c/doc.md")).toBe("a/b/c/.doc")
  })

  it("strips .md extension case-insensitively", () => {
    expect(assetFolderPath("Notes.MD")).toBe(".Notes")
  })

  it("handles filename without .md extension", () => {
    expect(assetFolderPath("file.txt")).toBe(".file.txt")
  })

  it("handles filename with no directory", () => {
    expect(assetFolderPath("README.md")).toBe(".README")
  })
})

describe("useDocumentMutations", () => {
  const onMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a document and calls onMutate", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ path: "docs/new.md" }), { status: 201 }),
    )

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let path: string = ""
    await act(async () => {
      path = await result.current.createDocument("docs", "new.md", "# New")
    })

    expect(path).toBe("docs/new.md")
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/file/docs/new.md",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "# New" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("creates a document at root when folderPath is empty", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ path: "root.md" }), { status: 201 }),
    )

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    await act(async () => {
      await result.current.createDocument("", "root.md")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/file/root.md",
      expect.anything(),
    )
  })

  it("deletes a document and its asset folder", async () => {
    mockAuthFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    await act(async () => {
      await result.current.deleteDocument("docs/file.md")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/file/docs/file.md",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/folder/docs/.file",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("deleteDocument succeeds even if asset folder delete fails", async () => {
    mockAuthFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockRejectedValueOnce(new Error("not found"))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    await act(async () => {
      await result.current.deleteDocument("file.md")
    })

    expect(onMutate).toHaveBeenCalled()
  })

  it("moves a document", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 200 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    await act(async () => {
      await result.current.moveDocument("old/path.md", "new/path.md")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/file/old/path.md",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ destination: "new/path.md" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("renames a document", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ path: "docs/renamed.md" }), { status: 200 }),
    )

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let newPath: string = ""
    await act(async () => {
      newPath = await result.current.renameDocument("docs/old.md", "renamed.md")
    })

    expect(newPath).toBe("docs/renamed.md")
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/rename/docs/old.md",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ name: "renamed.md" }),
      }),
    )
    expect(onMutate).toHaveBeenCalled()
  })

  it("throws on failed create", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.createDocument("", "file.md")
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught?.message).toContain("Failed to create document")
    expect(onMutate).not.toHaveBeenCalled()
  })

  it("throws on failed delete", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.deleteDocument("file.md")
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught?.message).toContain("Failed to delete document")
  })

  it("throws on failed move", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 403 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.moveDocument("a.md", "b.md")
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught?.message).toContain("Failed to move document")
  })

  it("throws on failed rename", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 409 }))

    const { result } = renderHook(() => useDocumentMutations("repo", onMutate))

    let caught: Error | undefined
    await act(async () => {
      try {
        await result.current.renameDocument("a.md", "b.md")
      } catch (e) {
        caught = e as Error
      }
    })

    expect(caught?.message).toContain("Failed to rename document")
  })
})
