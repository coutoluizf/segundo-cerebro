/**
 * Typed message protocol for UI <-> Background communication
 * Defines all message types and response types
 */

import type { VoiceItem, Project, CapturedContext, SearchResult, ApiKeys } from './types'
import * as db from './db'

// Check if we're running in extension context
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id

// Event name for items changed broadcast
export const EVENT_ITEMS_CHANGED = 'ITEMS_CHANGED'

// Development mode storage for API keys (localStorage)
const DEV_STORAGE_KEY = 'segundo-cerebro-dev-keys'

// Get dev API keys from localStorage
function getDevApiKeys(): ApiKeys {
  try {
    const stored = localStorage.getItem(DEV_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Set dev API keys in localStorage
function setDevApiKeys(keys: Partial<ApiKeys>): void {
  const current = getDevApiKeys()
  localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify({ ...current, ...keys }))
}

// Message types from UI to Background
export type BgMessage =
  | { type: 'SAVE_VOICE_ITEM'; item: Partial<VoiceItem>; transcription: string }
  | { type: 'GET_ITEMS'; limit?: number; projectId?: string }
  | { type: 'SEMANTIC_SEARCH'; query: string; limit?: number }
  | { type: 'GET_PROJECTS' }
  | { type: 'CREATE_PROJECT'; name: string; color?: string }
  | { type: 'UPDATE_PROJECT'; id: string; name: string; color?: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'GET_CONTEXT' }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'UPDATE_ITEM_PROJECT'; id: string; projectId: string | null }
  | { type: 'GET_API_KEYS' }
  | { type: 'SET_API_KEYS'; elevenlabs?: string; openai?: string }
  | { type: 'CHECK_API_KEYS' }

// Response types based on message type
export type BgResponse<T extends BgMessage['type']> =
  T extends 'SAVE_VOICE_ITEM' ? { success: boolean; item?: VoiceItem; error?: string } :
  T extends 'GET_ITEMS' ? { items: VoiceItem[] } :
  T extends 'SEMANTIC_SEARCH' ? { results: SearchResult[] } :
  T extends 'GET_PROJECTS' ? { projects: Project[] } :
  T extends 'CREATE_PROJECT' ? { success: boolean; project?: Project; error?: string } :
  T extends 'UPDATE_PROJECT' ? { success: boolean; project?: Project; error?: string } :
  T extends 'DELETE_PROJECT' ? { success: boolean; error?: string } :
  T extends 'GET_CONTEXT' ? CapturedContext :
  T extends 'DELETE_ITEM' ? { success: boolean; error?: string } :
  T extends 'UPDATE_ITEM_PROJECT' ? { success: boolean; error?: string } :
  T extends 'GET_API_KEYS' ? ApiKeys :
  T extends 'SET_API_KEYS' ? { success: boolean; error?: string } :
  T extends 'CHECK_API_KEYS' ? { hasKeys: boolean; elevenlabs: boolean; openai: boolean } :
  never

// Helper function to send typed messages to background
export async function sendMessage<T extends BgMessage>(
  message: T
): Promise<BgResponse<T['type']>> {
  // If running in extension context, use chrome.runtime
  if (isExtension) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  // Development mode: handle messages directly
  return handleDevMessage(message) as Promise<BgResponse<T['type']>>
}

// Handle messages in development mode (no extension context)
async function handleDevMessage(message: BgMessage): Promise<unknown> {
  // Initialize database on first call
  await db.initDatabase()

  switch (message.type) {
    case 'CHECK_API_KEYS': {
      const keys = getDevApiKeys()
      return {
        hasKeys: Boolean(keys.elevenlabs && keys.openai),
        elevenlabs: Boolean(keys.elevenlabs),
        openai: Boolean(keys.openai),
      }
    }

    case 'GET_API_KEYS':
      return getDevApiKeys()

    case 'SET_API_KEYS':
      setDevApiKeys({ elevenlabs: message.elevenlabs, openai: message.openai })
      return { success: true }

    case 'GET_PROJECTS':
      return { projects: await db.getProjects() }

    case 'CREATE_PROJECT': {
      const project = await db.createProject(message.name, message.color)
      return { success: true, project }
    }

    case 'UPDATE_PROJECT': {
      const project = await db.updateProject(message.id, message.name, message.color)
      return { success: true, project: project || undefined }
    }

    case 'DELETE_PROJECT':
      await db.deleteProject(message.id)
      return { success: true }

    case 'GET_ITEMS':
      return { items: await db.getItems({ limit: message.limit, projectId: message.projectId }) }

    case 'DELETE_ITEM':
      await db.deleteItem(message.id)
      return { success: true }

    case 'UPDATE_ITEM_PROJECT':
      await db.updateItemProject(message.id, message.projectId)
      return { success: true }

    case 'GET_CONTEXT':
      // Mock context in dev mode
      return {
        activeTab: { url: window.location.href, title: document.title },
        tabUrls: [],
        tabCount: 1,
        timestamp: Date.now(),
      }

    case 'SAVE_VOICE_ITEM': {
      const keys = getDevApiKeys()
      let embedding: number[] | null = null

      // Generate embedding if OpenAI key is available
      if (keys.openai && message.transcription) {
        try {
          const { generateEmbedding } = await import('./embeddings')
          embedding = await generateEmbedding(message.transcription, keys.openai)
        } catch (e) {
          console.error('[Dev] Error generating embedding:', e)
        }
      }

      // Determine item type: 'note' if no URL, 'tab' otherwise
      const itemType = message.item.type || (message.item.url ? 'tab' : 'note')

      const item = await db.saveItem(
        {
          type: itemType,
          url: message.item.url || (itemType === 'tab' ? window.location.href : null),
          title: message.item.title || (itemType === 'tab' ? document.title : null),
          favicon: message.item.favicon || null,
          source: message.item.source || null,
          transcription: message.transcription,
          projectId: message.item.projectId || null,
          reason: message.item.reason || null,
          contextTabs: [],
          contextTabCount: itemType === 'tab' ? 1 : 0,
          status: 'saved',
        },
        embedding
      )
      return { success: true, item }
    }

    case 'SEMANTIC_SEARCH': {
      const keys = getDevApiKeys()
      if (!keys.openai) {
        return { results: [] }
      }

      const { generateEmbedding } = await import('./embeddings')
      const queryEmbedding = await generateEmbedding(message.query, keys.openai)
      const results = await db.semanticSearch(queryEmbedding, { limit: message.limit })
      return { results }
    }

    default:
      return { success: false, error: 'Unknown message type' }
  }
}

// Broadcast event listener helper
export function onItemsChanged(callback: () => void): () => void {
  // In dev mode, no-op (no background to broadcast)
  if (!isExtension) {
    return () => {}
  }

  const handler = (message: { type: string }) => {
    if (message.type === EVENT_ITEMS_CHANGED) {
      callback()
    }
  }

  chrome.runtime.onMessage.addListener(handler)

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(handler)
  }
}
