/**
 * i18n configuration
 * Defines supported locales and helpers for language detection
 */

// Supported locales - same as landing page
export const locales = ['en', 'pt', 'es'] as const
export type Locale = (typeof locales)[number]

// Default locale when browser language is not supported
export const defaultLocale: Locale = 'en'

// Human-readable labels for each locale
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
}

// Flag emojis for each locale (used in language selector)
export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  pt: '🇧🇷',
  es: '🇪🇸',
}

/**
 * Get the browser's preferred locale
 * Maps browser language codes to our supported locales
 * Falls back to defaultLocale if not supported
 */
export function getBrowserLocale(): Locale {
  const browserLang = navigator.language.split('-')[0]
  return locales.includes(browserLang as Locale) ? (browserLang as Locale) : defaultLocale
}

/**
 * Check if a string is a valid Locale
 */
export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}
