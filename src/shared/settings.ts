/**
 * User settings management
 * Stores preferences in chrome.storage.local
 * Optionally syncs UI language to Supabase for authenticated users
 */

import { getBrowserLocale, isValidLocale, type Locale } from '@/i18n/config'

// Settings interface
export interface UserSettings {
  language: Locale // UI language (en, pt, es) - also used for AI summaries
  autoSummarize: boolean // Whether to auto-generate AI summaries for tabs
  closeTabOnSave: boolean // Whether to close the tab after saving (only applies to tabs, not notes)
  useTabGroups: boolean // Whether to organize tabs in Chrome tab groups by project
}

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  language: getBrowserLocale(), // Dynamic default based on browser (also used for AI summaries)
  autoSummarize: true,
  closeTabOnSave: true, // Default to closing tab after save
  useTabGroups: true, // Default to organizing tabs in groups
}

// Storage key
const SETTINGS_KEY = 'segundo-cerebro-settings'

/**
 * Get user settings from chrome.storage.local
 */
export async function getSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY)
    const stored = result[SETTINGS_KEY]
    if (stored) {
      // Merge with defaults to handle new settings added in updates
      const merged = { ...DEFAULT_SETTINGS, ...stored }

      // Migration: if old 'language' was a full locale like 'pt-BR',
      // migrate to new UI locale format ('pt', 'en', 'es')
      if (stored.language && !isValidLocale(stored.language)) {
        // Old format like 'pt-BR' - extract base locale
        const oldLang = stored.language as string
        const baseLocale = oldLang.split('-')[0] as Locale
        merged.language = isValidLocale(baseLocale) ? baseLocale : getBrowserLocale()
      }

      // Remove legacy summaryLanguage if present (now unified with language)
      if ('summaryLanguage' in merged) {
        delete (merged as Record<string, unknown>).summaryLanguage
      }

      return merged
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error)
  }
  return DEFAULT_SETTINGS
}

/**
 * Save user settings to chrome.storage.local
 * Optionally syncs UI language to Supabase for authenticated users
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  try {
    const current = await getSettings()
    const updated = { ...current, ...settings }
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated })

    // Sync UI language to Supabase if authenticated
    if (settings.language) {
      syncLanguageToSupabase(settings.language).catch((e) => {
        console.warn('[Settings] Failed to sync language to Supabase:', e)
      })
    }

    return updated
  } catch (error) {
    console.error('[Settings] Error saving settings:', error)
    throw error
  }
}

/**
 * Sync UI language to Supabase user_profiles for authenticated users
 * This is a fire-and-forget operation - errors are logged but don't block the UI
 */
async function syncLanguageToSupabase(language: Locale): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies and keep bundle size down
    const { isAuthenticated } = await import('./auth')
    if (!(await isAuthenticated())) return

    const { getSupabaseClient } = await import('./supabase')
    const supabase = getSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('user_profiles').update({ language }).eq('id', user.id)
      console.log('[Settings] Language synced to Supabase:', language)
    }
  } catch (e) {
    // Silently fail - this is just a nice-to-have sync
    console.warn('[Settings] Failed to sync language to Supabase:', e)
  }
}

