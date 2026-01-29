/**
 * Integration tests for i18n translations
 * Verifies that all translation files are consistent and complete
 */

import { describe, it, expect } from 'vitest'
import { locales } from '@/i18n/config'

// Import all translation files
import en from '@/i18n/locales/en.json'
import pt from '@/i18n/locales/pt.json'
import es from '@/i18n/locales/es.json'

// Type for translation structure
type TranslationObject = { [key: string]: string | TranslationObject }

// Helper to get all keys from a nested object (flattened with dot notation)
function getAllKeys(obj: TranslationObject, prefix = ''): string[] {
  const keys: string[] = []

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value as TranslationObject, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys.sort()
}

// Helper to get value by dot notation path
function getValueByPath(obj: TranslationObject, path: string): string | undefined {
  const parts = path.split('.')
  let current: TranslationObject | string = obj

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined
    }
    current = current[part]
  }

  return typeof current === 'string' ? current : undefined
}

// Map of translations by locale
const translations: Record<string, TranslationObject> = {
  en,
  pt,
  es,
}

describe('i18n Translation Files', () => {
  describe('File Structure', () => {
    it('should have translation files for all supported locales', () => {
      for (const locale of locales) {
        expect(translations[locale]).toBeDefined()
        expect(typeof translations[locale]).toBe('object')
      }
    })

    it('should have the same top-level sections in all locales', () => {
      const enSections = Object.keys(en).sort()

      for (const locale of locales) {
        if (locale === 'en') continue

        const localeSections = Object.keys(translations[locale]).sort()
        expect(localeSections).toEqual(enSections)
      }
    })
  })

  describe('Key Consistency', () => {
    // Get all keys from English (reference)
    const enKeys = getAllKeys(en)

    it('English should have all required top-level sections', () => {
      const expectedSections = [
        'common',
        'popup',
        'dashboard',
        'options',
        'auth',
        'voice',
        'item',
        'reminder',
      ]

      const actualSections = Object.keys(en)

      for (const section of expectedSections) {
        expect(actualSections).toContain(section)
      }
    })

    it('Portuguese should have all keys from English', () => {
      const ptKeys = getAllKeys(pt)
      const missingKeys = enKeys.filter((key) => !ptKeys.includes(key))

      if (missingKeys.length > 0) {
        console.log('Missing keys in Portuguese:', missingKeys)
      }

      expect(missingKeys).toEqual([])
    })

    it('Spanish should have all keys from English', () => {
      const esKeys = getAllKeys(es)
      const missingKeys = enKeys.filter((key) => !esKeys.includes(key))

      if (missingKeys.length > 0) {
        console.log('Missing keys in Spanish:', missingKeys)
      }

      expect(missingKeys).toEqual([])
    })

    it('Portuguese should not have extra keys', () => {
      const ptKeys = getAllKeys(pt)
      const extraKeys = ptKeys.filter((key) => !enKeys.includes(key))

      if (extraKeys.length > 0) {
        console.log('Extra keys in Portuguese:', extraKeys)
      }

      expect(extraKeys).toEqual([])
    })

    it('Spanish should not have extra keys', () => {
      const esKeys = getAllKeys(es)
      const extraKeys = esKeys.filter((key) => !enKeys.includes(key))

      if (extraKeys.length > 0) {
        console.log('Extra keys in Spanish:', extraKeys)
      }

      expect(extraKeys).toEqual([])
    })
  })

  describe('Translation Values', () => {
    it('should not have empty translation values', () => {
      for (const locale of locales) {
        const keys = getAllKeys(translations[locale])

        for (const key of keys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Empty value for ${locale}.${key}`).toBeDefined()
          expect(value?.length, `Empty string for ${locale}.${key}`).toBeGreaterThan(0)
        }
      }
    })

    it('should not have untranslated values (same as English)', () => {
      const enKeys = getAllKeys(en)

      // Skip keys that are likely intentionally the same (proper nouns, codes, etc.)
      const skipPatterns = [
        'AI', // Acronym
        'Email', // Common in all languages
        'email', // Email address format
        'ElevenLabs',
        'OpenAI',
        'HeyRaji',
        'Dashboard', // Brand/product name
      ]

      for (const locale of locales) {
        if (locale === 'en') continue

        const untranslated: string[] = []

        for (const key of enKeys) {
          const enValue = getValueByPath(en, key)
          const localeValue = getValueByPath(translations[locale], key)

          // Skip if values match skip patterns
          const shouldSkip = skipPatterns.some(
            (pattern) => enValue?.includes(pattern) || key.includes(pattern)
          )

          if (!shouldSkip && enValue === localeValue && enValue && enValue.length > 3) {
            untranslated.push(`${key}: "${enValue}"`)
          }
        }

        if (untranslated.length > 0) {
          console.warn(`\nPossibly untranslated in ${locale}:`, untranslated.slice(0, 10))
        }

        // Allow some untranslated strings but warn if too many
        // This is a soft check - some strings may be intentionally the same
        expect(untranslated.length).toBeLessThan(20)
      }
    })

    it('should preserve interpolation placeholders', () => {
      const enKeys = getAllKeys(en)
      const placeholderRegex = /\{\{[^}]+\}\}/g

      for (const locale of locales) {
        if (locale === 'en') continue

        for (const key of enKeys) {
          const enValue = getValueByPath(en, key) || ''
          const localeValue = getValueByPath(translations[locale], key) || ''

          const enPlaceholders = (enValue.match(placeholderRegex) || []).sort()
          const localePlaceholders = (localeValue.match(placeholderRegex) || []).sort()

          expect(
            localePlaceholders,
            `Placeholder mismatch in ${locale}.${key}. EN: ${enPlaceholders}, ${locale.toUpperCase()}: ${localePlaceholders}`
          ).toEqual(enPlaceholders)
        }
      }
    })
  })

  describe('Common Section', () => {
    it('should have all common UI strings', () => {
      const commonKeys = [
        'common.loading',
        'common.error',
        'common.success',
        'common.save',
        'common.cancel',
        'common.delete',
        'common.confirm',
        'common.close',
      ]

      for (const locale of locales) {
        for (const key of commonKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Popup Section', () => {
    it('should have tab saving strings', () => {
      const popupKeys = ['popup.tabs.saveTab', 'popup.tabs.quickNote', 'popup.buttons.saveTab']

      for (const locale of locales) {
        for (const key of popupKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })

    it('should have duplicate warning strings', () => {
      const duplicateKeys = [
        'popup.duplicate.warning',
        'popup.duplicate.updateExisting',
        'popup.duplicate.saveAsNew',
      ]

      for (const locale of locales) {
        for (const key of duplicateKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Dashboard Section', () => {
    it('should have search strings', () => {
      const searchKeys = [
        'dashboard.search.placeholder',
        'dashboard.search.listening',
        'dashboard.search.speakSearch',
      ]

      for (const locale of locales) {
        for (const key of searchKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })

    it('should have empty state strings', () => {
      const emptyKeys = [
        'dashboard.empty.noResults',
        'dashboard.empty.startSaving',
        'dashboard.empty.useExtension',
      ]

      for (const locale of locales) {
        for (const key of emptyKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })

    it('should have trash strings', () => {
      const trashKeys = [
        'dashboard.trash.title',
        'dashboard.trash.empty',
        'dashboard.trash.restore',
        'dashboard.trash.emptyTrash',
      ]

      for (const locale of locales) {
        for (const key of trashKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Options Section', () => {
    it('should have account strings', () => {
      const accountKeys = [
        'options.account.title',
        'options.account.loggedIn',
        'options.account.signOut',
      ]

      for (const locale of locales) {
        for (const key of accountKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })

    it('should have AI settings strings', () => {
      const aiKeys = [
        'options.ai.title',
        'options.ai.autoSummarize.label',
        'options.ai.language.label',
      ]

      for (const locale of locales) {
        for (const key of aiKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Auth Section', () => {
    it('should have authentication flow strings', () => {
      const authKeys = [
        'auth.verifying',
        'auth.welcome',
        'auth.redirecting',
        'auth.error',
        'auth.tryAgain',
      ]

      for (const locale of locales) {
        for (const key of authKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Voice Section', () => {
    it('should have recording state strings', () => {
      const voiceKeys = [
        'voice.connecting',
        'voice.processing',
        'voice.recording',
        'voice.clickToStop',
      ]

      for (const locale of locales) {
        for (const key of voiceKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Item Section', () => {
    it('should have item type strings', () => {
      const itemKeys = ['item.type.tab', 'item.type.note', 'item.untitled', 'item.openOriginal']

      for (const locale of locales) {
        for (const key of itemKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Reminder Section', () => {
    it('should have reminder strings', () => {
      const reminderKeys = [
        'reminder.title',
        'reminder.setReminder',
        'reminder.clearReminder',
        'reminder.tomorrow',
        'reminder.nextWeek',
      ]

      for (const locale of locales) {
        for (const key of reminderKeys) {
          const value = getValueByPath(translations[locale], key)
          expect(value, `Missing ${key} in ${locale}`).toBeDefined()
        }
      }
    })
  })

  describe('Translation Statistics', () => {
    it('should report translation coverage', () => {
      const enKeys = getAllKeys(en)
      const totalKeys = enKeys.length

      console.log('\n📊 Translation Statistics:')
      console.log(`   Total keys: ${totalKeys}`)

      for (const locale of locales) {
        const localeKeys = getAllKeys(translations[locale])
        const coverage = Math.round((localeKeys.length / totalKeys) * 100)
        console.log(`   ${locale.toUpperCase()}: ${localeKeys.length} keys (${coverage}%)`)
      }

      // All locales should have 100% coverage
      for (const locale of locales) {
        const localeKeys = getAllKeys(translations[locale])
        expect(localeKeys.length).toBe(totalKeys)
      }
    })
  })
})
