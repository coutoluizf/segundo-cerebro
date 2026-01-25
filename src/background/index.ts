/**
 * Background Service Worker
 * Handles message routing, database operations, and embedding generation
 */

import type { BgMessage, BgResponse } from '@/shared/messaging'
import { EVENT_ITEMS_CHANGED } from '@/shared/messaging'
import {
  initDatabase,
  saveItem,
  getItems,
  semanticSearch,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  deleteItem,
  updateItemProject,
  seedDefaultProjects,
} from '@/shared/db'
import { captureContext } from '@/shared/context'
import { generateEmbedding } from '@/shared/embeddings'
import type { ApiKeys } from '@/shared/types'

// API keys storage key
const API_KEYS_STORAGE_KEY = 'segundo-cerebro-api-keys'

// Get API keys from storage
async function getApiKeys(): Promise<ApiKeys> {
  const result = await chrome.storage.local.get(API_KEYS_STORAGE_KEY)
  return result[API_KEYS_STORAGE_KEY] || {}
}

// Set API keys in storage
async function setApiKeys(keys: Partial<ApiKeys>): Promise<void> {
  const current = await getApiKeys()
  await chrome.storage.local.set({
    [API_KEYS_STORAGE_KEY]: { ...current, ...keys },
  })
}

// Broadcast items changed event to all extension pages
function broadcastItemsChanged(): void {
  chrome.runtime.sendMessage({ type: EVENT_ITEMS_CHANGED }).catch(() => {
    // Ignore errors if no listeners
  })
}

// Initialize database on startup
initDatabase()
  .then(() => {
    console.log('[Background] Database initialized')
    // Seed default projects on first run
    return seedDefaultProjects()
  })
  .then(() => {
    console.log('[Background] Default projects seeded')
  })
  .catch((error) => {
    console.error('[Background] Database initialization error:', error)
  })

// Handle messages from UI
chrome.runtime.onMessage.addListener(
  (
    message: BgMessage,
    _sender,
    sendResponse: (response: BgResponse<BgMessage['type']>) => void
  ) => {
    // Handle each message type
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        console.error('[Background] Error handling message:', error)
        sendResponse({ success: false, error: error.message } as BgResponse<BgMessage['type']>)
      })

    // Return true to indicate async response
    return true
  }
)

// Message handler
async function handleMessage(message: BgMessage): Promise<BgResponse<BgMessage['type']>> {
  switch (message.type) {
    case 'SAVE_VOICE_ITEM': {
      const apiKeys = await getApiKeys()

      if (!apiKeys.openai) {
        return { success: false, error: 'OpenAI API key not configured' }
      }

      // Generate embedding from transcription
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(message.transcription, apiKeys.openai)
      } catch (error) {
        console.error('[Background] Error generating embedding:', error)
        // Continue without embedding
      }

      // Capture context (only for tab items)
      const context = await captureContext()

      // Determine item type: 'note' if explicitly set, 'tab' otherwise
      const itemType = message.item.type || 'tab'
      const isNote = itemType === 'note'

      // Save item with embedding
      // Note: for notes, db.saveItem will generate a placeholder URL
      const item = await saveItem(
        {
          type: itemType,
          url: isNote ? '' : (message.item.url || context.activeTab.url), // Empty string for notes, saveItem handles it
          title: message.item.title || (isNote ? null : context.activeTab.title),
          favicon: isNote ? null : (message.item.favicon || context.activeTab.favicon || null),
          source: message.item.source || null,
          transcription: message.transcription,
          projectId: message.item.projectId || null,
          reason: message.item.reason || null,
          contextTabs: isNote ? [] : context.tabUrls,
          contextTabCount: isNote ? 0 : context.tabCount,
          status: 'saved',
        },
        embedding
      )

      broadcastItemsChanged()
      return { success: true, item }
    }

    case 'GET_ITEMS': {
      const items = await getItems({
        limit: message.limit,
        projectId: message.projectId,
      })
      return { items }
    }

    case 'SEMANTIC_SEARCH': {
      const apiKeys = await getApiKeys()

      if (!apiKeys.openai) {
        return { results: [] }
      }

      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(message.query, apiKeys.openai)

      // Search for similar items
      const results = await semanticSearch(queryEmbedding, {
        limit: message.limit,
      })

      return { results }
    }

    case 'GET_PROJECTS': {
      const projects = await getProjects()
      return { projects }
    }

    case 'CREATE_PROJECT': {
      const project = await createProject(message.name, message.color)
      return { success: true, project }
    }

    case 'UPDATE_PROJECT': {
      const project = await updateProject(message.id, message.name, message.color)
      return { success: true, project: project || undefined }
    }

    case 'DELETE_PROJECT': {
      await deleteProject(message.id)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'GET_CONTEXT': {
      return await captureContext()
    }

    case 'DELETE_ITEM': {
      await deleteItem(message.id)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'UPDATE_ITEM_PROJECT': {
      await updateItemProject(message.id, message.projectId)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'GET_API_KEYS': {
      return await getApiKeys()
    }

    case 'SET_API_KEYS': {
      await setApiKeys({
        elevenlabs: message.elevenlabs,
        openai: message.openai,
      })
      return { success: true }
    }

    case 'CHECK_API_KEYS': {
      const keys = await getApiKeys()
      return {
        hasKeys: Boolean(keys.elevenlabs && keys.openai),
        elevenlabs: Boolean(keys.elevenlabs),
        openai: Boolean(keys.openai),
      }
    }

    default:
      return { success: false, error: 'Unknown message type' } as BgResponse<BgMessage['type']>
  }
}

// Handle keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save_with_voice') {
    // Open popup programmatically
    chrome.action.openPopup()
  }
})

console.log('[Background] Service worker started')
