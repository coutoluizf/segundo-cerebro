/**
 * Typed message protocol for UI <-> Background communication
 * Defines all message types and response types
 */

import type { VoiceItem, Project, CapturedContext, SearchResult, ApiKeys } from './types'
import type { UserSettings } from './settings'
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
  | { type: 'SAVE_VOICE_ITEM'; item: Partial<VoiceItem>; transcription: string; pageContent?: string; closeTabOnSave?: boolean }
  | { type: 'GET_ITEMS'; limit?: number; projectId?: string }
  | { type: 'SEMANTIC_SEARCH'; query: string; limit?: number }
  | { type: 'GET_PROJECTS' }
  | { type: 'CREATE_PROJECT'; name: string; color?: string }
  | { type: 'UPDATE_PROJECT'; id: string; name: string; color?: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'GET_CONTEXT' }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'UPDATE_ITEM'; id: string; updates: { title?: string; transcription?: string; aiSummary?: string } }
  | { type: 'UPDATE_ITEM_PROJECT'; id: string; projectId: string | null }
  | { type: 'UPDATE_ITEM_REMINDER'; id: string; reminderAt: number | null }
  | { type: 'GET_API_KEYS' }
  | { type: 'SET_API_KEYS'; elevenlabs?: string; openai?: string }
  | { type: 'CHECK_API_KEYS' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'OPEN_ITEM_URL'; url: string; projectId: string | null }
  // Trash operations
  | { type: 'GET_DELETED_ITEMS' }
  | { type: 'RESTORE_ITEM'; id: string }
  | { type: 'PERMANENT_DELETE_ITEM'; id: string }
  | { type: 'EMPTY_TRASH' }

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
  T extends 'UPDATE_ITEM' ? { success: boolean; item?: VoiceItem; error?: string } :
  T extends 'UPDATE_ITEM_PROJECT' ? { success: boolean; error?: string } :
  T extends 'UPDATE_ITEM_REMINDER' ? { success: boolean; item?: VoiceItem; error?: string } :
  T extends 'GET_API_KEYS' ? ApiKeys :
  T extends 'SET_API_KEYS' ? { success: boolean; error?: string } :
  T extends 'CHECK_API_KEYS' ? { hasKeys: boolean; elevenlabs: boolean; openai: boolean } :
  T extends 'GET_SETTINGS' ? UserSettings :
  T extends 'SET_SETTINGS' ? { success: boolean; settings?: UserSettings; error?: string } :
  T extends 'OPEN_ITEM_URL' ? { success: boolean } :
  // Trash operations
  T extends 'GET_DELETED_ITEMS' ? { items: VoiceItem[] } :
  T extends 'RESTORE_ITEM' ? { success: boolean; item?: VoiceItem; error?: string } :
  T extends 'PERMANENT_DELETE_ITEM' ? { success: boolean; error?: string } :
  T extends 'EMPTY_TRASH' ? { success: boolean; count?: number; error?: string } :
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

    case 'GET_SETTINGS': {
      const { getSettings } = await import('./settings')
      return await getSettings()
    }

    case 'SET_SETTINGS': {
      const { saveSettings } = await import('./settings')
      const settings = await saveSettings(message.settings)
      return { success: true, settings }
    }

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

    case 'UPDATE_ITEM_REMINDER': {
      const updatedItem = await db.updateItemReminder(message.id, message.reminderAt)
      if (!updatedItem) {
        return { success: false, error: 'Item not found' }
      }
      return { success: true, item: updatedItem }
    }

    case 'UPDATE_ITEM': {
      const keys = getDevApiKeys()
      const { id, updates } = message

      // Get the current item
      const currentItem = await db.getItemById(id)
      if (!currentItem) {
        return { success: false, error: 'Item not found' }
      }

      // Regenerate embedding if content changed
      let newEmbedding: number[] | null | undefined = undefined
      const transcriptionChanged = updates.transcription !== undefined && updates.transcription !== currentItem.transcription
      const aiSummaryChanged = updates.aiSummary !== undefined && updates.aiSummary !== currentItem.aiSummary

      if ((transcriptionChanged || aiSummaryChanged) && keys.openai) {
        try {
          const { generateEmbedding, buildTextForEmbedding } = await import('./embeddings')
          const transcription = updates.transcription ?? currentItem.transcription
          const aiSummary = updates.aiSummary ?? currentItem.aiSummary
          // Build text for embedding including title and URL
          const textForEmbedding = buildTextForEmbedding({
            title: currentItem.title,
            url: currentItem.url,
            transcription,
            aiSummary,
          })
          newEmbedding = await generateEmbedding(textForEmbedding, keys.openai)
        } catch (e) {
          console.error('[Dev] Error regenerating embedding:', e)
        }
      }

      const updatedItem = await db.updateItem(id, updates, newEmbedding)
      return { success: true, item: updatedItem }
    }

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

      // Determine item type: 'note' if explicitly set, 'tab' otherwise
      const itemType = message.item.type || 'tab'
      const isNote = itemType === 'note'

      // Get user settings and generate AI summary if enabled (dev mode)
      const { getSettings } = await import('./settings')
      const settings = await getSettings()
      let aiSummary: string | null = null

      // Generate AI summary for tab items if enabled
      if (!isNote && settings.autoSummarize && keys.openai) {
        const pageContent = message.pageContent || document.body.innerText?.substring(0, 15000)
        if (pageContent && pageContent.length > 100) {
          try {
            const { generateSummary } = await import('./summarize')
            aiSummary = await generateSummary(pageContent, settings.language, keys.openai)
          } catch (e) {
            console.error('[Dev] Error generating AI summary:', e)
          }
        }
      }

      // Generate embedding including title and URL for better semantic search
      let embedding: number[] | null = null
      const itemTitle = message.item.title || (isNote ? null : document.title)
      const itemUrl = isNote ? null : (message.item.url || window.location.href)
      if (keys.openai) {
        try {
          const { generateEmbedding, buildTextForEmbedding } = await import('./embeddings')
          // Build text for embedding including title, URL, transcription and AI summary
          const textForEmbedding = buildTextForEmbedding({
            title: itemTitle,
            url: itemUrl,
            transcription: message.transcription,
            aiSummary,
          })
          embedding = await generateEmbedding(textForEmbedding, keys.openai)
        } catch (e) {
          console.error('[Dev] Error generating embedding:', e)
        }
      }

      const item = await db.saveItem(
        {
          type: itemType,
          url: isNote ? '' : (message.item.url || window.location.href), // Empty string for notes, saveItem handles it
          title: message.item.title || (isNote ? null : document.title),
          favicon: message.item.favicon || null,
          thumbnail: null, // Thumbnail only captured in extension context
          source: message.item.source || null,
          transcription: message.transcription,
          aiSummary,
          projectId: message.item.projectId || null,
          reason: message.item.reason || null,
          contextTabs: [],
          contextTabCount: isNote ? 0 : 1,
          status: 'saved',
          reminderAt: message.item.reminderAt || null,
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

    // Trash operations
    case 'GET_DELETED_ITEMS':
      return { items: await db.getDeletedItems() }

    case 'RESTORE_ITEM': {
      const restoredItem = await db.restoreItem(message.id)
      if (!restoredItem) {
        return { success: false, error: 'Item not found' }
      }
      return { success: true, item: restoredItem }
    }

    case 'PERMANENT_DELETE_ITEM':
      await db.emptyTrashItem(message.id)
      return { success: true }

    case 'EMPTY_TRASH': {
      const count = await db.emptyAllTrash()
      return { success: true, count }
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
