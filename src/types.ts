export interface Repo {
  slug: string
  name: string
  description: string
  owner: string
  role: "reader" | "editor" | "admin"
  search_provider?: string | null
  public_access?: boolean
}

export type RepoTree = { [key: string]: number | RepoTree }

export interface DocNode {
  name: string
  type: "file" | "directory"
  children?: DocNode[]
}

export interface AiModel {
  id: string
  name: string
  provider?: string
}

/** Imperative handle exposed by diagram file editors (mermaid, drawio) so the
 * AI assistant can read and replace the diagram source. */
export interface DiagramSourceHandle {
  getSource: () => string
  setSource: (source: string) => void
}

export interface AiConversation {
  id: string
  title: string
  scope: string
  repo_slug: string
  file_path: string
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "summary"
  content: string
  sources?: AiMessageSource[]
  actions?: AiAgentAction[]
  token_usage?: { input_tokens: number; output_tokens: number }
  created_at: string
}

/** A file operation performed by the agentic assistant. */
export interface AiAgentAction {
  tool: string
  path?: string
  status: string
}

export interface AiMessageSource {
  repo: string
  file_path: string
  chunk: string
  score: number
}

export interface FileHistoryEntry {
  author: string
  author_email: string
  commit_hash: string
  date: string
  message: string
}

export interface SearchResult {
  chunk: string
  file_path: string
  repo: string
  score: number
}
