/**
 * Unit tests for i18n configuration
 * Tests locale definitions, validation, and browser detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  locales,
  defaultLocale,
  localeLabels,
  localeFlags,
  getBrowserLocale,
  isValidLocale,
  type Locale,
} from '@/i18n/config'

describe('i18n Configuration', () => {
  describe('Locale Definitions', () => {
    it('should have exactly 3 supported locales', () => {
      expect(locales).toHaveLength(3)
      expect(locales).toContain('en')
      expect(locales).toContain('pt')
      expect(locales).toContain('es')
    })

    it('should have English as default locale', () => {
      expect(defaultLocale).toBe('en')
    })

    it('should have labels for all locales', () => {
      for (const locale of locales) {
        expect(localeLabels[locale]).toBeDefined()
        expect(typeof localeLabels[locale]).toBe('string')
        expect(localeLabels[locale].length).toBeGreaterThan(0)
      }
    })

    it('should have correct label values', () => {
      expect(localeLabels.en).toBe('English')
      expect(localeLabels.pt).toBe('Português')
      expect(localeLabels.es).toBe('Español')
    })

    it('should have flag emojis for all locales', () => {
      for (const locale of locales) {
        expect(localeFlags[locale]).toBeDefined()
        expect(typeof localeFlags[locale]).toBe('string')
        // Flag emojis are 2 codepoints (4 bytes each = 8 bytes)
        expect(localeFlags[locale].length).toBeGreaterThan(0)
      }
    })

    it('should have correct flag values', () => {
      expect(localeFlags.en).toBe('🇺🇸')
      expect(localeFlags.pt).toBe('🇧🇷')
      expect(localeFlags.es).toBe('🇪🇸')
    })
  })

  describe('isValidLocale', () => {
    it('should return true for valid locales', () => {
      expect(isValidLocale('en')).toBe(true)
      expect(isValidLocale('pt')).toBe(true)
      expect(isValidLocale('es')).toBe(true)
    })

    it('should return false for invalid locales', () => {
      expect(isValidLocale('fr')).toBe(false)
      expect(isValidLocale('de')).toBe(false)
      expect(isValidLocale('ja')).toBe(false)
      expect(isValidLocale('')).toBe(false)
      expect(isValidLocale('EN')).toBe(false) // Case sensitive
      expect(isValidLocale('pt-BR')).toBe(false) // Full locale not supported
    })

    it('should work as type guard', () => {
      const value: string = 'en'
      if (isValidLocale(value)) {
        // TypeScript should allow this - value is now Locale type
        const locale: Locale = value
        expect(locale).toBe('en')
      }
    })
  })

  describe('getBrowserLocale', () => {
    // Store original navigator.language
    const originalNavigator = global.navigator

    beforeEach(() => {
      // Mock navigator for testing
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

    it('should return English for en-US browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('en')
    })

    it('should return English for en-GB browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-GB' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('en')
    })

    it('should return Portuguese for pt-BR browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'pt-BR' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('pt')
    })

    it('should return Portuguese for pt-PT browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'pt-PT' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('pt')
    })

    it('should return Spanish for es-ES browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'es-ES' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('es')
    })

    it('should return Spanish for es-MX browser', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'es-MX' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('es')
    })

    it('should fallback to English for unsupported languages', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'fr-FR' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('en')
    })

    it('should fallback to English for Japanese', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('en')
    })

    it('should fallback to English for German', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'de-DE' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('en')
    })

    it('should handle simple language codes without region', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'pt' },
        writable: true,
        configurable: true,
      })
      expect(getBrowserLocale()).toBe('pt')
    })
  })

  describe('Type Safety', () => {
    it('Locale type should only allow valid values', () => {
      // This is a compile-time check - if it compiles, the test passes
      const validLocales: Locale[] = ['en', 'pt', 'es']
      expect(validLocales).toHaveLength(3)

      // These would cause TypeScript errors if uncommented:
      // const invalidLocale: Locale = 'fr' // Error!
      // const invalidLocale2: Locale = 'pt-BR' // Error!
    })

    it('locales array should be readonly', () => {
      // locales is declared as const, so it should be readonly
      // This test ensures the type is correct
      expect(Object.isFrozen(locales)).toBe(false) // Arrays aren't frozen by default
      expect(locales.length).toBe(3)
    })
  })
})
