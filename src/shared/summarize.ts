/**
 * AI-powered page summarization using OpenAI gpt-4o-mini
 * Generates concise summaries of page content in the user's preferred language
 */

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

// Model to use for summarization
const MODEL = 'gpt-4o-mini'

// Maximum tokens for the response (keeps summaries concise)
const MAX_TOKENS = 200

/**
 * Generate a summary of page content using AI
 * @param content - The text content of the page
 * @param language - Language code for the summary (e.g., 'pt-BR', 'en-US')
 * @param apiKey - OpenAI API key
 * @returns The generated summary or null if failed
 */
export async function generateSummary(
  content: string,
  language: string,
  apiKey: string
): Promise<string | null> {
  // Don't summarize if content is too short
  if (!content || content.length < 100) {
    console.log('[Summarize] Content too short, skipping summarization')
    return null
  }

  // Truncate content if too long (to fit in context window)
  const maxContentLength = 12000
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '...'
    : content

  // Get language name for the prompt
  const languageName = getLanguageName(language)

  // Build the prompt
  const systemPrompt = `You are a helpful assistant that summarizes web page content.
Provide a concise summary in 2-3 sentences that captures the main topic and key points.
Always respond in ${languageName}.
Do not include phrases like "This page is about" or "This article discusses".
Just state the facts directly.`

  const userPrompt = `Summarize the following web page content:\n\n${truncatedContent}`

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.3, // Low temperature for more consistent summaries
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Summarize] API error:', response.status, errorData)
      return null
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      console.error('[Summarize] No summary in response')
      return null
    }

    console.log('[Summarize] Generated summary:', summary.substring(0, 100) + '...')
    return summary
  } catch (error) {
    console.error('[Summarize] Error generating summary:', error)
    return null
  }
}

/**
 * Get the full language name from a language code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'pt-BR': 'Brazilian Portuguese',
    'en-US': 'English',
    'es-ES': 'Spanish',
    'fr-FR': 'French',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'zh-CN': 'Simplified Chinese',
  }
  return languages[code] || 'English'
}
