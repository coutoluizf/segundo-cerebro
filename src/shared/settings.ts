/**
 * User settings management
 * Stores preferences in chrome.storage.local
 */

// Settings interface
export interface UserSettings {
  language: string // Language for AI summaries (e.g., 'pt-BR', 'en-US')
  autoSummarize: boolean // Whether to auto-generate AI summaries for tabs
}

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  language: 'pt-BR',
  autoSummarize: true,
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
      return { ...DEFAULT_SETTINGS, ...stored }
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error)
  }
  return DEFAULT_SETTINGS
}

/**
 * Save user settings to chrome.storage.local
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  try {
    const current = await getSettings()
    const updated = { ...current, ...settings }
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated })
    return updated
  } catch (error) {
    console.error('[Settings] Error saving settings:', error)
    throw error
  }
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(code: string): string {
  const languages: Record<string, string> = {
    'pt-BR': 'Português (Brasil)',
    'en-US': 'English (US)',
    'es-ES': 'Español',
    'fr-FR': 'Français',
    'de-DE': 'Deutsch',
    'it-IT': 'Italiano',
    'ja-JP': '日本語',
    'ko-KR': '한국어',
    'zh-CN': '中文 (简体)',
  }
  return languages[code] || code
}

/**
 * Available languages for AI summaries
 */
export const AVAILABLE_LANGUAGES = [
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'zh-CN', name: '中文 (简体)' },
]
