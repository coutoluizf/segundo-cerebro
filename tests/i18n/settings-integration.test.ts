/**
 * Integration tests for i18n settings persistence
 * Tests that language settings are properly saved and loaded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidLocale, type Locale } from '@/i18n/config'

// Mock chrome.storage.local for testing
const mockStorage: Record<string, unknown> = {}

const mockChromeStorage = {
  local: {
    get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockStorage, items)
      return Promise.resolve()
    }),
    remove: vi.fn((key: string) => {
      delete mockStorage[key]
      return Promise.resolve()
    }),
  },
}

// Define chrome global for tests
Object.defineProperty(global, 'chrome', {
  value: { storage: mockChromeStorage },
  writable: true,
  configurable: true,
})

// Mock navigator for browser detection
Object.defineProperty(global, 'navigator', {
  value: { language: 'en-US' },
  writable: true,
  configurable: true,
})

describe('i18n Settings Integration', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    vi.clearAllMocks()
  })

  describe('UserSettings Language Field', () => {
    it('should have language field typed as Locale', async () => {
      // Import settings after mocks are set up
      const { getSettings, saveSettings } = await import('@/shared/settings')

      // Get default settings
      const settings = await getSettings()

      // Language should be a valid Locale
      expect(isValidLocale(settings.language)).toBe(true)
    })

    it('should default to browser locale', async () => {
      const { getSettings } = await import('@/shared/settings')

      Object.defineProperty(global, 'navigator', {
        value: { language: 'pt-BR' },
        writable: true,
        configurable: true,
      })

      // Clear module cache to get fresh defaults
      vi.resetModules()
      const { getSettings: getSettingsFresh } = await import('@/shared/settings')

      const settings = await getSettingsFresh()

      // Should detect Portuguese from browser
      expect(settings.language).toBe('pt')
    })

    it('should persist language setting', async () => {
      const { getSettings, saveSettings } = await import('@/shared/settings')

      // Save Spanish language
      await saveSettings({ language: 'es' })

      // Retrieve settings
      const settings = await getSettings()

      expect(settings.language).toBe('es')
    })

    it('should migrate old pt-BR format to new pt format', async () => {
      // Set up old format in storage
      mockStorage['segundo-cerebro-settings'] = {
        language: 'pt-BR', // Old format
        autoSummarize: true,
        closeTabOnSave: true,
        useTabGroups: true,
      }

      vi.resetModules()
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      // Should migrate to 'pt' (base locale)
      expect(settings.language).toBe('pt')
      expect(isValidLocale(settings.language)).toBe(true)
    })

    it('should remove legacy summaryLanguage from stored settings', async () => {
      // Set up old format with summaryLanguage in storage
      mockStorage['segundo-cerebro-settings'] = {
        language: 'en',
        summaryLanguage: 'pt-BR', // Legacy field
        autoSummarize: true,
        closeTabOnSave: true,
        useTabGroups: true,
      }

      vi.resetModules()
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      // summaryLanguage should be removed
      expect(settings).not.toHaveProperty('summaryLanguage')
      // language should be preserved
      expect(settings.language).toBe('en')
    })
  })

  describe('Language Change Flow', () => {
    it('should save and retrieve different languages', async () => {
      const { saveSettings, getSettings } = await import('@/shared/settings')

      const languages: Locale[] = ['en', 'pt', 'es']

      for (const lang of languages) {
        await saveSettings({ language: lang })
        const settings = await getSettings()
        expect(settings.language).toBe(lang)
      }
    })

    it('should preserve other settings when changing language', async () => {
      const { saveSettings, getSettings } = await import('@/shared/settings')

      // Set initial settings
      await saveSettings({
        language: 'en',
        autoSummarize: false,
        closeTabOnSave: false,
        useTabGroups: false,
      })

      // Change only language
      await saveSettings({ language: 'pt' })

      const settings = await getSettings()

      expect(settings.language).toBe('pt')
      expect(settings.autoSummarize).toBe(false)
      expect(settings.closeTabOnSave).toBe(false)
      expect(settings.useTabGroups).toBe(false)
    })
  })

  describe('Unified Language for UI and AI Summaries', () => {
    it('should use single language field for both UI and AI summaries', async () => {
      const { getSettings, saveSettings } = await import('@/shared/settings')

      // Save Portuguese
      await saveSettings({ language: 'pt' })

      const settings = await getSettings()

      // Only one language field - used for both UI and AI summaries
      expect(settings.language).toBe('pt')
      expect(settings).not.toHaveProperty('summaryLanguage')
    })

    it('should not have separate summaryLanguage field', async () => {
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      // summaryLanguage was removed - language is now unified
      expect(settings).not.toHaveProperty('summaryLanguage')
    })
  })

  describe('Default Settings', () => {
    it('should have all required fields with defaults', async () => {
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      expect(settings).toHaveProperty('language')
      expect(settings).toHaveProperty('autoSummarize')
      expect(settings).toHaveProperty('closeTabOnSave')
      expect(settings).toHaveProperty('useTabGroups')
    })

    it('should have sensible default values', async () => {
      const { getSettings } = await import('@/shared/settings')

      // Clear storage to get pure defaults
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key])

      const settings = await getSettings()

      // Verify defaults
      expect(isValidLocale(settings.language)).toBe(true)
      expect(typeof settings.autoSummarize).toBe('boolean')
      expect(typeof settings.closeTabOnSave).toBe('boolean')
      expect(typeof settings.useTabGroups).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    it('should return defaults on storage error', async () => {
      // Mock storage error
      mockChromeStorage.local.get.mockRejectedValueOnce(new Error('Storage error'))

      vi.resetModules()
      const { getSettings } = await import('@/shared/settings')

      const settings = await getSettings()

      // Should return defaults
      expect(settings).toBeDefined()
      expect(isValidLocale(settings.language)).toBe(true)
    })
  })
})
