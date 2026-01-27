/**
 * Core types for HeyRaji
 * Defines the data structures for voice items, projects, and contexts
 */

// Item type: 'tab' for saved tabs, 'note' for quick notes/clipboard
export type ItemType = 'tab' | 'note'

// Placeholder URL prefix for notes (since url column is NOT NULL in DB)
export const NOTE_URL_PREFIX = 'note://local/'

// Check if a URL is a note placeholder
export function isNoteUrl(url: string): boolean {
  return url.startsWith(NOTE_URL_PREFIX)
}

// A saved voice item with semantic embedding
export interface VoiceItem {
  id: string
  type: ItemType // 'tab' or 'note'
  url: string // For notes, uses 'note://local/{id}' placeholder
  urlHash: string
  title: string | null
  favicon: string | null
  thumbnail: string | null // Data URL base64 screenshot of the tab
  source: string | null // Optional source for notes (e.g., "Twitter @user", "Conversa com João")
  transcription: string
  aiSummary: string | null // AI-generated summary of page content
  projectId: string | null
  reason: string | null
  contextTabs: string[] // JSON array of related tab URLs
  contextTabCount: number
  embedding: number[] | null // 1536d vector from OpenAI
  createdAt: number // Unix timestamp
  status: 'saved' | 'archived' | 'deleted'
  reminderAt: number | null // Unix timestamp for when to trigger reminder
}

// Project for organizing voice items
export interface Project {
  id: string
  name: string
  color: string | null
  createdAt: number
}

// Captured context when saving a tab
export interface CapturedContext {
  activeTab: {
    url: string
    title: string
    favicon?: string
  }
  tabUrls: string[]
  tabCount: number
  timestamp: number
}

// Tab summary for context capture
export interface TabSummary {
  url: string
  title: string
  favicon?: string
}

// Search result with similarity score
export interface SearchResult extends VoiceItem {
  similarity: number // 0-1, higher is more similar
}

// API keys stored in chrome.storage.local
export interface ApiKeys {
  elevenlabs?: string
  openai?: string
}

// Scribe client states
export type ScribeState = 'idle' | 'connecting' | 'listening' | 'processing' | 'error'

// Utility type for creating new items (reminderAt is optional on creation)
export type NewVoiceItem = Omit<VoiceItem, 'id' | 'createdAt' | 'embedding' | 'reminderAt'> & {
  reminderAt?: number | null
}

// Utility to generate URL hash for deduplication
export function generateUrlHash(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}
