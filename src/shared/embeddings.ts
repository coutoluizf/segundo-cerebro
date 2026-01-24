/**
 * OpenAI Embeddings Client
 * Generates embeddings using text-embedding-3-small model
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'
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

// Generate embedding for a single text
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
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
