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
  updateItemReminder,
  getItemsWithPendingReminders,
  clearItemReminder,
  // Duplicate detection
  getItemByExactUrl,
  // Trash operations
  getDeletedItems,
  restoreItem,
  emptyTrashItem,
  emptyAllTrash,
} from '@/shared/db'
import {
  scheduleReminder,
  cancelReminder,
  getItemIdFromAlarm,
  isReminderAlarm,
} from '@/shared/reminders'
import { captureContext } from '@/shared/context'
import { generateEmbedding, buildTextForEmbedding } from '@/shared/embeddings'
import { generateSummary } from '@/shared/summarize'
import { captureTabThumbnail } from '@/shared/screenshot'
import { getSettings, saveSettings } from '@/shared/settings'
import type { ApiKeys } from '@/shared/types'

// API keys storage key
const API_KEYS_STORAGE_KEY = 'segundo-cerebro-api-keys'

// Offscreen document path
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/index.html'

// Track if offscreen document exists
let creatingOffscreen: Promise<void> | null = null

/**
 * Create the offscreen document if it doesn't exist
 */
async function setupOffscreenDocument(): Promise<void> {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  })

  if (existingContexts.length > 0) {
    return // Already exists
  }

  // Create if not already creating
  if (creatingOffscreen) {
    await creatingOffscreen
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Playing reminder notification sound',
    })
    await creatingOffscreen
    creatingOffscreen = null
  }
}

/**
 * Play the reminder sound via offscreen document
 */
async function playReminderSound(): Promise<void> {
  try {
    await setupOffscreenDocument()
    await chrome.runtime.sendMessage({ type: 'PLAY_REMINDER_SOUND' })
  } catch (error) {
    console.error('[Background] Error playing reminder sound:', error)
  }
}

/**
 * Map hex color to Chrome tab group color
 * Chrome supports: grey, blue, red, yellow, green, pink, purple, cyan, orange
 */
function mapToTabGroupColor(hexColor: string | null): chrome.tabGroups.ColorEnum {
  if (!hexColor) return 'grey'

  // Map common hex colors to Chrome tab group colors
  const colorMap: Record<string, chrome.tabGroups.ColorEnum> = {
    '#3B82F6': 'blue',    // Blue
    '#2563EB': 'blue',
    '#1D4ED8': 'blue',
    '#10B981': 'green',   // Green/Emerald
    '#059669': 'green',
    '#22C55E': 'green',
    '#8B5CF6': 'purple',  // Purple/Violet
    '#7C3AED': 'purple',
    '#A855F7': 'purple',
    '#F59E0B': 'orange',  // Amber/Orange
    '#F97316': 'orange',
    '#EA580C': 'orange',
    '#EF4444': 'red',     // Red
    '#DC2626': 'red',
    '#B91C1C': 'red',
    '#6B7280': 'grey',    // Gray
    '#9CA3AF': 'grey',
    '#EC4899': 'pink',    // Pink
    '#DB2777': 'pink',
    '#06B6D4': 'cyan',    // Cyan
    '#0891B2': 'cyan',
    '#EAB308': 'yellow',  // Yellow
    '#CA8A04': 'yellow',
  }

  // Direct match
  const upperHex = hexColor.toUpperCase()
  if (colorMap[upperHex]) {
    return colorMap[upperHex]
  }

  // Fallback: try to detect color family from hex
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  // Simple heuristics based on RGB dominance
  if (r > 200 && g < 100 && b < 100) return 'red'
  if (r < 100 && g > 150 && b < 100) return 'green'
  if (r < 100 && g < 100 && b > 200) return 'blue'
  if (r > 200 && g > 150 && b < 100) return 'orange'
  if (r > 200 && g > 200 && b < 100) return 'yellow'
  if (r > 150 && g < 100 && b > 150) return 'purple'
  if (r > 200 && g < 150 && b > 150) return 'pink'
  if (r < 100 && g > 150 && b > 150) return 'cyan'

  return 'grey'
}

/**
 * Find or create a tab group for a project
 */
