import { useRef, useState } from "react"

interface OtpInputProps {
  length?: number
  // onComplete fires once all boxes are filled (used for auto-submit).
  onComplete: (code: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

// OtpInput renders one box per digit with auto-advance, backspace handling, and
// paste support. It owns its state; remount it (via a changing `key`) to reset.
export function OtpInput({ length = 6, onComplete, disabled, autoFocus = true }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(i: number) {
    const el = refs.current[Math.max(0, Math.min(i, length - 1))]
    if (el) {
      el.focus()
      el.select()
    }
  }

  function apply(next: string[]) {
    setDigits(next)
    if (next.every((d) => d !== "")) {
      onComplete(next.join(""))
    }
  }

  function handleChange(i: number, raw: string) {
    const onlyDigits = raw.replace(/\D/g, "")
    const next = digits.slice()
    if (onlyDigits === "") {
      next[i] = ""
      setDigits(next)
      return
    }
    // Distribute (handles a multi-character value, e.g. autofill into one box).
    let idx = i
    for (const ch of onlyDigits) {
      if (idx >= length) break
      next[idx] = ch
      idx++
    }
    apply(next)
    focusBox(idx)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const next = digits.slice()
      if (digits[i] === "" && i > 0) {
        e.preventDefault()
        next[i - 1] = ""
        setDigits(next)
        focusBox(i - 1)
      } else {
        next[i] = ""
        setDigits(next)
      }
    } else if (e.key === "ArrowLeft") {
      focusBox(i - 1)
    } else if (e.key === "ArrowRight") {
      focusBox(i + 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!text) return
    e.preventDefault()
    const next = Array(length).fill("")
    for (let j = 0; j < text.length; j++) next[j] = text[j]
    apply(next)
    focusBox(text.length)
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className="size-11 rounded-md border border-input bg-transparent text-center text-lg font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  )
}
