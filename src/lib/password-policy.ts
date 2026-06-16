export interface PasswordPolicy {
  min_length: number
  require_uppercase: boolean
  require_lowercase: boolean
  require_digit: boolean
  require_symbol: boolean
}

let cache: PasswordPolicy | null = null

// getPasswordPolicy fetches the server-configured password complexity rules.
// The result is cached for the session. Returns null if unavailable.
export async function getPasswordPolicy(): Promise<PasswordPolicy | null> {
  if (cache) return cache
  try {
    const res = await fetch("/auth/internal/password-policy")
    if (!res.ok) return null
    cache = (await res.json()) as PasswordPolicy
    return cache
  } catch {
    return null
  }
}

// describePasswordPolicy returns a human-readable summary of the rules.
export function describePasswordPolicy(p: PasswordPolicy): string {
  const parts = [`at least ${p.min_length} characters`]
  if (p.require_uppercase) parts.push("an uppercase letter")
  if (p.require_lowercase) parts.push("a lowercase letter")
  if (p.require_digit) parts.push("a digit")
  if (p.require_symbol) parts.push("a symbol")
  return `Must contain ${parts.join(", ")}.`
}
