/**
 * Options page entry point
 * Initializes i18n with user's language preference before rendering
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Options } from './Options'
import { initSystemTheme } from '@/shared/theme'
import { getSettings } from '@/shared/settings'
import { initI18n } from '@/i18n'
import '@/index.css'

// Initialize theme before rendering
initSystemTheme()

// Bootstrap function to handle async i18n initialization
async function bootstrap() {
  // Get saved language from settings
  const settings = await getSettings()

  // Initialize i18n with saved language (or browser default)
  await initI18n(settings.language)

  // Render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  )
}

// Start the app
bootstrap()
