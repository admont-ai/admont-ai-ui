import { describe, it, expect } from "vitest"
import {
  providerFromIssuer,
  formatProviderName,
  formatLlmProviderName,
  formatSearchProviderName,
} from "@/components/ui/provider-icon"

describe("providerFromIssuer", () => {
  it("detects Google from accounts.google.com", () => {
    expect(providerFromIssuer("https://accounts.google.com")).toBe("google")
  })

  it("detects Google from googleapis.com", () => {
    expect(providerFromIssuer("https://oauth2.googleapis.com")).toBe("google")
  })

  it("detects GitHub", () => {
    expect(providerFromIssuer("https://github.com")).toBe("github")
  })

  it("detects GitLab", () => {
    expect(providerFromIssuer("https://gitlab.com")).toBe("gitlab")
  })

  it("detects Microsoft from login.microsoftonline.com", () => {
    expect(providerFromIssuer("https://login.microsoftonline.com/tenant/v2.0")).toBe("microsoftonline")
  })

  it("detects Okta", () => {
    expect(providerFromIssuer("https://dev-123456.okta.com")).toBe("okta")
  })

  it("detects Apple", () => {
    expect(providerFromIssuer("https://appleid.apple.com")).toBe("apple")
  })

  it("detects Auth0", () => {
    expect(providerFromIssuer("https://myapp.auth0.com/")).toBe("auth0")
  })

  it("detects Keycloak", () => {
    expect(providerFromIssuer("https://keycloak.example.com/realms/main")).toBe("keycloak")
  })

  it("detects Cognito from amazonaws.com", () => {
    expect(providerFromIssuer("https://cognito-idp.us-east-1.amazonaws.com/pool")).toBe("cognito")
  })

  it("detects Hydra/Ory", () => {
    expect(providerFromIssuer("https://hydra.example.com")).toBe("hydra")
  })

  it("detects Discord", () => {
    expect(providerFromIssuer("https://discord.com")).toBe("discord")
  })

  it("detects Slack", () => {
    expect(providerFromIssuer("https://slack.com")).toBe("slack")
  })

  it("detects Bitbucket", () => {
    expect(providerFromIssuer("https://bitbucket.org")).toBe("bitbucket")
  })

  it("detects LinkedIn", () => {
    expect(providerFromIssuer("https://linkedin.com")).toBe("linkedin")
  })

  it("detects Facebook", () => {
    expect(providerFromIssuer("https://facebook.com")).toBe("facebook")
  })

  it("returns null for unknown issuer", () => {
    expect(providerFromIssuer("https://unknown-provider.com")).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(providerFromIssuer(undefined)).toBeNull()
  })

  it("is case-insensitive", () => {
    expect(providerFromIssuer("https://ACCOUNTS.GOOGLE.COM")).toBe("google")
  })
})

describe("formatProviderName", () => {
  it("formats known providers", () => {
    expect(formatProviderName("google")).toBe("Google")
    expect(formatProviderName("github")).toBe("GitHub")
    expect(formatProviderName("gitlab")).toBe("GitLab")
    expect(formatProviderName("microsoft")).toBe("Microsoft")
    expect(formatProviderName("okta")).toBe("Okta")
    expect(formatProviderName("apple")).toBe("Apple")
    expect(formatProviderName("hydra")).toBe("Internal User")
    expect(formatProviderName("internal")).toBe("Internal User")
    expect(formatProviderName("auth0")).toBe("Auth0")
    expect(formatProviderName("keycloak")).toBe("Keycloak")
  })

  it("capitalizes unknown providers", () => {
    expect(formatProviderName("custom")).toBe("Custom")
    expect(formatProviderName("myProvider")).toBe("MyProvider")
  })

  it("returns 'Unknown' for empty string", () => {
    expect(formatProviderName("")).toBe("Unknown")
  })

  it("is case-insensitive for lookup", () => {
    expect(formatProviderName("GOOGLE")).toBe("Google")
    expect(formatProviderName("GitHub")).toBe("GitHub")
  })
})

describe("formatLlmProviderName", () => {
  it("formats known LLM providers", () => {
    expect(formatLlmProviderName("openai")).toBe("OpenAI")
    expect(formatLlmProviderName("anthropic")).toBe("Anthropic")
    expect(formatLlmProviderName("google")).toBe("Google Gemini")
    expect(formatLlmProviderName("mistral")).toBe("Mistral AI")
    expect(formatLlmProviderName("meta")).toBe("Meta Llama")
    expect(formatLlmProviderName("deepseek")).toBe("DeepSeek")
    expect(formatLlmProviderName("ollama")).toBe("Ollama")
    expect(formatLlmProviderName("xai")).toBe("xAI")
    expect(formatLlmProviderName("perplexity")).toBe("Perplexity")
  })

  it("normalizes provider names (strips spaces, dashes, underscores)", () => {
    expect(formatLlmProviderName("azure_openai")).toBe("Azure OpenAI")
    expect(formatLlmProviderName("azure-openai")).toBe("Azure OpenAI")
  })

  it("capitalizes unknown providers", () => {
    expect(formatLlmProviderName("custom")).toBe("Custom")
  })

  it("returns 'Unknown' for empty string", () => {
    expect(formatLlmProviderName("")).toBe("Unknown")
  })
})

describe("formatSearchProviderName", () => {
  it("formats known search providers", () => {
    expect(formatSearchProviderName("meilisearch")).toBe("Meilisearch")
    expect(formatSearchProviderName("elasticsearch")).toBe("Elasticsearch")
    expect(formatSearchProviderName("typesense")).toBe("Typesense")
    expect(formatSearchProviderName("qdrant")).toBe("Qdrant")
    expect(formatSearchProviderName("postgres")).toBe("PostgreSQL")
    expect(formatSearchProviderName("pgvector")).toBe("PgVector")
    expect(formatSearchProviderName("weaviate")).toBe("Weaviate")
    expect(formatSearchProviderName("pinecone")).toBe("Pinecone")
  })

  it("normalizes provider names", () => {
    expect(formatSearchProviderName("chroma-db")).toBe("ChromaDB")
  })

  it("capitalizes unknown providers", () => {
    expect(formatSearchProviderName("custom")).toBe("Custom")
  })

  it("returns 'Unknown' for empty string", () => {
    expect(formatSearchProviderName("")).toBe("Unknown")
  })
})
