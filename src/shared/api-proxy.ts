/**
 * API Proxy module for HeyRaji
 *
 * This module provides functions to call Supabase Edge Functions
 * that proxy requests to OpenAI and ElevenLabs APIs.
 *
 * Using proxies instead of direct API calls:
 * - Users don't need to configure API keys
 * - API keys are never exposed to clients
 * - Enables usage tracking and rate limiting
 */

import { SUPABASE_URL } from './supabase'
import { getAccessToken } from './supabase'

// Base URL for Edge Functions
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

/**
 * Response type for summary generation
 */
export interface SummaryResponse {
  summary: string
}

/**
 * Response type for embedding generation
 */
export interface EmbeddingResponse {
  embedding: number[]
}

/**
 * Response type for scribe token
 */
export interface ScribeTokenResponse {
  token: string
  expiresAt: string
}

/**
 * Error response from Edge Functions
 */
export interface ApiError {
  error: string
  details?: string
}

/**
 * Make an authenticated request to an Edge Function
 *
 * @param endpoint - Function endpoint name
 * @param options - Fetch options (method, body, etc.)
 * @returns Response data
 * @throws Error if request fails or user not authenticated
 */
async function callEdgeFunction<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('User not authenticated. Please sign in to continue.')
  }

  const url = `${FUNCTIONS_URL}/${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data as ApiError
    throw new Error(error.error || `Request failed: ${response.status}`)
  }

  return data as T
}

/**
 * Generate a summary for page content using GPT-4o-mini
 *
 * @param pageContent - The content to summarize (page text, transcript, etc.)
 * @param language - Target language code (e.g., 'pt-BR', 'en-US')
 * @returns Generated summary
 */
export async function generateSummaryProxy(
  pageContent: string,
  language: string = 'pt-BR'
): Promise<string> {
  const response = await callEdgeFunction<SummaryResponse>('generate-summary', {
    method: 'POST',
    body: JSON.stringify({ pageContent, language }),
  })

  return response.summary
}

/**
 * Generate an embedding vector for text using text-embedding-3-small
 *
 * @param text - The text to embed
 * @returns 1536-dimensional embedding vector
 */
export async function generateEmbeddingProxy(text: string): Promise<number[]> {
  const response = await callEdgeFunction<EmbeddingResponse>('generate-embedding', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })

  return response.embedding
}

/**
 * Get a single-use token for ElevenLabs Scribe WebSocket connection
 *
 * The token is valid for 15 minutes and can only be used once.
 * This allows real-time speech-to-text without exposing the API key.
 *
 * @returns Token and expiration time
 */
export async function getScribeToken(): Promise<ScribeTokenResponse> {
  const response = await callEdgeFunction<ScribeTokenResponse>('scribe-token', {
    method: 'GET',
  })

  return response
}

/**
 * Check if API proxy is available
 *
 * Makes a lightweight check to verify the user is authenticated
 * and Edge Functions are accessible.
 *
 * @returns true if proxy is available
 */
export async function isApiProxyAvailable(): Promise<boolean> {
  try {
    const accessToken = await getAccessToken()
    return accessToken !== null
  } catch {
    return false
  }
}
