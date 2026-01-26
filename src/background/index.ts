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
  updateItem,
  updateItemProject,
  getItemById,
  seedDefaultProjects,
} from '@/shared/db'
import { captureContext } from '@/shared/context'
import { generateEmbedding } from '@/shared/embeddings'
import { generateSummary } from '@/shared/summarize'
import { getSettings, saveSettings } from '@/shared/settings'
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

/**
 * Function to extract page content in the tab context
 * This is injected and executed via chrome.scripting.executeScript
 */
function extractPageContentInTab(): string {
  const MAX_CONTENT_LENGTH = 15000

  // Main content selectors (priority order)
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    '.post-content',
    '.article-content',
    '.entry-content',
  ]

  let contentElement: Element | null = null

  // Find the best content container
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector)
    if (contentElement) break
  }

  // Fallback to body if no main content found
  if (!contentElement) {
    contentElement = document.body
  }

  // Clone the element to avoid modifying the actual page
  const clone = contentElement.cloneNode(true) as Element

  // Remove unwanted elements
  const unwantedSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.comments',
    '.advertisement',
    '.ad',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
  ]

  for (const selector of unwantedSelectors) {
    const elements = clone.querySelectorAll(selector)
    elements.forEach((el) => el.remove())
  }

  // Get text content and clean it up
  let text = clone.textContent || ''

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Multiple whitespace to single space
    .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
    .trim()

  // Truncate if too long
  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.substring(0, MAX_CONTENT_LENGTH) + '...'
  }

  return text
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

      // Capture context (only for tab items)
      const context = await captureContext()

      // Determine item type: 'note' if explicitly set, 'tab' otherwise
      const itemType = message.item.type || 'tab'
      const isNote = itemType === 'note'

      // Get user settings for AI summary
      const settings = await getSettings()
      let aiSummary: string | null = null

      // Generate AI summary for tab items if enabled
      if (!isNote && settings.autoSummarize) {
        let pageContent = message.pageContent

        // If pageContent not provided, extract from active tab via content script
        if (!pageContent) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tab?.id && tab.url && !tab.url.startsWith('chrome://')) {
              // Inject and execute content script to extract page content
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractPageContentInTab,
              })
              if (results?.[0]?.result) {
                pageContent = results[0].result
              }
            }
          } catch (error) {
            console.error('[Background] Error extracting page content:', error)
          }
        }

        // Generate summary if we have page content
        if (pageContent && pageContent.length > 100) {
          try {
            aiSummary = await generateSummary(pageContent, settings.language, apiKeys.openai)
            console.log('[Background] AI summary generated:', aiSummary?.substring(0, 100) + '...')
          } catch (error) {
            console.error('[Background] Error generating AI summary:', error)
          }
        }
      }

      // Generate embedding from transcription + AI summary for better semantic search
      let embedding: number[] | null = null
      try {
        // Combine transcription and AI summary for richer embedding
        const textForEmbedding = aiSummary
          ? `${message.transcription}\n\n${aiSummary}`
          : message.transcription
        embedding = await generateEmbedding(textForEmbedding, apiKeys.openai)
      } catch (error) {
        console.error('[Background] Error generating embedding:', error)
        // Continue without embedding
      }

      // Save item with embedding and AI summary
      // Note: for notes, db.saveItem will generate a placeholder URL
      const item = await saveItem(
        {
          type: itemType,
          url: isNote ? '' : (message.item.url || context.activeTab.url), // Empty string for notes, saveItem handles it
          title: message.item.title || (isNote ? null : context.activeTab.title),
          favicon: isNote ? null : (message.item.favicon || context.activeTab.favicon || null),
          source: message.item.source || null,
          transcription: message.transcription,
          aiSummary,
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

    case 'UPDATE_ITEM': {
      const apiKeys = await getApiKeys()
      const { id, updates } = message

      // Get the current item to check what changed
      const currentItem = await getItemById(id)
      if (!currentItem) {
        return { success: false, error: 'Item not found' }
      }

      // Determine if we need to regenerate embedding
      // Regenerate if transcription or aiSummary changed
      let newEmbedding: number[] | null | undefined = undefined
      const transcriptionChanged = updates.transcription !== undefined && updates.transcription !== currentItem.transcription
      const aiSummaryChanged = updates.aiSummary !== undefined && updates.aiSummary !== currentItem.aiSummary

      if ((transcriptionChanged || aiSummaryChanged) && apiKeys.openai) {
        try {
          // Use the new values or fall back to current
          const transcription = updates.transcription ?? currentItem.transcription
          const aiSummary = updates.aiSummary ?? currentItem.aiSummary

          // Combine transcription and AI summary for richer embedding (same as save flow)
          const textForEmbedding = aiSummary
            ? `${transcription}\n\n${aiSummary}`
            : transcription

          newEmbedding = await generateEmbedding(textForEmbedding, apiKeys.openai)
          console.log('[Background] Regenerated embedding for updated item')
        } catch (error) {
          console.error('[Background] Error regenerating embedding:', error)
          // Continue without updating embedding
        }
      }

      // Update the item
      const updatedItem = await updateItem(id, updates, newEmbedding)

      if (!updatedItem) {
        return { success: false, error: 'Failed to update item' }
      }

      broadcastItemsChanged()
      return { success: true, item: updatedItem }
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

    case 'GET_SETTINGS': {
      return await getSettings()
    }

    case 'SET_SETTINGS': {
      const updatedSettings = await saveSettings(message.settings)
      return { success: true, settings: updatedSettings }
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
