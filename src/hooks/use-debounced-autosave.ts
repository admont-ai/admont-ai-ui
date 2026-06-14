import { useCallback, useEffect, useRef, useState } from "react"

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

interface UseDebouncedAutosaveOptions {
  /** When false, change notifications are ignored and timers are cleared. */
  enabled: boolean
  /** Persists the value. Should reject on failure. */
  save: (value: string) => Promise<void>
  /** Last known persisted value; no save fires while the value equals it. */
  baseline: string
  /** Trailing debounce delay in ms (save this long after the last change). */
  delay?: number
  /** Max time a pending change may wait before a save is forced, in ms. */
  maxWait?: number
}

interface UseDebouncedAutosaveResult {
  status: AutosaveStatus
  lastSavedAt: number | null
  /** Call on every editor change with the current value. */
  notifyChange: (value: string) => void
  /** Force any pending save to run now. */
  flush: () => Promise<void>
}

/**
 * Debounced autosave with a max-wait ceiling, baseline dirty-tracking, and
 * single-flight coalescing (never overlaps saves; a change during a save
 * queues exactly one follow-up). The value to save is captured from each
 * change notification (not read back from the editor), so flushing on
 * teardown persists the last edits even after the editor unmounts.
 */
export function useDebouncedAutosave({
  enabled,
  save,
  baseline,
  delay = 1000,
  maxWait = 5000,
}: UseDebouncedAutosaveOptions): UseDebouncedAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const saveRef = useRef(save)
  saveRef.current = save

  const latestRef = useRef(baseline)    // most recent value seen
  const lastSavedRef = useRef(baseline) // most recent persisted value
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const pendingRef = useRef(false)

  // Reset baselines when the underlying document changes (file switch /
  // external refetch). Any pending change for the old doc is dropped.
  useEffect(() => {
    latestRef.current = baseline
    lastSavedRef.current = baseline
  }, [baseline])

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (maxWaitTimer.current) clearTimeout(maxWaitTimer.current)
    debounceTimer.current = null
    maxWaitTimer.current = null
  }, [])

  const flush = useCallback(async () => {
    clearTimers()
    const value = latestRef.current
    if (value === lastSavedRef.current) {
      if (!savingRef.current) setStatus((s) => (s === "saving" ? s : "idle"))
      return
    }
    if (savingRef.current) {
      pendingRef.current = true // a save is running — queue one follow-up
      return
    }

    savingRef.current = true
    setStatus("saving")
    try {
      await saveRef.current(value)
      lastSavedRef.current = value
      setLastSavedAt(Date.now())
      setStatus("saved")
    } catch {
      setStatus("error") // stays dirty; retried on next change/flush
    } finally {
      savingRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void flush() // re-run for changes that arrived during the save
      }
    }
  }, [clearTimers])

  const notifyChange = useCallback((value: string) => {
    if (!enabled) return
    latestRef.current = value
    if (value === lastSavedRef.current) return // no-op change (e.g. mode-switch round-trip)
    setStatus("dirty")
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => void flush(), delay)
    if (!maxWaitTimer.current) {
      maxWaitTimer.current = setTimeout(() => void flush(), maxWait)
    }
  }, [enabled, delay, maxWait, flush])

  // Flush pending work on teardown / when disabled.
  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }
    return () => {
      void flush()
    }
  }, [enabled, flush, clearTimers])

  // Warn on tab close if there is unsaved work.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [status])

  return { status, lastSavedAt, notifyChange, flush }
}
