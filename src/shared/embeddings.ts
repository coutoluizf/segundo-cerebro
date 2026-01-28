/**
 * OpenAI Embeddings Client
 * Generates embeddings using text-embedding-3-small model
 *
 * Supports two modes:
 * 1. Proxy mode (preferred): Uses Edge Function when user is authenticated
 * 2. Direct mode (fallback): Uses OpenAI API directly with provided key
 */

import { generateEmbeddingProxy, isApiProxyAvailable } from './api-proxy'

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'

/**
 * Build text for embedding from item fields
 * Combines title, URL, transcription and AI summary for better semantic search
 * Title and URL help find items by site name, domain, or page title
 */
export function buildTextForEmbedding(params: {
  title?: string | null
  url?: string | null
  transcription?: string | null
  aiSummary?: string | null
}): string {
  const parts: string[] = []

  // Add title first (important for semantic matching)
  if (params.title?.trim()) {
    parts.push(params.title.trim())
  }

  // Add URL (domain and path contain useful keywords like company names)
  if (params.url?.trim() && !params.url.startsWith('note://')) {
    // Clean URL: remove protocol and www for cleaner embedding
    const cleanUrl = params.url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
    parts.push(cleanUrl)
  }

  // Add user transcription/comment
  if (params.transcription?.trim()) {
    parts.push(params.transcription.trim())
  }

  // Add AI summary
  if (params.aiSummary?.trim()) {
    parts.push(params.aiSummary.trim())
  }

  return parts.join('\n\n')
}
const MODEL = 'text-embedding-3-small'

// Response type from OpenAI API
interface EmbeddingResponse {
  object: string
  data: Array<{
    object: string
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

// Error response from OpenAI API
interface ErrorResponse {
  error: {
    message: string
    type: string
    code: string
  }
}

/**
 * Generate embedding for a single text
 *
 * Tries proxy first (no API key needed), falls back to direct API.
 * @param text - Text to embed
 * @param apiKey - Optional API key for direct mode (required if proxy unavailable)
 */
export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<number[]> {
  // Try proxy mode first (for authenticated users)
  try {
    const proxyAvailable = await isApiProxyAvailable()
    if (proxyAvailable) {
      console.log('[Embeddings] Using proxy mode')
      return await generateEmbeddingProxy(text)
    }
  } catch (error) {
    console.log('[Embeddings] Proxy unavailable, trying direct mode:', error)
  }

  // Fall back to direct API mode
  if (!apiKey) {
    throw new Error('OpenAI API key required when not authenticated')
  }

  const embeddings = await generateEmbeddings([text], apiKey)
  return embeddings[0]
}

// Generate embeddings for multiple texts (batch)
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  // Clean and truncate texts
  const cleanedTexts = texts.map(text => {
    // Remove excessive whitespace
    const cleaned = text.trim().replace(/\s+/g, ' ')
    // Truncate to ~8000 tokens (roughly 32000 characters for safety)
    return cleaned.slice(0, 32000)
  })

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: cleanedTexts,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json() as ErrorResponse
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`)
  }

  const data = await response.json() as EmbeddingResponse

  // Sort by index to maintain order
  const sorted = data.data.sort((a, b) => a.index - b.index)

  return sorted.map(item => item.embedding)
}

// Validate OpenAI API key by making a test request
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    // Make a minimal request to validate the key
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: 'test',
      }),
    })

    return response.ok
  } catch {
    return false
  }
}
