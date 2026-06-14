import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave"

function setup(initial: string) {
  const save = vi.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() =>
    useDebouncedAutosave({ enabled: true, save, baseline: initial, delay: 1000, maxWait: 5000 }),
  )
  return { save, result }
}

describe("useDebouncedAutosave", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("debounces: saves once after the last change", async () => {
    const { save, result } = setup("a")

    await act(async () => {
      result.current.notifyChange("ab")
      vi.advanceTimersByTime(500)
      result.current.notifyChange("abc")
      vi.advanceTimersByTime(500) // 500ms since last change — not yet
    })
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(500) // now 1000ms since last change
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith("abc")
  })

  it("does not save when the value equals the baseline", async () => {
    const { save, result } = setup("a")
    await act(async () => {
      result.current.notifyChange("a") // unchanged
      vi.advanceTimersByTime(1000)
    })
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe("idle")
  })

  it("max-wait forces a save during continuous typing", async () => {
    const { save, result } = setup("a")
    await act(async () => {
      for (let i = 0; i < 6; i++) {
        result.current.notifyChange("a" + "x".repeat(i + 1))
        vi.advanceTimersByTime(900) // never lets the 1s debounce fire on its own
      }
    })
    // 6 * 900ms = 5400ms > maxWait(5000) → at least one forced save happened.
    expect(save).toHaveBeenCalled()
  })

  it("coalesces: no overlapping saves; a change during a save triggers one follow-up", async () => {
    let resolveSave: () => void = () => {}
    const save = vi.fn().mockImplementation(
      () => new Promise<void>((res) => { resolveSave = res }),
    )
    const { result } = renderHook(() =>
      useDebouncedAutosave({ enabled: true, save, baseline: "a", delay: 1000, maxWait: 5000 }),
    )

    await act(async () => {
      result.current.notifyChange("ab")
      vi.advanceTimersByTime(1000) // first save starts (in flight)
    })
    expect(save).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.notifyChange("abc")
      vi.advanceTimersByTime(1000) // would flush, but a save is in flight → queued
    })
    expect(save).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave()
      await Promise.resolve()
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith("abc")
  })

  it("flush() saves the latest change immediately", async () => {
    const { save, result } = setup("a")
    await act(async () => {
      result.current.notifyChange("ab")
      await result.current.flush()
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith("ab")
  })

  it("keeps error status on save failure", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"))
    const { result } = renderHook(() =>
      useDebouncedAutosave({ enabled: true, save, baseline: "a", delay: 1000, maxWait: 5000 }),
    )
    await act(async () => {
      result.current.notifyChange("ab")
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe("error")
  })

  it("ignores changes when disabled", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDebouncedAutosave({ enabled: false, save, baseline: "a", delay: 1000, maxWait: 5000 }),
    )
    await act(async () => {
      result.current.notifyChange("ab")
      vi.advanceTimersByTime(2000)
    })
    expect(save).not.toHaveBeenCalled()
  })
})
