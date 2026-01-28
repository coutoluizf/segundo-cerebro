/**
 * Supabase client configuration for HeyRaji
 *
 * This module provides a singleton Supabase client configured for Chrome extension use.
 * It uses chrome.storage.local for session persistence, which works across extension contexts.
 */

import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'

// Supabase project configuration
// These are public keys - safe to include in client code
const SUPABASE_URL = 'https://mfczpquwzyrczsnjbgaa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY3pwcXV3enlyY3pzbmpiZ2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTQ4NTcsImV4cCI6MjA4NTA5MDg1N30.CFB7GhZdMLwnjznSWwru4cquwXEBn60mKFRP3A3tEZg'

// Storage key prefix for session data
const STORAGE_KEY = 'heyraji-supabase-auth'

/**
 * Custom storage adapter for chrome.storage.local
 * This allows Supabase to persist sessions in the extension's local storage.
 */
const chromeStorageAdapter = {
  /**
   * Get item from chrome.storage.local
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(key)
        return result[key] || null
      }
      // Fallback to localStorage for dev mode
      return localStorage.getItem(key)
    } catch (error) {
      console.error('Failed to get item from storage:', error)
      return null
    }
  },

  /**
   * Set item in chrome.storage.local
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Check if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: value })
      } else {
        // Fallback to localStorage for dev mode
        localStorage.setItem(key, value)
      }
    } catch (error) {
      console.error('Failed to set item in storage:', error)
    }
  },

  /**
   * Remove item from chrome.storage.local
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      // Check if we're in extension context
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(key)
      } else {
        // Fallback to localStorage for dev mode
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.error('Failed to remove item from storage:', error)
    }
  },
}

// Singleton Supabase client instance
let supabaseClient: SupabaseClient | null = null

/**
 * Get the Supabase client singleton
 *
 * Creates the client on first call with chrome.storage.local persistence.
 * Subsequent calls return the same instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: chromeStorageAdapter,
        storageKey: STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabaseClient
}

/**
 * Get current session if exists
 * Returns null if user is not authenticated
 */
export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Failed to get session:', error)
    return null
  }

  return session
}

/**
 * Get the current access token for API calls
 * Returns null if user is not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.access_token || null
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

// Export constants for use in other modules
export { SUPABASE_URL, SUPABASE_ANON_KEY }
