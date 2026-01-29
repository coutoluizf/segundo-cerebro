/**
 * Auth Callback Component
 *
 * Handles the magic link redirect from Supabase Auth.
 * Shows loading state while processing, then redirects to dashboard.
 *
 * With Supabase multi-tenant architecture (RLS), no separate database
 * provisioning is needed - the shared database is already ready.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RajiLogo } from '@/components/RajiLogo'
import { handleMagicLinkCallback } from '@/shared/auth'

// Status states for the callback process
type CallbackStatus =
  | 'processing' // Initial state - processing the token
  | 'success' // All done, redirecting
  | 'error' // Something went wrong

export function Callback() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CallbackStatus>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Timeout safeguard: if processing takes too long, show error
    // Prevents infinite "processing" state if something goes wrong silently
    const timeoutId = setTimeout(() => {
      if (status === 'processing') {
        console.error('Callback timeout - processing took too long')
        setError(t('auth.timeout'))
        setStatus('error')
      }
    }, 30000) // 30 second timeout

    async function processCallback() {
      try {
        // Handle the magic link token
        console.log('Processing magic link callback...')
        const session = await handleMagicLinkCallback()

        if (!session) {
          setError(t('auth.failed'))
          setStatus('error')
          return
        }

        console.log('Session created:', session.user.email)

        // Success! Redirect to dashboard
        // With Supabase multi-tenant, the database is already ready (no provisioning needed)
        setStatus('success')

        // Small delay for visual feedback
        setTimeout(() => {
          // Get the extension's dashboard URL
          if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
            window.location.href = `chrome-extension://${chrome.runtime.id}/src/dashboard/index.html`
          } else {
            // Dev mode: redirect to localhost
            window.location.href = '/src/dashboard/index.html'
          }
        }, 1000)
      } catch (err) {
        console.error('Callback error:', err)
        setError(err instanceof Error ? err.message : t('auth.unexpected'))
        setStatus('error')
      }
    }

    processCallback()

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId)
  }, [status, t])

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-4">
      <div className="text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <RajiLogo size={80} />
        </div>

        {/* Status message */}
        <div className="space-y-4">
          {status === 'processing' && (
            <>
              <h1 className="text-2xl font-semibold text-white">{t('auth.verifying')}</h1>
              <p className="text-zinc-400">{t('auth.verifyingDesc')}</p>
              <LoadingSpinner />
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-2xl font-semibold text-green-400">{t('auth.welcome')}</h1>
              <p className="text-zinc-400">{t('auth.redirecting')}</p>
              <SuccessIcon />
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-2xl font-semibold text-red-400">{t('auth.error')}</h1>
              <p className="text-zinc-400 max-w-sm break-words">{error}</p>
              <button
                onClick={() => {
                  // Redirect to options page to try again
                  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                    window.location.href = `chrome-extension://${chrome.runtime.id}/src/options/index.html`
                  } else {
                    window.location.href = '/src/options/index.html'
                  }
                }}
                className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                {t('auth.tryAgain')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="flex justify-center mt-6">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-600 border-t-orange-500" />
    </div>
  )
}

/**
 * Success checkmark icon
 */
function SuccessIcon() {
  return (
    <div className="flex justify-center mt-6">
      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    </div>
  )
}
