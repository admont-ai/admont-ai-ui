import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
  ProviderIcon,
  LlmProviderIcon,
  SearchProviderIcon,
} from "@/components/ui/provider-icon"

describe("ProviderIcon", () => {
  const authProviders = [
    "google", "github", "gitlab", "microsoft", "microsoftonline",
    "azureadv2", "azure", "apple", "okta", "keycloak", "oidc",
    "openidconnect", "facebook", "discord", "slack", "bitbucket",
    "linkedin", "cognito", "hydra", "auth0", "internal",
  ]

  it.each(authProviders)("renders SVG for %s", (provider) => {
    const { container } = render(<ProviderIcon provider={provider} />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders fallback SVG for unknown provider", () => {
    const { container } = render(<ProviderIcon provider="custom-provider" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("returns null for empty provider", () => {
    const { container } = render(<ProviderIcon provider="" />)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("applies custom className", () => {
    const { container } = render(<ProviderIcon provider="google" className="size-8" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("size-8")
  })

  it("uses default className size-4", () => {
    const { container } = render(<ProviderIcon provider="google" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("size-4")
  })
})

describe("LlmProviderIcon", () => {
  const llmProviders = [
    "openai", "anthropic", "google", "gemini", "mistral", "mistralai",
    "meta", "llama", "cohere", "groq", "deepseek", "perplexity",
    "together", "togetherai", "fireworks", "fireworksai", "ollama",
    "azureopenai", "azure_openai", "bedrock", "awsbedrock", "vertexai", "vertex",
  ]

  it.each(llmProviders)("renders SVG for %s", (provider) => {
    const { container } = render(<LlmProviderIcon provider={provider} />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders fallback SVG for unknown provider", () => {
    const { container } = render(<LlmProviderIcon provider="unknown-llm" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("returns null for empty provider", () => {
    const { container } = render(<LlmProviderIcon provider="" />)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("normalizes provider names with dashes and spaces", () => {
    const { container } = render(<LlmProviderIcon provider="azure-openai" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })
})

describe("SearchProviderIcon", () => {
  const searchProviders = [
    "meilisearch", "elasticsearch", "elastic", "opensearch",
    "typesense", "algolia", "qdrant", "weaviate", "pinecone",
    "chromadb", "chroma", "postgres", "postgresql",
  ]

  it.each(searchProviders)("renders SVG for %s", (provider) => {
    const { container } = render(<SearchProviderIcon provider={provider} />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders fallback SVG for unknown provider", () => {
    const { container } = render(<SearchProviderIcon provider="custom-search" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("returns null for empty provider", () => {
    const { container } = render(<SearchProviderIcon provider="" />)
    expect(container.querySelector("svg")).toBeNull()
  })
})
