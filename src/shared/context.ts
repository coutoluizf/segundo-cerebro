/**
 * Context capture utilities
 * Captures the active tab and related tabs context when saving
 */

import type { CapturedContext, TabSummary } from './types'

// Capture current context from Chrome tabs API
// This should be called from the background service worker
export async function captureContext(): Promise<CapturedContext> {
  // Get the current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!activeTab) {
    return {
      activeTab: { url: '', title: '' },
      tabUrls: [],
      tabCount: 0,
      timestamp: Date.now(),
    }
  }

  // Get all tabs in the current window
  const allTabs = await chrome.tabs.query({ currentWindow: true })

  // Extract URLs from other tabs (excluding the active one)
  const tabUrls = allTabs
    .filter(tab => tab.id !== activeTab.id && tab.url && !tab.url.startsWith('chrome://'))
    .map(tab => tab.url!)
    .slice(0, 20) // Limit to 20 related tabs

  return {
    activeTab: {
      url: activeTab.url || '',
      title: activeTab.title || '',
      favicon: activeTab.favIconUrl,
    },
    tabUrls,
    tabCount: allTabs.length,
    timestamp: Date.now(),
  }
}

// Get tab summaries for display
export async function getTabSummaries(): Promise<TabSummary[]> {
  const allTabs = await chrome.tabs.query({ currentWindow: true })

  return allTabs
    .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
    .map(tab => ({
      url: tab.url!,
      title: tab.title || 'Untitled',
      favicon: tab.favIconUrl,
    }))
}
