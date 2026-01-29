/**
 * useLanguage hook
 * Provides easy access to the current language and language switching functionality
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, type Locale, locales, localeLabels, localeFlags } from './index'

/**
 * Hook to get/set language with storage sync
 * Language changes are persisted via the settings system
 */
export function useLanguage() {
  const { i18n } = useTranslation()

  /**
   * Change the UI language
   * Note: Caller is responsible for persisting to settings via sendMessage
   * This separation allows the hook to be pure and not depend on messaging
   */
  const setLanguage = useCallback(
    async (locale: Locale) => {
      await changeLanguage(locale)
    },
    []
  )

  return {
    // Current language
    currentLanguage: i18n.language as Locale,

    // Change language function
    setLanguage,

    // Available locales for building UI selectors
    locales,
    localeLabels,
    localeFlags,
  }
}
