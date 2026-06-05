import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { convertToDocNode, useDocuments } from "@/hooks/use-documents"
import type { RepoTree } from "@/types"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("convertToDocNode", () => {
  it("converts a flat file tree", () => {
    const tree: RepoTree = {
      "README.md": 1024,
      "notes.txt": 256,
    }
    const result = convertToDocNode("my-repo", tree)
    expect(result).toEqual({
      name: "my-repo",
      type: "directory",
      children: [
        { name: "README.md", type: "file" },
        { name: "notes.txt", type: "file" },
      ],
    })
  })

  it("converts directories (keys starting with /)", () => {
    const tree: RepoTree = {
      "/docs": {
        "guide.md": 512,
      },
    }
    const result = convertToDocNode("repo", tree)
    expect(result).toEqual({
      name: "repo",
      type: "directory",
      children: [
        {
          name: "docs",
          type: "directory",
          children: [
            { name: "guide.md", type: "file" },
          ],
        },
      ],
    })
  })

  it("handles mixed files and directories", () => {
    const tree: RepoTree = {
      "README.md": 100,
      "/src": {
        "main.ts": 200,
        "/lib": {
          "utils.ts": 50,
        },
      },
    }
    const result = convertToDocNode("project", tree)
    expect(result.name).toBe("project")
    expect(result.type).toBe("directory")
    expect(result.children).toHaveLength(2)

    const readme = result.children!.find((c) => c.name === "README.md")
    expect(readme).toEqual({ name: "README.md", type: "file" })

    const src = result.children!.find((c) => c.name === "src")
    expect(src?.type).toBe("directory")
    expect(src?.children).toHaveLength(2)

    const lib = src?.children?.find((c) => c.name === "lib")
    expect(lib?.type).toBe("directory")
    expect(lib?.children).toEqual([{ name: "utils.ts", type: "file" }])
  })

  it("handles empty tree", () => {
    const tree: RepoTree = {}
    const result = convertToDocNode("empty", tree)
    expect(result).toEqual({
      name: "empty",
      type: "directory",
      children: [],
    })
  })

  it("handles deeply nested structure", () => {
    const tree: RepoTree = {
      "/a": {
        "/b": {
          "/c": {
            "deep.md": 1,
          },
        },
      },
    }
    const result = convertToDocNode("root", tree)
    const a = result.children![0]
    const b = a.children![0]
    const c = b.children![0]
    expect(c.children![0]).toEqual({ name: "deep.md", type: "file" })
  })
})

describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches and converts repo tree on mount", async () => {
    const apiTree: RepoTree = {
      "README.md": 100,
      "/docs": { "guide.md": 200 },
    }
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify(apiTree), { status: 200 }),
    )

    const { result } = renderHook(() => useDocuments("my-repo"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tree).not.toBeNull()
    expect(result.current.tree!.name).toBe("my-repo")
    expect(result.current.tree!.children).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it("sets error on fetch failure", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useDocuments("my-repo"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain("500")
    expect(result.current.tree).toBeNull()
  })

  it("resets tree when repoSlug is empty", () => {
    const { result } = renderHook(() => useDocuments(""))

    expect(result.current.tree).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("refresh re-fetches documents", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ "a.md": 1 }), { status: 200 }),
    )

    const { result } = renderHook(() => useDocuments("repo"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockAuthFetch).toHaveBeenCalledTimes(1)

    result.current.refresh()

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
  })

  it("calls correct API endpoint", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    renderHook(() => useDocuments("special repo"))

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())

    expect(mockAuthFetch).toHaveBeenCalledWith("/repos/special%20repo")
  })
})