async function findOrCreateTabGroup(
  projectName: string,
  windowId: number
): Promise<number> {
  // Query existing groups in the window
  const groups = await chrome.tabGroups.query({ windowId })

  // Find group with matching title
  const existingGroup = groups.find((g) => g.title === projectName)
  if (existingGroup) {
    console.log(`[Background] Found existing tab group: ${projectName}`)
    return existingGroup.id
  }

  // No existing group - we'll create one after adding the tab
  console.log(`[Background] Will create new tab group: ${projectName}`)
  return -1 // Signal to create new group
}

/**
 * Handle a triggered reminder alarm
 */
async function handleReminderAlarm(itemId: string): Promise<void> {
  console.log(`[Background] Reminder triggered for item: ${itemId}`)

  // Get the item from database
  const item = await getItemById(itemId)
  if (!item) {
    console.warn(`[Background] Item ${itemId} not found for reminder`)
    return
  }

  // Clear the reminder from the database
  await clearItemReminder(itemId)

  // Only open tab for 'tab' type items (not notes)
  if (item.type === 'tab' && item.url) {
    // Get project info if item has a project
    let project = null
    if (item.projectId) {
      const projects = await getProjects()
      project = projects.find((p) => p.id === item.projectId)
    }

    // Get current window
    const currentWindow = await chrome.windows.getCurrent()

    // Open the saved URL in a new tab
    const newTab = await chrome.tabs.create({ url: item.url })

    // Add tab to project group if project exists and setting is enabled
    const settings = await getSettings()
    if (settings.useTabGroups && project && newTab.id && currentWindow.id) {
      try {
        const groupId = await findOrCreateTabGroup(project.name, currentWindow.id)

        if (groupId > 0) {
          // Add to existing group
          await chrome.tabs.group({ tabIds: newTab.id, groupId })
        } else {
          // Create new group with the tab
          const newGroupId = await chrome.tabs.group({ tabIds: newTab.id })
          // Set group title and color
          await chrome.tabGroups.update(newGroupId, {
            title: project.name,
            color: mapToTabGroupColor(project.color),
          })
          console.log(`[Background] Created tab group: ${project.name}`)
        }
      } catch (error) {
        console.error('[Background] Error managing tab group:', error)
        // Tab was still opened, just not grouped
      }
    }
  }

  // Show notification
  const projectInfo = item.projectId ? ' 📁' : ''
  await chrome.notifications.create(`reminder-${itemId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `HeyRaji - Reminder${projectInfo}`,
    message: item.title || item.transcription.substring(0, 100),
    priority: 2,
  })

  // Play sound
  await playReminderSound()

  // Broadcast that items changed (reminder was cleared)
  broadcastItemsChanged()
}

/**
 * Recreate all alarms from database on service worker startup
 * This is needed because Chrome clears alarms when the browser restarts
 */
async function recreateAlarmsFromDb(): Promise<void> {
  try {
    const itemsWithReminders = await getItemsWithPendingReminders()
    console.log(`[Background] Found ${itemsWithReminders.length} items with pending reminders`)

    for (const item of itemsWithReminders) {
      if (item.reminderAt) {
        await scheduleReminder(item.id, item.reminderAt)
      }
    }
  } catch (error) {
    console.error('[Background] Error recreating alarms from DB:', error)
  }
}

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
    // Recreate alarms from database (Chrome clears alarms on restart)
    return recreateAlarmsFromDb()
  })
  .then(() => {
    console.log('[Background] Alarms recreated from database')
  })
  .catch((error) => {
    console.error('[Background] Database initialization error:', error)
  })

// Handle alarm events (for reminders)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[Background] Alarm triggered: ${alarm.name}`)

  if (isReminderAlarm(alarm.name)) {
    const itemId = getItemIdFromAlarm(alarm.name)
    if (itemId) {
      await handleReminderAlarm(itemId)
    }
  }
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

      // Capture thumbnail for tab items (before any async operations)
      // Use tabId/windowId from popup for more reliable capture
      let thumbnail: string | null = null
      if (!isNote) {
        try {
          thumbnail = await captureTabThumbnail({
            tabId: message.tabId,
            windowId: message.windowId,
          })
          if (thumbnail) {
            console.log('[Background] Thumbnail captured successfully')
          }
        } catch (error) {
          console.error('[Background] Error capturing thumbnail:', error)
          // Continue without thumbnail
        }
      }

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

      // Generate embedding from title, URL, transcription + AI summary for better semantic search
      // Including title and URL allows searching by site name, domain, or page title
      let embedding: number[] | null = null
      const itemTitle = message.item.title || (isNote ? null : context.activeTab.title)
      const itemUrl = isNote ? null : (message.item.url || context.activeTab.url)
      try {
        const textForEmbedding = buildTextForEmbedding({
          title: itemTitle,
          url: itemUrl,
          transcription: message.transcription,
          aiSummary,
        })
        embedding = await generateEmbedding(textForEmbedding, apiKeys.openai)
      } catch (error) {
        console.error('[Background] Error generating embedding:', error)
        // Continue without embedding
      }

      // Save item with embedding, AI summary, and thumbnail
      // Note: for notes, db.saveItem will generate a placeholder URL
      const item = await saveItem(
        {
          type: itemType,
          url: isNote ? '' : (message.item.url || context.activeTab.url), // Empty string for notes, saveItem handles it
          title: message.item.title || (isNote ? null : context.activeTab.title),
          favicon: isNote ? null : (message.item.favicon || context.activeTab.favicon || null),
          thumbnail, // Tab screenshot thumbnail
          source: message.item.source || null,
          transcription: message.transcription,
          aiSummary,
          projectId: message.item.projectId || null,
          reason: message.item.reason || null,
          contextTabs: isNote ? [] : context.tabUrls,
          contextTabCount: isNote ? 0 : context.tabCount,
          status: 'saved',
          reminderAt: message.item.reminderAt || null,
        },
        embedding
      )

      // Schedule reminder alarm if reminderAt is set
      if (item.reminderAt) {
        await scheduleReminder(item.id, item.reminderAt)
        console.log(`[Background] Scheduled reminder for item ${item.id}`)
      }

      // Close the active tab if it's a tab save and closeTabOnSave is enabled
      // Use message override if provided, otherwise use global setting
      const shouldCloseTab = message.closeTabOnSave ?? settings.closeTabOnSave
      if (!isNote && shouldCloseTab) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id && activeTab.url && !activeTab.url.startsWith('chrome://')) {
            // Small delay to allow the popup to close first
            setTimeout(() => {
              chrome.tabs.remove(activeTab.id!).catch((err) => {
                console.error('[Background] Error closing tab:', err)
              })
            }, 500)
          }
        } catch (error) {
          console.error('[Background] Error closing tab after save:', error)
        }
      }

      // If NOT closing the tab, add it to project group if enabled
      if (!isNote && !shouldCloseTab && settings.useTabGroups && message.item.projectId) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id && activeTab.windowId) {
            // Get project info
            const projects = await getProjects()
            const project = projects.find((p) => p.id === message.item.projectId)

            if (project) {
              const groupId = await findOrCreateTabGroup(project.name, activeTab.windowId)

              if (groupId > 0) {
                // Add to existing group
                await chrome.tabs.group({ tabIds: activeTab.id, groupId })
                console.log(`[Background] Added tab to existing group: ${project.name}`)
              } else {
                // Create new group with the tab
                const newGroupId = await chrome.tabs.group({ tabIds: activeTab.id })
                await chrome.tabGroups.update(newGroupId, {
                  title: project.name,
                  color: mapToTabGroupColor(project.color),
                })
                console.log(`[Background] Created tab group: ${project.name}`)
              }
            }
          }
        } catch (error) {
          console.error('[Background] Error adding tab to group:', error)
        }
      }

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
      // Cancel any pending reminder alarm for this item
      await cancelReminder(message.id)
      await deleteItem(message.id)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'UPDATE_ITEM_PROJECT': {
      await updateItemProject(message.id, message.projectId)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'UPDATE_ITEM_REMINDER': {
      const { id, reminderAt } = message

      // Update the reminder in the database
      const updatedItem = await updateItemReminder(id, reminderAt)
      if (!updatedItem) {
        return { success: false, error: 'Item not found' }
      }

      // Schedule or cancel the alarm
      if (reminderAt) {
        await scheduleReminder(id, reminderAt)
      } else {
        await cancelReminder(id)
      }

      broadcastItemsChanged()
      return { success: true, item: updatedItem }
    }

    case 'UPDATE_ITEM': {
      const apiKeys = await getApiKeys()
      const { id, updates, captureNewThumbnail, tabId, windowId } = message

      // Get the current item to check what changed
      const currentItem = await getItemById(id)
      if (!currentItem) {
        return { success: false, error: 'Item not found' }
      }

      // Capture new thumbnail if requested (for existing items being updated)
      const finalUpdates = { ...updates }
      if (captureNewThumbnail && currentItem.type === 'tab') {
        try {
          const newThumbnail = await captureTabThumbnail({ tabId, windowId })
          if (newThumbnail) {
            finalUpdates.thumbnail = newThumbnail
            console.log('[Background] Captured new thumbnail for updated item')
          }
        } catch (error) {
          console.error('[Background] Error capturing thumbnail for update:', error)
          // Continue without updating thumbnail
        }
      }

      // Determine if we need to regenerate embedding
      // Regenerate if transcription or aiSummary changed
      let newEmbedding: number[] | null | undefined = undefined
      const transcriptionChanged = finalUpdates.transcription !== undefined && finalUpdates.transcription !== currentItem.transcription
      const aiSummaryChanged = finalUpdates.aiSummary !== undefined && finalUpdates.aiSummary !== currentItem.aiSummary

      if ((transcriptionChanged || aiSummaryChanged) && apiKeys.openai) {
        try {
          // Use the new values or fall back to current
          const transcription = finalUpdates.transcription ?? currentItem.transcription
          const aiSummary = finalUpdates.aiSummary ?? currentItem.aiSummary

          // Build text for embedding including title and URL (same as save flow)
          const textForEmbedding = buildTextForEmbedding({
            title: currentItem.title,
            url: currentItem.url,
            transcription,
            aiSummary,
          })

          newEmbedding = await generateEmbedding(textForEmbedding, apiKeys.openai)
          console.log('[Background] Regenerated embedding for updated item')
        } catch (error) {
          console.error('[Background] Error regenerating embedding:', error)
          // Continue without updating embedding
        }
      }

      // Update the item
      const updatedItem = await updateItem(id, finalUpdates, newEmbedding)

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

    case 'OPEN_ITEM_URL': {
      const { url, projectId } = message
      const settings = await getSettings()

      // Get current window
      const currentWindow = await chrome.windows.getCurrent()

      // Create the new tab
      const newTab = await chrome.tabs.create({ url })

      // Add to project group if enabled and has project
      if (settings.useTabGroups && projectId && newTab.id && currentWindow.id) {
        try {
          // Get project info
          const projects = await getProjects()
          const project = projects.find((p) => p.id === projectId)

          if (project) {
            const groupId = await findOrCreateTabGroup(project.name, currentWindow.id)

            if (groupId > 0) {
              // Add to existing group
              await chrome.tabs.group({ tabIds: newTab.id, groupId })
              console.log(`[Background] Opened tab in existing group: ${project.name}`)
            } else {
              // Create new group with the tab
              const newGroupId = await chrome.tabs.group({ tabIds: newTab.id })
              await chrome.tabGroups.update(newGroupId, {
                title: project.name,
                color: mapToTabGroupColor(project.color),
              })
              console.log(`[Background] Opened tab in new group: ${project.name}`)
            }
          }
        } catch (error) {
          console.error('[Background] Error adding opened tab to group:', error)
        }
      }

      return { success: true }
    }

    // Duplicate detection
    case 'CHECK_DUPLICATE_URL': {
      // Search by exact URL match (raw URL, no normalization)
      console.log('[Background] CHECK_DUPLICATE_URL - url:', message.url)
      const existingItem = await getItemByExactUrl(message.url)
      console.log('[Background] CHECK_DUPLICATE_URL - existingItem:', existingItem?.id, existingItem?.title)
      if (existingItem) {
        return { exists: true, item: existingItem }
      }
      return { exists: false }
    }

    // Trash operations
    case 'GET_DELETED_ITEMS': {
      const items = await getDeletedItems()
      return { items }
    }

    case 'RESTORE_ITEM': {
      const restoredItem = await restoreItem(message.id)
      if (!restoredItem) {
        return { success: false, error: 'Item not found' }
      }
      broadcastItemsChanged()
      return { success: true, item: restoredItem }
    }

    case 'PERMANENT_DELETE_ITEM': {
      await emptyTrashItem(message.id)
      broadcastItemsChanged()
      return { success: true }
    }

    case 'EMPTY_TRASH': {
      const count = await emptyAllTrash()
      broadcastItemsChanged()
      return { success: true, count }
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
