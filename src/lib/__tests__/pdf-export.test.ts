import { describe, it, expect, vi, beforeEach } from "vitest"
import { collectMarkdownFiles, resolveImages, resolveBlobUrls, printHtml } from "@/lib/pdf-export"
import type { DocNode } from "@/types"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("collectMarkdownFiles", () => {
  const tree: DocNode = {
    name: "root",
    type: "directory",
    children: [
      { name: "README.md", type: "file" },
      { name: "image.png", type: "file" },
      {
        name: "docs",
        type: "directory",
        children: [
          { name: "guide.md", type: "file" },
          { name: "api.MD", type: "file" },
          { name: "notes.txt", type: "file" },
          {
            name: "advanced",
            type: "directory",
            children: [
              { name: "deep.md", type: "file" },
            ],
          },
        ],
      },
      {
        name: "empty",
        type: "directory",
        children: [],
      },
    ],
  }

  it("collects all .md files from root", () => {
    const paths = collectMarkdownFiles(tree, "")
    expect(paths).toEqual([
      "README.md",
      "docs/guide.md",
      "docs/api.MD",
      "docs/advanced/deep.md",
    ])
  })

  it("collects .md files from a specific subfolder", () => {
    const paths = collectMarkdownFiles(tree, "docs")
    expect(paths).toEqual([
      "docs/guide.md",
      "docs/api.MD",
      "docs/advanced/deep.md",
    ])
  })

  it("collects .md files from a nested subfolder", () => {
    const paths = collectMarkdownFiles(tree, "docs/advanced")
    expect(paths).toEqual(["docs/advanced/deep.md"])
  })

  it("returns empty array for folder with no .md files", () => {
    const paths = collectMarkdownFiles(tree, "empty")
    expect(paths).toEqual([])
  })

  it("returns empty array for nonexistent folder", () => {
    const paths = collectMarkdownFiles(tree, "nonexistent/path")
    expect(paths).toEqual([])
  })

  it("skips non-md files", () => {
    const paths = collectMarkdownFiles(tree, "")
    expect(paths).not.toContain("image.png")
    expect(paths).not.toContain("docs/notes.txt")
  })

  it("handles tree with no children", () => {
    const leafTree: DocNode = { name: "leaf", type: "file" }
    expect(collectMarkdownFiles(leafTree, "")).toEqual([])
  })

  it("is case-insensitive for .md extension", () => {
    const paths = collectMarkdownFiles(tree, "docs")
    expect(paths).toContain("docs/api.MD")
  })
})

describe("resolveImages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips images with no src", async () => {
    const container = document.createElement("div")
    container.innerHTML = '<img alt="no src">'

    await resolveImages(container, "repo", "docs/")

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  it("skips images with data: URLs", async () => {
    const container = document.createElement("div")
    container.innerHTML = '<img src="data:image/png;base64,abc">'

    await resolveImages(container, "repo", "docs/")

    expect(mockAuthFetch).not.toHaveBeenCalled()
  })

  function mockBlobResponse() {
    const blob = new Blob(["fake-image"], { type: "image/png" })
    return {
      ok: true,
      blob: () => Promise.resolve(blob),
    } as unknown as Response
  }

  it("resolves relative image paths via authFetch", async () => {
    mockAuthFetch.mockResolvedValue(mockBlobResponse())

    const container = document.createElement("div")
    container.innerHTML = '<img src="./images/photo.png">'

    await resolveImages(container, "my-repo", "docs/")

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/my-repo/file/docs/images/photo.png",
    )
  })

  it("resolves relative path without ./ prefix", async () => {
    mockAuthFetch.mockResolvedValue(mockBlobResponse())

    const container = document.createElement("div")
    container.innerHTML = '<img src="assets/img.png">'

    await resolveImages(container, "repo", "folder/")

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/repos/repo/file/folder/assets/img.png",
    )
  })

  it("passes absolute URLs directly to authFetch", async () => {
    mockAuthFetch.mockResolvedValue(mockBlobResponse())

    const container = document.createElement("div")
    container.innerHTML = '<img src="https://example.com/img.png">'

    await resolveImages(container, "repo", "docs/")

    expect(mockAuthFetch).toHaveBeenCalledWith("https://example.com/img.png")
  })

  it("passes root-relative URLs directly to authFetch", async () => {
    mockAuthFetch.mockResolvedValue(mockBlobResponse())

    const container = document.createElement("div")
    container.innerHTML = '<img src="/static/img.png">'

    await resolveImages(container, "repo", "docs/")

    expect(mockAuthFetch).toHaveBeenCalledWith("/static/img.png")
  })

  it("keeps original src on fetch failure", async () => {
    mockAuthFetch.mockResolvedValue({ ok: false } as Response)

    const container = document.createElement("div")
    container.innerHTML = '<img src="missing.png">'

    await resolveImages(container, "repo", "docs/")

    const img = container.querySelector("img")!
    expect(img.getAttribute("src")).toBe("missing.png")
  })

  it("handles multiple images", async () => {
    mockAuthFetch.mockResolvedValue(mockBlobResponse())

    const container = document.createElement("div")
    container.innerHTML = '<img src="a.png"><img src="b.png"><img src="data:image/png;base64,x">'

    await resolveImages(container, "repo", "")

    expect(mockAuthFetch).toHaveBeenCalledTimes(2)
  })

  it("keeps original src on network error", async () => {
    mockAuthFetch.mockRejectedValue(new Error("network"))

    const container = document.createElement("div")
    container.innerHTML = '<img src="img.png">'

    await resolveImages(container, "repo", "docs/")

    const img = container.querySelector("img")!
    expect(img.getAttribute("src")).toBe("img.png")
  })
})

