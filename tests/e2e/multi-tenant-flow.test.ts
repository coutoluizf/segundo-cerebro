/**
 * E2E Test: Multi-Tenant Flow
 *
 * Tests the complete user journey with Supabase PostgreSQL.
 *
 * NOTE: The old Turso-based tests have been removed since the project
 * migrated to Supabase PostgreSQL. Edge Function tests are still valid.
 *
 * Uses the dedicated test user for authentication.
 * See tests/CLAUDE.md for test user credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loginTestUser, logoutTestUser, getTestSession, TEST_USER } from '../setup/auth'

// Supabase configuration
const SUPABASE_URL = 'https://mfczpquwzyrczsnjbgaa.supabase.co'

// Edge Function URLs
const EDGE_FUNCTIONS = {
  generateSummary: `${SUPABASE_URL}/functions/v1/generate-summary`,
  generateEmbedding: `${SUPABASE_URL}/functions/v1/generate-embedding`,
  scribeToken: `${SUPABASE_URL}/functions/v1/scribe-token`,
}

describe('E2E: Multi-Tenant Flow', () => {
  let accessToken: string | null = null

  beforeAll(async () => {
    console.log('\n🧪 E2E Test: Multi-Tenant Flow')
    console.log('='.repeat(50))

    // Login as test user
    const session = await loginTestUser()
    accessToken = session.access_token

    console.log(`✅ Authenticated as: ${TEST_USER.email}`)
    console.log('='.repeat(50))
  })

  afterAll(async () => {
    await logoutTestUser()
    console.log('\n✅ E2E tests completed')
  })

  describe('Edge Functions', () => {
    it('should generate summary via Edge Function', async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      console.log('\n📝 Testing generate-summary Edge Function...')

      const response = await fetch(EDGE_FUNCTIONS.generateSummary, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pageContent:
            'This is a test page about JavaScript programming. It covers topics like async/await, promises, and event loops.',
          language: 'en',
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.summary).toBeDefined()
      expect(typeof data.summary).toBe('string')
      expect(data.summary.length).toBeGreaterThan(0)

      console.log(`✅ Summary generated: "${data.summary.substring(0, 80)}..."`)
    })

    it('should generate embedding via Edge Function', async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      console.log('\n📝 Testing generate-embedding Edge Function...')

      const response = await fetch(EDGE_FUNCTIONS.generateEmbedding, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: 'This is a test document about machine learning and artificial intelligence.',
        }),
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.embedding).toBeDefined()
      expect(Array.isArray(data.embedding)).toBe(true)
      // text-embedding-3-small returns 1536-dimensional vectors
      expect(data.embedding.length).toBe(1536)

      console.log(`✅ Embedding generated: ${data.embedding.length} dimensions`)
    })

    it('should get scribe token via Edge Function', async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      console.log('\n📝 Testing scribe-token Edge Function...')

      const response = await fetch(EDGE_FUNCTIONS.scribeToken, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.token).toBeDefined()
      expect(typeof data.token).toBe('string')
      expect(data.token.length).toBeGreaterThan(0)

      console.log(`✅ Scribe token generated (length: ${data.token.length})`)
    })
  })

  describe('Database Operations', () => {
    it('should have access to user data via RLS', async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      // Import test-db to verify database access
      const { getItems, getProjects } = await import('../setup/test-db')

      console.log('\n📝 Testing database access via RLS...')

      // These should work without errors (even if empty)
      const items = await getItems()
      const projects = await getProjects()

      expect(Array.isArray(items)).toBe(true)
      expect(Array.isArray(projects)).toBe(true)

      console.log(`✅ Database access verified`)
      console.log(`   Items: ${items.length}, Projects: ${projects.length}`)
    })
  })
})
