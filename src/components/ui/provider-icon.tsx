/**
 * Inline SVG icons for known auth providers.
 * Using inline SVGs avoids external dependencies and works offline.
 */

interface ProviderIconProps {
  provider: string
  className?: string
}

export function ProviderIcon({ provider, className = "size-4" }: ProviderIconProps) {
  if (!provider) return null
  const key = provider.toLowerCase()
  const Icon = PROVIDER_ICONS[key]
  if (Icon) return <Icon className={className} />
  // Fallback: generic key icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

export function formatProviderName(provider: string): string {
  const known: Record<string, string> = {
    google: "Google",
    github: "GitHub",
    gitlab: "GitLab",
    microsoft: "Microsoft",
    microsoftonline: "Microsoft",
    azureadv2: "Azure AD v2",
    okta: "Okta",
    apple: "Apple",
    facebook: "Facebook",
    discord: "Discord",
    slack: "Slack",
    bitbucket: "Bitbucket",
    linkedin: "LinkedIn",
    cognito: "AWS Cognito",
    internal: "Internal User",
    hydra: "Internal User",
    oidc: "OpenID Connect",
    openidconnect: "OpenID Connect",
    keycloak: "Keycloak",
    auth0: "Auth0",
    azure: "Microsoft Azure",
  }
  if (!provider) return "Unknown"
  return known[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

/** Try to guess which provider issued a JWT based on the `iss` claim URL */
export function providerFromIssuer(iss: string | undefined): string | null {
  if (!iss) return null
  const lower = iss.toLowerCase()
  if (lower.includes("accounts.google.com") || lower.includes("googleapis.com")) return "google"
  if (lower.includes("github.com")) return "github"
  if (lower.includes("gitlab.com") || lower.includes("gitlab")) return "gitlab"
  if (lower.includes("login.microsoftonline.com") || lower.includes("microsoft")) return "microsoftonline"
  if (lower.includes("okta.com") || lower.includes("okta")) return "okta"
  if (lower.includes("appleid.apple.com")) return "apple"
  if (lower.includes("facebook.com")) return "facebook"
  if (lower.includes("discord.com")) return "discord"
  if (lower.includes("slack.com")) return "slack"
  if (lower.includes("bitbucket.org")) return "bitbucket"
  if (lower.includes("linkedin.com")) return "linkedin"
  if (lower.includes("cognito") || lower.includes("amazonaws.com")) return "cognito"
  if (lower.includes("hydra") || lower.includes("ory")) return "hydra"
  if (lower.includes("keycloak")) return "keycloak"
  if (lower.includes("auth0.com") || lower.includes("auth0")) return "auth0"
  return null
}

// ── SVG Icon Components ──────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.1.75-.24.75-.53v-1.85c-3.07.67-3.72-1.48-3.72-1.48-.5-1.28-1.23-1.62-1.23-1.62-1-.69.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.98 1.69 2.58 1.2 3.21.92.1-.71.39-1.2.7-1.47-2.45-.28-5.03-1.23-5.03-5.47 0-1.21.43-2.2 1.14-2.97-.12-.28-.49-1.4.1-2.93 0 0 .93-.3 3.05 1.13a10.6 10.6 0 0 1 5.55 0c2.12-1.43 3.05-1.13 3.05-1.13.6 1.53.23 2.65.11 2.93.71.77 1.14 1.76 1.14 2.97 0 4.25-2.59 5.19-5.05 5.46.4.34.75 1.02.75 2.05v3.04c0 .3.2.64.75.53A11 11 0 0 0 12 1.27" />
    </svg>
  )
}

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="m12 22.172-4.383-13.49h8.766z" fill="#E24329" />
      <path d="m12 22.172-4.383-13.49H1.283z" fill="#FC6D26" />
      <path d="M1.283 8.683.14 12.2a.78.78 0 0 0 .283.87L12 22.172z" fill="#FCA326" />
      <path d="M1.283 8.683h6.334L5.06 1.39a.39.39 0 0 0-.742 0z" fill="#E24329" />
      <path d="m12 22.172 4.383-13.49h6.334z" fill="#FC6D26" />
      <path d="m22.717 8.683 1.143 3.517a.78.78 0 0 1-.283.87L12 22.172z" fill="#FCA326" />
      <path d="M22.717 8.683h-6.334l2.557-7.293a.39.39 0 0 1 .742 0z" fill="#E24329" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  )
}

function OktaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#007DC1" />
    </svg>
  )
}

function KeycloakIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.5 2h-13L2 12l3.5 10h13L22 12zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
    </svg>
  )
}

function OidcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#5865F2" />
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E" />
    </svg>
  )
}

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646L24.012 2.104a.768.768 0 0 0-.768-.892zm13.736 14.698H9.55l-1.154-6.59h6.333l-1.215 6.59z" fill="#2684FF" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2" />
    </svg>
  )
}

function CognitoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#DD344C" />
      <path d="M12 2v20l10-5V7L12 2z" fill="#A4243A" opacity="0.8" />
      <circle cx="12" cy="10" r="3" fill="white" />
      <path d="M7 17c0-2.76 2.24-5 5-5s5 2.24 5 5" fill="white" />
    </svg>
  )
}


function Auth0Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M18.34 4.24L12 1.5 5.66 4.24 3.82 10.5l1.84 6.26L12 22.5l6.34-5.74 1.84-6.26-1.84-6.26zM12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" fill="#EB5424" />
    </svg>
  )
}

function InternalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18L19 6.3v4.7c0 4.83-3.13 9.37-7 10.5-3.87-1.13-7-5.67-7-10.5V6.3l7-3.12zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-4 9c0-1.66 2.69-3 4-3s4 1.34 4 3v1H8v-1z" />
    </svg>
  )
}

const PROVIDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
  google: GoogleIcon,
  github: GitHubIcon,
  gitlab: GitLabIcon,
  microsoft: MicrosoftIcon,
  microsoftonline: MicrosoftIcon,
  azureadv2: MicrosoftIcon,
  azure: MicrosoftIcon,
  apple: AppleIcon,
  okta: OktaIcon,
  keycloak: KeycloakIcon,
  oidc: OidcIcon,
  openidconnect: OidcIcon,
  facebook: FacebookIcon,
  discord: DiscordIcon,
  slack: SlackIcon,
  bitbucket: BitbucketIcon,
  linkedin: LinkedInIcon,
  cognito: CognitoIcon,
  hydra: InternalIcon,
  auth0: Auth0Icon,
  internal: InternalIcon,
}

// ── LLM Provider Icons ─────────────────────────────────────────────

export function LlmProviderIcon({ provider, className = "size-4" }: ProviderIconProps) {
  if (!provider) return null
  const key = provider.toLowerCase().replace(/[\s_-]/g, "")
  const Icon = LLM_PROVIDER_ICONS[key]
  if (Icon) return <Icon className={className} />
  // Fallback: generic bot icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  )
}

export function formatLlmProviderName(provider: string): string {
  const known: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
    gemini: "Google Gemini",
    mistral: "Mistral AI",
    meta: "Meta Llama",
    llama: "Meta Llama",
    cohere: "Cohere",
    groq: "Groq",
    perplexity: "Perplexity",
    deepseek: "DeepSeek",
    together: "Together AI",
    fireworks: "Fireworks AI",
    ollama: "Ollama",
    azure_openai: "Azure OpenAI",
    azureopenai: "Azure OpenAI",
    bedrock: "AWS Bedrock",
    vertexai: "Vertex AI",
    vertex: "Vertex AI",
    xai: "xAI",
  }
  if (!provider) return "Unknown"
  const key = provider.toLowerCase().replace(/[\s_-]/g, "")
  return known[key] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function AnthropicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.304 3.541h-3.483l6.15 16.918h3.483zm-10.608 0L.546 20.459H4.15l1.262-3.471h6.47l1.262 3.471h3.604L10.596 3.541zm.136 10.584L9 8.252l2.168 5.873z" />
    </svg>
  )
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12" fill="#4285F4" />
    </svg>
  )
}

function MistralIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="1" y="3" width="4" height="4" fill="#F7D046" />
      <rect x="19" y="3" width="4" height="4" fill="#F7D046" />
      <rect x="1" y="9" width="4" height="4" fill="#F2A73B" />
      <rect x="7" y="9" width="4" height="4" fill="#F2A73B" />
      <rect x="19" y="9" width="4" height="4" fill="#F2A73B" />
      <rect x="1" y="15" width="4" height="4" fill="#EE792F" />
      <rect x="7" y="15" width="4" height="4" fill="#EE792F" />
      <rect x="13" y="15" width="4" height="4" fill="#EE792F" />
      <rect x="19" y="15" width="4" height="4" fill="#EE792F" />
    </svg>
  )
}

function MetaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0668E1">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a4.892 4.892 0 0 0 1.564 2.611c.722.638 1.63.967 2.615.967 1.14 0 2.06-.395 2.845-.977.77-.57 1.392-1.318 1.96-2.05.49-.63.94-1.247 1.397-1.756.382-.425.774-.79 1.252-.952h.11c.478.162.87.527 1.252.952.458.509.908 1.127 1.397 1.756.568.732 1.19 1.48 1.96 2.05.786.582 1.705.977 2.845.977.986 0 1.893-.33 2.615-.967a4.892 4.892 0 0 0 1.564-2.611c.14-.604.21-1.267.21-1.973 0-2.566-.704-5.24-2.044-7.303C20.768 5.31 19.053 4.03 17.085 4.03c-1.263 0-2.238.46-3.065 1.078-.734.55-1.362 1.241-1.97 1.96-.479.563-.94 1.147-1.421 1.573h-.258c-.481-.426-.942-1.01-1.42-1.573-.61-.72-1.237-1.41-1.971-1.96-.827-.618-1.802-1.078-3.065-1.078zM6.88 5.57c1.56 0 2.832 1.14 3.97 2.496.902 1.076 1.706 2.346 2.26 3.209l.015.024.663 1.033a.476.476 0 0 0 .064.076c.07.07.15.12.243.127h.006c.092-.007.173-.058.243-.127a.476.476 0 0 0 .064-.076l.663-1.033.015-.024c.554-.863 1.358-2.133 2.26-3.209C18.288 6.71 19.56 5.57 21.12 5.57c1.338 0 2.58.953 3.552 2.46.937 1.454 1.568 3.473 1.568 5.539 0 1.173-.248 2.16-.818 2.865-.546.676-1.345 1.016-2.285 1.016-1.222 0-2.182-.56-3.03-1.27-.82-.688-1.534-1.553-2.197-2.358-.55-.668-.98-1.19-1.327-1.503-.283-.254-.485-.31-.583-.31s-.3.056-.583.31c-.347.312-.776.835-1.327 1.503-.663.805-1.377 1.67-2.197 2.358-.848.71-1.808 1.27-3.03 1.27-.94 0-1.74-.34-2.285-1.016-.57-.706-.818-1.692-.818-2.865 0-2.066.63-4.085 1.568-5.54.972-1.506 2.214-2.459 3.552-2.459z" />
    </svg>
  )
}

function CohereIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M9.315 3C5.818 3 3 5.818 3 9.315c0 3.498 2.818 6.316 6.315 6.316h2.842c.483 0 .875.392.875.875s-.392.875-.875.875H9.315A9.315 9.315 0 1 1 18.63 9.315v2.842a.875.875 0 0 1-1.75 0V9.315C16.88 5.818 14.063 3 10.565 3z" fill="#39594D" />
      <circle cx="17.755" cy="17.755" r="3.245" fill="#D18EE2" />
    </svg>
  )
}

function GroqIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
    </svg>
  )
}

function DeepSeekIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#4D6BFE">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18L19 8.5v7L12 19.82 5 15.5v-7L12 4.18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
    </svg>
  )
}

function OllamaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C8.686 2 6 4.686 6 8c0 1.636.655 3.12 1.716 4.204C6.068 13.328 5 15.052 5 17c0 2.761 3.134 5 7 5s7-2.239 7-5c0-1.948-1.068-3.672-2.716-4.796A5.98 5.98 0 0 0 18 8c0-3.314-2.686-6-6-6zm0 2c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm-2 8.535A5.975 5.975 0 0 0 12 13c.714 0 1.396-.17 2-.465C16.02 13.56 18 15.108 18 17c0 1.657-2.686 3-6 3s-6-1.343-6-3c0-1.892 1.98-3.44 4-4.465z" />
    </svg>
  )
}

function AzureOpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

function PerplexityIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2L4 6v4.5L2 12l2 1.5V18l8 4 8-4v-4.5l2-1.5-2-1.5V6l-8-4zm0 2.24L18 8v3.26l-6-3-6 3V8l6-3.76zM6 13.24l6 3 6-3V16l-6 3-6-3v-2.76z" />
    </svg>
  )
}

function FireworksIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#FF6B2B">
      <path d="M12 2v6m0 8v6m8-10h-6m-8 0H0m15.07-7.07l-4.24 4.24M8.93 13.17l-4.24 4.24m14.62 0l-4.24-4.24M8.93 10.83L4.69 6.59" stroke="#FF6B2B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="12" r="3" fill="#FF6B2B" />
    </svg>
  )
}

function TogetherIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0F6FFF">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="7" cy="17" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M7 10v4m10-4v4M10 7h4m-4 10h4" stroke="#0F6FFF" strokeWidth="1.5" />
    </svg>
  )
}

function BedrockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" fill="#FF9900" />
      <path d="M12 2v20l10-5V7L12 2z" fill="#EC7211" opacity="0.8" />
      <path d="M8 10l4-2 4 2v4l-4 2-4-2v-4z" fill="white" />
    </svg>
  )
}

function VertexIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ── Search Provider Icons ────────────────────────────────────────────

export function SearchProviderIcon({ provider, className = "size-4" }: ProviderIconProps) {
  if (!provider) return null
  const key = provider.toLowerCase().replace(/[\s_-]/g, "")
  const Icon = SEARCH_PROVIDER_ICONS[key]
  if (Icon) return <Icon className={className} />
  // Fallback: generic search icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function formatSearchProviderName(provider: string): string {
  const known: Record<string, string> = {
    meilisearch: "Meilisearch",
    elasticsearch: "Elasticsearch",
    opensearch: "OpenSearch",
    typesense: "Typesense",
    algolia: "Algolia",
    solr: "Apache Solr",
    qdrant: "Qdrant",
    weaviate: "Weaviate",
    pinecone: "Pinecone",
    chromadb: "ChromaDB",
    chroma: "ChromaDB",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    sqlite: "SQLite",
    bleve: "Bleve",
    tantivy: "Tantivy",
    zinc: "ZincSearch",
    zincsearch: "ZincSearch",
    manticore: "Manticore",
    pgvector: "PgVector",
  }
  if (!provider) return "Unknown"
  const key = provider.toLowerCase().replace(/[\s_-]/g, "")
  return known[key] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

function MeilisearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M6.319 20L1 4h4.629l3.27 10.246L12.54 4h4.665l3.477 10.246L23.612 4H28.3l-5.318 16h-4.665L14.7 9.754 11.083 20z" fill="#FF5CAA" transform="scale(0.857) translate(-1, 0)" />
    </svg>
  )
}

function ElasticsearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M13.5 11H22c.1-.6.2-1.3.2-2 0-5-4-9-9-9S4.1 4 4.1 9c0 .7.1 1.3.2 2h9.2z" fill="#FED10A" />
      <path d="M2 12c0 .7.1 1.3.2 2h19.6c.1-.7.2-1.3.2-2H2z" fill="#24BBB1" />
      <path d="M4.3 15c1.3 3.4 4.6 6 8.5 6 3.8 0 7.2-2.5 8.5-6H4.3z" fill="#3CBEB1" />
    </svg>
  )
}

function TypesenseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#D63AFF">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18L19 8.5v7L12 19.82 5 15.5v-7L12 4.18z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function AlgoliaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 5.4c.69 0 1.25.56 1.25 1.25v2.1a4.35 4.35 0 0 1 2.9 4.1c0 2.4-1.95 4.35-4.35 4.35S7.45 15.25 7.45 12.85c0-1.86 1.17-3.45 2.8-4.07V6.65c0-.69.56-1.25 1.25-1.25h.5z" fill="#5468FF" />
    </svg>
  )
}

function QdrantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#DC244C">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 3l6 3.5v7L12 19l-6-3.5v-7L12 5zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  )
}

function WeaviateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#01CC88">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14l-3-3 1.4-1.4L10 13.2l5.6-5.6L17 9l-7 7z" />
    </svg>
  )
}

function PineconeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#000">
      <path d="M12 2c-.55 0-1 .45-1 1v3.17a6.002 6.002 0 0 0-5 5.91c0 3.31 2.69 6 6 6s6-2.69 6-6a6.002 6.002 0 0 0-5-5.91V3c0-.55-.45-1-1-1zm0 6.08a3.92 3.92 0 1 1 0 7.84 3.92 3.92 0 0 1 0-7.84zM11 19v2c0 .55.45 1 1 1s1-.45 1-1v-2h-2z" />
    </svg>
  )
}

function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02A10.922 10.922 0 0 0 12.6.258C11.422.238 10.4.524 9.594 1 8.79.721 7.122.24 5.364.336 4.14.403 2.804.775 1.814 1.82.827 2.865.305 4.482.415 6.682c.03.607.203 1.597.49 2.879s.69 2.783 1.193 4.08c.503 1.296 1.016 2.304 1.66 3.03.322.363.734.71 1.227.876.493.167 1.09.124 1.558-.245.39-.306.66-.756.865-1.222a7.27 7.27 0 0 0 .399-1.181c.053.09.108.18.165.268.323.5.7.948 1.143 1.296.145.114.3.219.463.31-.206.6-.407 1.197-.563 1.666-.234.703-.39 1.258-.41 1.725-.01.236.02.464.114.69.094.227.28.455.586.608l.003.001a2.854 2.854 0 0 0 1.63.313c.652-.06 1.4-.316 2.145-.79.59-.376 1.067-.62 1.458-.995.39-.374.647-.836.766-1.438l.004-.02.023-.122a6.278 6.278 0 0 0 .09-1.005c.005-.327-.01-.671-.041-1.025a11.57 11.57 0 0 1-.003-.18c.022.002.044.005.066.006a3.93 3.93 0 0 0 2.865-.93c.375-.36.645-.795.822-1.236.177-.441.266-.88.266-1.324V8.382a8.573 8.573 0 0 0-.033-.466A9.357 9.357 0 0 0 21.5 2.883c-.466-.77-1.088-1.39-1.87-1.826A5.727 5.727 0 0 0 17.128 0" fill="#336791" transform="scale(1.05) translate(-0.6, 1)" />
    </svg>
  )
}

const SEARCH_PROVIDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
  meilisearch: MeilisearchIcon,
  elasticsearch: ElasticsearchIcon,
  elastic: ElasticsearchIcon,
  opensearch: ElasticsearchIcon,
  typesense: TypesenseIcon,
  algolia: AlgoliaIcon,
  qdrant: QdrantIcon,
  weaviate: WeaviateIcon,
  pinecone: PineconeIcon,
  chromadb: QdrantIcon,
  chroma: QdrantIcon,
  postgres: PostgresIcon,
  postgresql: PostgresIcon,
}

const LLM_PROVIDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
  openai: OpenAIIcon,
  anthropic: AnthropicIcon,
  google: GeminiIcon,
  gemini: GeminiIcon,
  mistral: MistralIcon,
  mistralai: MistralIcon,
  meta: MetaIcon,
  llama: MetaIcon,
  cohere: CohereIcon,
  groq: GroqIcon,
  deepseek: DeepSeekIcon,
  perplexity: PerplexityIcon,
  together: TogetherIcon,
  togetherai: TogetherIcon,
  fireworks: FireworksIcon,
  fireworksai: FireworksIcon,
  ollama: OllamaIcon,
  azureopenai: AzureOpenAIIcon,
  azure_openai: AzureOpenAIIcon,
  bedrock: BedrockIcon,
  awsbedrock: BedrockIcon,
  vertexai: VertexIcon,
  vertex: VertexIcon,
}
