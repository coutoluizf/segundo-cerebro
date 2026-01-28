/**
 * E2E Test Setup
 *
 * Configuration and utilities for end-to-end integration tests
 * that use real Supabase and Turso APIs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createClient as createTursoClient, Client as TursoClient } from '@libsql/client'

// Supabase configuration (same as extension)
export const SUPABASE_URL = 'https://mfczpquwzyrczsnjbgaa.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY3pwcXV3enlyY3pzbmpiZ2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTQ4NTcsImV4cCI6MjA4NTA5MDg1N30.CFB7GhZdMLwnjznSWwru4cquwXEBn60mKFRP3A3tEZg'
export const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY3pwcXV3enlyY3pzbmpiZ2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxNDg1NywiZXhwIjoyMDg1MDkwODU3fQ.V9KZkK0sRcFhPcogYwnP61Hi6apiPzAVDvkPKTu_xi4'

// Edge Function URLs
export const EDGE_FUNCTIONS = {
  generateSummary: `${SUPABASE_URL}/functions/v1/generate-summary`,
  generateEmbedding: `${SUPABASE_URL}/functions/v1/generate-embedding`,
  scribeToken: `${SUPABASE_URL}/functions/v1/scribe-token`,
  provisionTursoDB: `${SUPABASE_URL}/functions/v1/provision-turso-db`,
}

// Test user configuration
export const TEST_USER_EMAIL = `test-${Date.now()}@heyraji-e2e.test`
export const TEST_USER_PASSWORD = 'TestPassword123!'

// Create Supabase client with anon key (for user operations)
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Create Supabase client with service role (for admin operations)
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Create Turso client with user credentials
export function createUserTursoClient(url: string, token: string): TursoClient {
  return createTursoClient({
    url,
    authToken: token,
  })
}

// Wait for a condition with timeout
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return
    }
    await sleep(intervalMs)
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`)
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Generate a unique ID (same as extension)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Test result logging
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`)
}

export function logError(message: string): void {
  console.error(`❌ ${message}`)
}

export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`)
}

export function logStep(step: number, message: string): void {
  console.log(`\n📍 Step ${step}: ${message}`)
}
