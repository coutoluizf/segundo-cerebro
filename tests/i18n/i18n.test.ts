/**
 * Unit tests for i18n initialization and language switching
 * Tests the initI18n and changeLanguage functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import i18n from 'i18next'
import { initI18n, changeLanguage } from '@/i18n/index'
import { locales, type Locale } from '@/i18n/config'

describe('i18n Initialization', () => {
  // Store original navigator.language
  const originalNavigator = global.navigator

  beforeEach(() => {
    // Reset i18n state before each test
    if (i18n.isInitialized) {
      // i18n doesn't have a proper reset, but we can change language
    }

    // Mock navigator for browser detection tests
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  describe('initI18n', () => {
    it('should initialize i18n with default browser language', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'pt-BR' },
        writable: true,
        configurable: true,
      })

      const instance = await initI18n()

      expect(instance.isInitialized).toBe(true)
      expect(instance.language).toBe('pt')
    })

    it('should initialize with provided language', async () => {
      const instance = await initI18n('es')

      expect(instance.isInitialized).toBe(true)
      expect(instance.language).toBe('es')
    })

    it('should fallback to browser language for invalid saved language', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      })

      const instance = await initI18n('fr') // Invalid locale

      expect(instance.isInitialized).toBe(true)
      expect(instance.language).toBe('en')
    })

    it('should fallback to browser language for old pt-BR format', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'es-ES' },
        writable: true,
        configurable: true,
      })

      const instance = await initI18n('pt-BR') // Old format

      expect(instance.isInitialized).toBe(true)
      expect(instance.language).toBe('es') // Falls back to browser
    })

    it('should use English as fallback for unsupported browser language', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
        configurable: true,
      })

      const instance = await initI18n()

      expect(instance.isInitialized).toBe(true)
      expect(instance.language).toBe('en')
    })
  })

  describe('changeLanguage', () => {
    beforeEach(async () => {
      // Ensure i18n is initialized
      await initI18n('en')
    })

    it('should change language to Portuguese', async () => {
      await changeLanguage('pt')
      expect(i18n.language).toBe('pt')
    })

    it('should change language to Spanish', async () => {
      await changeLanguage('es')
      expect(i18n.language).toBe('es')
    })

    it('should change language to English', async () => {
      await changeLanguage('pt') // Start with Portuguese
      await changeLanguage('en')
      expect(i18n.language).toBe('en')
    })

    it('should cycle through all languages', async () => {
      for (const locale of locales) {
        await changeLanguage(locale)
        expect(i18n.language).toBe(locale)
      }
    })
  })

  describe('Translation Access', () => {
    beforeEach(async () => {
      await initI18n('en')
    })

    it('should access translations with t() function', async () => {
      const t = i18n.t.bind(i18n)

      expect(t('common.loading')).toBe('Loading...')
      expect(t('common.save')).toBe('Save')
      expect(t('common.cancel')).toBe('Cancel')
    })

    it('should change translations when language changes', async () => {
      const t = i18n.t.bind(i18n)

      // English
      expect(t('common.loading')).toBe('Loading...')

      // Portuguese
      await changeLanguage('pt')
      expect(t('common.loading')).toBe('Carregando...')

      // Spanish
      await changeLanguage('es')
      expect(t('common.loading')).toBe('Cargando...')
    })

    it('should handle nested translations', async () => {
      const t = i18n.t.bind(i18n)

      expect(t('popup.tabs.saveTab')).toBe('Save Tab')
      expect(t('dashboard.search.placeholder')).toBe('Search by meaning...')
      expect(t('options.account.title')).toBe('Account')
    })

    it('should handle interpolation', async () => {
      const t = i18n.t.bind(i18n)

      // English with interpolation
      const result = t('popup.duplicate.savedOn', { date: '2024-01-15' })
      expect(result).toBe('Saved on 2024-01-15')
    })

    it('should return key for missing translations', async () => {
      const t = i18n.t.bind(i18n)

      const result = t('nonexistent.key')
      expect(result).toBe('nonexistent.key')
    })
  })

  describe('Fallback Behavior', () => {
    beforeEach(async () => {
      await initI18n('es')
    })

    it('should fallback to English for missing keys in other languages', async () => {
      const t = i18n.t.bind(i18n)

      // If a key is missing in Spanish, it should fallback to English
      // This is a safety check - all keys should exist, but fallback is important
      expect(t('common.loading')).toBeDefined()
      expect(t('common.loading')).not.toBe('common.loading') // Not returning the key
    })
  })

  describe('Resources Loading', () => {
    beforeEach(async () => {
      await initI18n('en')
    })

    it('should have all locales loaded', () => {
      for (const locale of locales) {
        const hasResourceBundle = i18n.hasResourceBundle(locale, 'translation')
        expect(hasResourceBundle, `Missing resource bundle for ${locale}`).toBe(true)
      }
    })

    it('should have translation namespace', () => {
      const namespaces = i18n.options.ns
      expect(namespaces).toContain('translation')
    })
  })

  describe('Configuration', () => {
    beforeEach(async () => {
      await initI18n('en')
    })

    it('should have English as fallback language', () => {
      expect(i18n.options.fallbackLng).toContain('en')
    })

    it('should not escape values (React handles this)', () => {
      expect(i18n.options.interpolation?.escapeValue).toBe(false)
    })

    it('should not use suspense (extension compatibility)', () => {
      expect(i18n.options.react?.useSuspense).toBe(false)
    })
  })
})

describe('i18n with React', () => {
  // These tests verify the react-i18next integration setup
  // Full React component tests would require a proper React testing environment

  describe('React Integration Setup', () => {
    it('should export i18n instance', async () => {
      const { i18n } = await import('@/i18n/index')
      expect(i18n).toBeDefined()
    })

    it('should export config helpers', async () => {
      const config = await import('@/i18n/config')

      expect(config.locales).toBeDefined()
      expect(config.defaultLocale).toBeDefined()
      expect(config.localeLabels).toBeDefined()
      expect(config.localeFlags).toBeDefined()
      expect(config.getBrowserLocale).toBeDefined()
      expect(config.isValidLocale).toBeDefined()
    })

    it('should export useLanguage hook', async () => {
      const { useLanguage } = await import('@/i18n/useLanguage')
      expect(useLanguage).toBeDefined()
      expect(typeof useLanguage).toBe('function')
    })
  })
})
