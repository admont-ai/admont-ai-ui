import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { useAuth } from "@/contexts/auth-context"
import type { AiModel, AiConversation, AiMessage } from "@/types"
import { authFetch } from "@/lib/auth-fetch"

export interface AiLogEntry {
  id: number
  timestamp: Date
  action: "generate" | "polish" | "ask"
  input: string
  summary: string
  usage?: { input_tokens: number; output_tokens: number }
}

const STORAGE_KEY_MODEL = "ai_selected_model"

interface AiLogContextValue {
  entries: AiLogEntry[]
  addEntry: (entry: Omit<AiLogEntry, "id" | "timestamp">) => void
  clearEntries: () => void
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  aiAvailable: boolean
  models: AiModel[]
  modelsLoading: boolean
  selectedModel: string
  setSelectedModel: (id: string) => void

  // Conversation management
  conversations: AiConversation[]
  activeConversationId: string | null
  activeMessages: AiMessage[]
  createConversation: (scope: string, repoSlug: string, filePath: string) => Promise<string>
  switchConversation: (id: string | null) => void
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  addMessage: (msg: AiMessage) => void
  refreshConversations: () => void
}

const AiLogContext = createContext<AiLogContextValue | null>(null)

let nextId = 1

export function AiLogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [entries, setEntries] = useState<AiLogEntry[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [models, setModels] = useState<AiModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [selectedModel, setSelectedModelState] = useState("")

  // Conversation state
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeMessages, setActiveMessages] = useState<AiMessage[]>([])

  const setSelectedModel = useCallback((id: string) => {
    setSelectedModelState(id)
    try { localStorage.setItem(STORAGE_KEY_MODEL, id) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setModelsLoading(false)
      return
    }
    authFetch("/llm/models")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
        return res.json() as Promise<AiModel[]>
      })
      .then((data) => {
        setModels(data)
        setAiAvailable(data.length > 0)
        const saved = localStorage.getItem(STORAGE_KEY_MODEL)
        if (saved && data.some((m) => m.id === saved)) {
          setSelectedModelState(saved)
        } else if (data.length > 0) {
          setSelectedModelState(data[0].id)
        }
      })
      .catch((err: Error) => console.error("[llm/models] error:", err.message))
      .finally(() => setModelsLoading(false))
  }, [isAuthenticated])

  const refreshConversations = useCallback(() => {
    if (!isAuthenticated) return
    authFetch("/conversations")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.conversations) setConversations(data.conversations)
      })
      .catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) refreshConversations()
  }, [isAuthenticated, refreshConversations])

  const createConversation = useCallback(async (scope: string, repoSlug: string, filePath: string): Promise<string> => {
    const res = await authFetch("/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, repo_slug: repoSlug, file_path: filePath }),
    })
    if (!res.ok) throw new Error("Failed to create conversation")
    const conv: AiConversation = await res.json()
    setConversations((prev) => [conv, ...prev])
    setActiveConversationId(conv.id)
    setActiveMessages([])
    return conv.id
  }, [])

  const switchConversation = useCallback((id: string | null) => {
    setActiveConversationId(id)
    if (!id) {
      setActiveMessages([])
      return
    }
    authFetch(`/conversations/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.messages) setActiveMessages(data.messages)
      })
      .catch(() => {})
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    await authFetch(`/conversations/${id}`, { method: "DELETE" })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConversationId === id) {
      setActiveConversationId(null)
      setActiveMessages([])
    }
  }, [activeConversationId])

  const renameConversation = useCallback(async (id: string, title: string) => {
    await authFetch(`/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c))
  }, [])

  const addMessage = useCallback((msg: AiMessage) => {
    setActiveMessages((prev) => [...prev, msg])
  }, [])

  const addEntry = useCallback((entry: Omit<AiLogEntry, "id" | "timestamp">) => {
    setEntries((prev) => [
      ...prev,
      { ...entry, id: nextId++, timestamp: new Date() },
    ])
  }, [])

  const clearEntries = useCallback(() => {
    setEntries([])
    setActiveConversationId(null)
    setActiveMessages([])
  }, [])

  return (
    <AiLogContext.Provider value={{
      entries, addEntry, clearEntries, panelOpen, setPanelOpen,
      aiAvailable, models, modelsLoading, selectedModel, setSelectedModel,
      conversations, activeConversationId, activeMessages,
      createConversation, switchConversation, deleteConversation, renameConversation,
      addMessage, refreshConversations,
    }}>
      {children}
    </AiLogContext.Provider>
  )
}

export function useAiLog() {
  const ctx = useContext(AiLogContext)
  if (!ctx) throw new Error("useAiLog must be used within AiLogProvider")
  return ctx
}