describe("resolveBlobUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips non-blob URLs", async () => {
    const container = document.createElement("div")
    container.innerHTML = '<img src="https://example.com/img.png"><img src="data:image/png;base64,x">'

    await resolveBlobUrls(container)
  })

  it("skips images with no src", async () => {
    const container = document.createElement("div")
    container.innerHTML = '<img alt="empty">'

    await resolveBlobUrls(container)
  })

  it("handles empty container", async () => {
    const container = document.createElement("div")
    await resolveBlobUrls(container)
  })
})

describe("printHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates an iframe, writes HTML, and triggers print", async () => {
    const printFn = vi.fn()
    const writeFn = vi.fn()
    const closeFn = vi.fn()

    const mockDoc = {
      open: vi.fn(),
      write: writeFn,
      close: closeFn,
      readyState: "complete",
    }
    const mockWindow = {
      print: printFn,
      onafterprint: null as (() => void) | null,
      addEventListener: vi.fn(),
    }
    const mockIframe = {
      style: {} as Record<string, string>,
      contentDocument: mockDoc,
      contentWindow: mockWindow,
    }

    vi.spyOn(document, "createElement").mockReturnValue(mockIframe as unknown as HTMLElement)
    vi.spyOn(document.body, "appendChild").mockImplementation(() => null as unknown as Node)
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as unknown as Node)

    vi.useFakeTimers()

    const promise = printHtml("<h1>Hello</h1>", "Test Doc")

    // triggerPrint has a 300ms delay
    await vi.advanceTimersByTimeAsync(300)

    expect(printFn).toHaveBeenCalled()
    expect(writeFn).toHaveBeenCalledWith(expect.stringContaining("<h1>Hello</h1>"))
    expect(writeFn).toHaveBeenCalledWith(expect.stringContaining("Test Doc"))

    // Fallback cleanup after 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    // cleanup setTimeout 100ms
    await vi.advanceTimersByTimeAsync(100)

    await promise

    vi.useRealTimers()
  })

  it("escapes HTML in the title", async () => {
    const writeFn = vi.fn()
    const mockDoc = {
      open: vi.fn(),
      write: writeFn,
      close: vi.fn(),
      readyState: "complete",
    }
    const mockWindow = {
      print: vi.fn(),
      onafterprint: null as (() => void) | null,
      addEventListener: vi.fn(),
    }
    const mockIframe = {
      style: {} as Record<string, string>,
      contentDocument: mockDoc,
      contentWindow: mockWindow,
    }

    vi.spyOn(document, "createElement").mockReturnValue(mockIframe as unknown as HTMLElement)
    vi.spyOn(document.body, "appendChild").mockImplementation(() => null as unknown as Node)
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as unknown as Node)

    vi.useFakeTimers()

    const promise = printHtml("", '<script>alert("xss")</script>')

    await vi.advanceTimersByTimeAsync(1500)
    await promise

    const written = writeFn.mock.calls[0][0] as string
    expect(written).toContain("&lt;script&gt;")
    expect(written).not.toContain("<script>")

    vi.useRealTimers()
  })
})
