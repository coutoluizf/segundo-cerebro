/**
 * Auth callback entry point
 *
 * This page handles the magic link redirect from Supabase Auth.
 * It extracts the token from the URL and completes the sign-in process.
 * Initializes i18n with user's language preference before rendering.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Callback } from './Callback'
import { getSettings } from '@/shared/settings'
import { initI18n } from '@/i18n'
import '../index.css'

// Bootstrap function to handle async i18n initialization
async function bootstrap() {
  // Get saved language from settings
  const settings = await getSettings()

  // Initialize i18n with saved language (or browser default)
  await initI18n(settings.language)

  // Render the callback component
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Callback />
    </React.StrictMode>
  )
}

// Start the app
bootstrap()
