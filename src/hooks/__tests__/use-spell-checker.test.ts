import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSpellChecker } from "@/hooks/use-spell-checker"

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { authFetch } from "@/lib/auth-fetch"

const mockAuthFetch = vi.mocked(authFetch)

describe("useSpellChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends text to checker endpoint", async () => {
    const annotations = [
      {
        offset: 0,
        length: 4,
        message: "Possible spelling mistake",
        short_message: "Spelling",
        rule_id: "SPELL",
        category: "TYPOS",
        type: "spelling" as const,
        replacements: ["Test"],
      },
    ]
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ annotations, language: "en" }), { status: 200 }),
    )

    const { result } = renderHook(() => useSpellChecker())
    let response: { type: string }[] = []

    await act(async () => {
      response = await result.current.check("tset text")
    })

    expect(response).toHaveLength(1)
    expect(response[0].type).toBe("spelling")
    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/checker",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "tset text", language: "auto" }),
      }),
    )
  })

  it("passes custom language", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ annotations: [], language: "de" }), { status: 200 }),
    )

    const { result } = renderHook(() => useSpellChecker())

    await act(async () => {
      await result.current.check("Hallo Welt", "de")
    })

    expect(mockAuthFetch).toHaveBeenCalledWith(
      "/checker",
      expect.objectContaining({
        body: JSON.stringify({ text: "Hallo Welt", language: "de" }),
      }),
    )
  })

  it("returns empty array on error", async () => {
    mockAuthFetch.mockResolvedValue(new Response("", { status: 500 }))

    const { result } = renderHook(() => useSpellChecker())
    let response: unknown[] = []

    await act(async () => {
      response = await result.current.check("text")
    })

    expect(response).toEqual([])
  })

  it("returns empty array on abort", async () => {
    const abortError = new DOMException("Aborted", "AbortError")
    mockAuthFetch.mockRejectedValue(abortError)

    const { result } = renderHook(() => useSpellChecker())
    let response: unknown[] = []

    await act(async () => {
      response = await result.current.check("text")
    })

    expect(response).toEqual([])
  })

  it("returns empty array when annotations is null", async () => {
    mockAuthFetch.mockResolvedValue(
      new Response(JSON.stringify({ annotations: null, language: "en" }), { status: 200 }),
    )

    const { result } = renderHook(() => useSpellChecker())
    let response: unknown[] = []

    await act(async () => {
      response = await result.current.check("text")
    })

    expect(response).toEqual([])
  })
})
