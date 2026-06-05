import { describe, it, expect } from "vitest"
import { decodeJwtPayload, permissionsFromRoles } from "@/contexts/auth-context"

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const token = makeJwt({ email: "user@test.com", name: "Test User", exp: 1700000000 })
    const payload = decodeJwtPayload(token)
    expect(payload.email).toBe("user@test.com")
    expect(payload.name).toBe("Test User")
    expect(payload.exp).toBe(1700000000)
  })

  it("handles base64url characters (- and _)", () => {
    const token = makeJwt({ data: "special chars: +/=" })
    const payload = decodeJwtPayload(token)
    expect(payload.data).toBe("special chars: +/=")
  })

  it("throws on invalid token", () => {
    expect(() => decodeJwtPayload("not-a-jwt")).toThrow()
  })

  it("throws on malformed base64", () => {
    expect(() => decodeJwtPayload("header.!!!invalid!!!.signature")).toThrow()
  })
})

describe("permissionsFromRoles", () => {
  it("grants admin from admin role", () => {
    const perms = permissionsFromRoles(["admin"])
    expect(perms.admin).toBe(true)
    expect(perms.repo_admin).toBe(true)
  })

  it("grants admin from system_admin role", () => {
    const perms = permissionsFromRoles(["system_admin"])
    expect(perms.admin).toBe(true)
    expect(perms.repo_admin).toBe(true)
  })

  it("grants repo_admin from repo_admin role", () => {
    const perms = permissionsFromRoles(["repo_admin"])
    expect(perms.admin).toBe(false)
    expect(perms.repo_admin).toBe(true)
  })

  it("grants ai_user from ai_user role", () => {
    const perms = permissionsFromRoles(["ai_user"])
    expect(perms.ai_user).toBe(true)
    expect(perms.admin).toBe(false)
  })

  it("handles multiple roles", () => {
    const perms = permissionsFromRoles(["ai_user", "repo_admin"])
    expect(perms.ai_user).toBe(true)
    expect(perms.repo_admin).toBe(true)
    expect(perms.admin).toBe(false)
  })

  it("returns all false for empty roles", () => {
    const perms = permissionsFromRoles([])
    expect(perms.admin).toBe(false)
    expect(perms.repo_admin).toBe(false)
    expect(perms.ai_user).toBe(false)
    expect(perms.roles).toEqual([])
  })

  it("preserves raw roles array", () => {
    const roles = ["admin", "ai_user", "custom_role"]
    const perms = permissionsFromRoles(roles)
    expect(perms.roles).toEqual(roles)
  })

  it("does not grant ai_user to admin by default", () => {
    const perms = permissionsFromRoles(["admin"])
    expect(perms.ai_user).toBe(false)
  })
})
