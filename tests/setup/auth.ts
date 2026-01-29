/**
 * Test authentication utilities
 *
 * Provides functions to authenticate as the test user for integration tests.
 * The test user is a dedicated account in Supabase for automated testing.
 *
 * IMPORTANT: Do not use these credentials for anything other than automated tests.
 */

import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'

// Test user credentials
// These are for a dedicated test account - NOT a real user
export const TEST_USER = {
  email: 'test-integration@heyraji.com',
  password: 'TestPassword123!',
  id: '9375275d-345b-4fb5-846f-f6328aec846c',
} as const

// Supabase configuration (same as main app)
const SUPABASE_URL = 'https://mfczpquwzyrczsnjbgaa.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY3pwcXV3enlyY3pzbmpiZ2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTQ4NTcsImV4cCI6MjA4NTA5MDg1N30.CFB7GhZdMLwnjznSWwru4cquwXEBn60mKFRP3A3tEZg'

// In-memory storage for test environment (no chrome.storage.local)
const memoryStorage: Record<string, string> = {}

const testStorageAdapter = {
  getItem: (key: string): string | null => {
    return memoryStorage[key] || null
  },
  setItem: (key: string, value: string): void => {
    memoryStorage[key] = value
  },
  removeItem: (key: string): void => {
    delete memoryStorage[key]
  },
}

// Singleton client for tests
let testClient: SupabaseClient | null = null
let testSession: Session | null = null

/**
 * Get the Supabase client configured for testing
 * Uses in-memory storage instead of chrome.storage.local
 */
export function getTestSupabaseClient(): SupabaseClient {
  if (!testClient) {
    testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: testStorageAdapter,
        storageKey: 'test-supabase-auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return testClient
}

/**
 * Login as the test user
 * Call this in beforeAll() for integration tests
 *
 * @returns Session for the test user
 * @throws Error if login fails
 */
export async function loginTestUser(): Promise<Session> {
  const client = getTestSupabaseClient()

  console.log(`\n🔐 Logging in as test user: ${TEST_USER.email}`)

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  })

  if (error) {
    console.error('❌ Test user login failed:', error.message)
    throw new Error(`Test user login failed: ${error.message}`)
  }

  if (!data.session) {
    throw new Error('No session returned after login')
  }

  testSession = data.session
  console.log(`✅ Logged in as: ${data.user?.email}`)
  console.log(`   User ID: ${data.user?.id}`)

  return data.session
}

/**
 * Logout the test user
 * Call this in afterAll() to clean up
 */
export async function logoutTestUser(): Promise<void> {
  const client = getTestSupabaseClient()

  console.log('\n🔓 Logging out test user')

  await client.auth.signOut()
  testSession = null

  // Clear memory storage
  Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key])

  console.log('✅ Logged out')
}

/**
 * Get the current test session
 * @returns Session if logged in, null otherwise
 */
export function getTestSession(): Session | null {
  return testSession
}

/**
 * Get the test user ID
 * Useful for queries that need the user ID
 */
export function getTestUserId(): string {
  if (!testSession) {
    throw new Error('Not logged in - call loginTestUser() first')
  }
  return testSession.user.id
}

/**
 * Check if test user is logged in
 */
export function isTestUserLoggedIn(): boolean {
  return testSession !== null
}

/**
 * Reset test client (useful between test suites)
 */
export function resetTestClient(): void {
  testClient = null
  testSession = null
  Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key])
}
