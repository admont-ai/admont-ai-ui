import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500")
  })

  it("merges multiple classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2")
  })

  it("handles conditional classes via clsx syntax", () => {
    const showHidden = false
    const showVisible = true
    expect(cn("base", showHidden && "hidden", "extra")).toBe("base extra")
    expect(cn("base", showVisible && "visible")).toBe("base visible")
  })

  it("resolves conflicting tailwind classes (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("merges object syntax", () => {
    expect(cn({ "bg-red-500": true, "text-white": false })).toBe("bg-red-500")
  })

  it("handles array syntax", () => {
    expect(cn(["px-2", "py-2"])).toBe("px-2 py-2")
  })

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("")
  })

  it("ignores undefined, null, and false", () => {
    expect(cn(undefined, null, false, "valid")).toBe("valid")
  })

  it("merges complex conflicting utilities", () => {
    expect(cn("p-4", "px-6")).toBe("p-4 px-6")
    expect(cn("rounded-lg", "rounded-sm")).toBe("rounded-sm")
  })
})
