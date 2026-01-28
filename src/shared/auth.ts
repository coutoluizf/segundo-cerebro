/**
 * Authentication module for HeyRaji
 *
 * Provides functions for user authentication using Supabase OTP (One-Time Password).
 * Users sign in with email + 6-digit code - no password needed, no redirect issues.
 */

import { getSupabaseClient, getSession, isAuthenticated } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

// Export re-exported functions for convenience
export { getSession, isAuthenticated }

/**
 * Send OTP code to email
 *
 * Sends a 6-digit verification code to the user's email.
 * User will enter this code in the extension to complete login.
 *
 * @param email - User's email address
 * @returns Promise that resolves when email is sent
 * @throws Error if email sending fails
 */
export async function sendOtpCode(email: string): Promise<void> {
  const supabase = getSupabaseClient()

  console.log('Sending OTP code to:', email)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Don't create a magic link, just send the OTP code
      shouldCreateUser: true,
    },
  })

  if (error) {
    console.error('Send OTP error:', error)
    throw new Error(error.message)
  }
}

/**
 * Verify OTP code and complete sign in
 *
 * Verifies the 6-digit code entered by the user and creates a session.
 *
 * @param email - User's email address
 * @param code - 6-digit OTP code from email
 * @returns Session if successful
 * @throws Error if verification fails
 */
export async function verifyOtpCode(email: string, code: string): Promise<Session> {
  const supabase = getSupabaseClient()

  console.log('Verifying OTP code for:', email)

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  })

  if (error) {
    console.error('Verify OTP error:', error)
    throw new Error(error.message)
  }

  if (!data.session) {
    throw new Error('No session returned after verification')
  }

  console.log('OTP verified, session created for:', data.session.user.email)
  return data.session
}

/**
 * Sign in with Magic Link (legacy - kept for compatibility)
 *
 * @deprecated Use sendOtpCode + verifyOtpCode instead
 */
export async function signInWithMagicLink(email: string): Promise<void> {
  // Now just sends OTP code instead
  await sendOtpCode(email)
}

/**
 * Sign out the current user
 *
 * Clears the session from storage and signs out from Supabase.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign out error:', error)
    throw new Error(error.message)
  }
}

/**
 * Get the current user
 *
 * @returns User object if authenticated, null otherwise
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession()
  return session?.user || null
}

/**
 * Handle the magic link callback
 *
 * This should be called on the callback page to exchange the token
 * in the URL for a session.
 *
 * @returns Session if successful, null otherwise
 */
export async function handleMagicLinkCallback(): Promise<Session | null> {
  const supabase = getSupabaseClient()

  // Get the hash params from the URL
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  // Also check query params (some redirects use query instead of hash)
  const queryParams = new URLSearchParams(window.location.search)
  const code = queryParams.get('code')

  if (code) {
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Failed to exchange code for session:', error)
      return null
    }
    return data.session
  }

  if (accessToken && refreshToken) {
    // Set the session directly
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) {
      console.error('Failed to set session:', error)
      return null
    }
    return data.session
  }

  // Try to get existing session (might already be set)
  return await getSession()
}

/**
 * Subscribe to auth state changes
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const supabase = getSupabaseClient()

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })

  return () => {
    subscription.unsubscribe()
  }
}
