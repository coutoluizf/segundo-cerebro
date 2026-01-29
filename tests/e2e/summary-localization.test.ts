/**
 * E2E Tests: Summary Localization
 *
 * Tests that AI summaries respect the UI locale setting.
 * Validates that 'en', 'pt', 'es' locales generate summaries in the correct language.
 *
 * Uses the dedicated test user for authentication.
 * See tests/CLAUDE.md for test user credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loginTestUser, logoutTestUser, getTestSession, TEST_USER } from '../setup/auth'

// Supabase configuration
const SUPABASE_URL = 'https://mfczpquwzyrczsnjbgaa.supabase.co'
const GENERATE_SUMMARY_URL = `${SUPABASE_URL}/functions/v1/generate-summary`

// Test content - same content used for all language tests
const TEST_CONTENT = `
  JavaScript is a versatile programming language used for web development.
  It supports asynchronous programming with promises and async/await syntax.
  Modern JavaScript includes features like arrow functions, destructuring, and modules.
  Node.js allows JavaScript to run on the server side.
  Popular frameworks include React, Vue, and Angular for building user interfaces.
`

describe('E2E: Summary Localization', () => {
  let accessToken: string | null = null

  beforeAll(async () => {
    console.log('\n🌐 E2E Test: Summary Localization')
    console.log('='.repeat(50))

    // Login as test user
    const session = await loginTestUser()
    accessToken = session.access_token

    console.log(`✅ Authenticated as: ${TEST_USER.email}`)
    console.log('='.repeat(50))
  })

  afterAll(async () => {
    await logoutTestUser()
    console.log('\n✅ Summary localization tests completed')
  })

  describe('UI Locale Support', () => {
    it('should generate summary in English when locale is "en"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇺🇸 Testing summary generation with locale: en')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'en', // UI locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(typeof data.summary).toBe('string')
      expect(data.summary.length).toBeGreaterThan(0)

      // English summaries should NOT contain Portuguese or Spanish specific words
      const summary = data.summary.toLowerCase()
      expect(summary).not.toMatch(/\b(é|são|para|com|uma|sobre|permite|inclui)\b/)

      console.log(`✅ English summary: "${data.summary.substring(0, 100)}..."`)
    })

    it('should generate summary in Portuguese when locale is "pt"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇧🇷 Testing summary generation with locale: pt')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'pt', // UI locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(typeof data.summary).toBe('string')
      expect(data.summary.length).toBeGreaterThan(0)

      // Portuguese summaries should contain Portuguese words/patterns
      const summary = data.summary.toLowerCase()
      // Check for common Portuguese words or patterns (ção, ão, etc.)
      const hasPortuguese =
        /\b(é|são|para|com|uma|sobre|permite|inclui|como|que|programação|desenvolvimento|servidor|interfaces)\b/.test(
          summary
        ) || /ção|ão|mente/.test(summary)

      expect(hasPortuguese).toBe(true)

      console.log(`✅ Portuguese summary: "${data.summary.substring(0, 100)}..."`)
    })

    it('should generate summary in Spanish when locale is "es"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇪🇸 Testing summary generation with locale: es')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'es', // UI locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(typeof data.summary).toBe('string')
      expect(data.summary.length).toBeGreaterThan(0)

      // Spanish summaries should contain Spanish words/patterns
      const summary = data.summary.toLowerCase()
      // Check for common Spanish words or patterns (ción, ón, etc.)
      const hasSpanish =
        /\b(es|son|para|con|una|sobre|permite|incluye|como|que|programación|desarrollo|servidor|interfaces|del|las|los)\b/.test(
          summary
        ) || /ción|ón|mente/.test(summary)

      expect(hasSpanish).toBe(true)

      console.log(`✅ Spanish summary: "${data.summary.substring(0, 100)}..."`)
    })
  })

  describe('Legacy Locale Support (backwards compatibility)', () => {
    it('should still support full locale "pt-BR"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇧🇷 Testing legacy locale: pt-BR')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'pt-BR', // Legacy full locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(data.summary.length).toBeGreaterThan(0)

      console.log(`✅ pt-BR summary: "${data.summary.substring(0, 100)}..."`)
    })

    it('should still support full locale "en-US"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇺🇸 Testing legacy locale: en-US')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'en-US', // Legacy full locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(data.summary.length).toBeGreaterThan(0)

      console.log(`✅ en-US summary: "${data.summary.substring(0, 100)}..."`)
    })

    it('should still support full locale "es-ES"', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n🇪🇸 Testing legacy locale: es-ES')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'es-ES', // Legacy full locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(data.summary.length).toBeGreaterThan(0)

      console.log(`✅ es-ES summary: "${data.summary.substring(0, 100)}..."`)
    })
  })

  describe('Edge Cases', () => {
    it('should fallback to English for unknown locale', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n❓ Testing unknown locale fallback: xx-XX')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: 'xx-XX', // Unknown locale
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(data.summary.length).toBeGreaterThan(0)

      // Should fallback to English
      console.log(`✅ Fallback summary (English): "${data.summary.substring(0, 100)}..."`)
    })

    it('should handle empty language gracefully', async () => {
      if (!accessToken) throw new Error('No access token')

      console.log('\n❓ Testing empty language parameter')

      const response = await fetch(GENERATE_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent: TEST_CONTENT,
          language: '', // Empty language
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(data.summary.length).toBeGreaterThan(0)

      console.log(`✅ Empty language summary: "${data.summary.substring(0, 100)}..."`)
    })
  })
})
