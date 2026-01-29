/**
 * i18n initialization
 * Sets up i18next with React bindings and loads translation resources
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getBrowserLocale, isValidLocale, type Locale } from './config'

// Import translation files
import en from './locales/en.json'
import pt from './locales/pt.json'
import es from './locales/es.json'

// Translation resources bundled with the extension
const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
}

/**
 * Initialize i18next with the specified language
 * If no language is provided, uses the browser's preferred language
 *
 * @param savedLanguage - Language code from user settings (optional)
 * @returns Initialized i18n instance
 */
export async function initI18n(savedLanguage?: string): Promise<typeof i18n> {
  // Determine which language to use:
  // 1. If savedLanguage is valid, use it
  // 2. Otherwise, detect from browser
  let lng: Locale

  if (savedLanguage && isValidLocale(savedLanguage)) {
    lng = savedLanguage
  } else {
    lng = getBrowserLocale()
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: {
      // React already escapes values
      escapeValue: false,
    },
    // Disable suspense to avoid issues in extension context
    react: {
      useSuspense: false,
    },
  })

  return i18n
}

/**
 * Change the current language
 * This is typically called from the useLanguage hook after saving to settings
 *
 * @param locale - New language code
 */
export async function changeLanguage(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale)
}

// Export the i18n instance for direct access if needed
export { i18n }

// Re-export types and config for convenience
export * from './config'
