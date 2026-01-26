/**
 * Content script for extracting page text
 * Runs in the context of the web page to extract visible text content
 */

// Maximum characters to extract (to avoid sending huge pages)
const MAX_CONTENT_LENGTH = 15000

/**
 * Extract readable text content from the page
 * Filters out scripts, styles, and navigation elements
 */
function extractPageContent(): string {
  // Try to find main content area first
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    '.post-content',
    '.article-content',
    '.entry-content',
  ]

  let contentElement: Element | null = null

  // Find the best content container
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector)
    if (contentElement) break
  }

  // Fallback to body if no main content found
  if (!contentElement) {
    contentElement = document.body
  }

  // Clone the element to avoid modifying the actual page
  const clone = contentElement.cloneNode(true) as Element

  // Remove unwanted elements
  const unwantedSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.comments',
    '.advertisement',
    '.ad',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
  ]

  for (const selector of unwantedSelectors) {
    const elements = clone.querySelectorAll(selector)
    elements.forEach((el) => el.remove())
  }

  // Get text content and clean it up
  let text = clone.textContent || ''

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Multiple whitespace to single space
    .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
    .trim()

  // Truncate if too long
  if (text.length > MAX_CONTENT_LENGTH) {
    text = text.substring(0, MAX_CONTENT_LENGTH) + '...'
  }

  return text
}

/**
 * Get page metadata
 */
function getPageMetadata(): { title: string; url: string; description?: string } {
  const title = document.title
  const url = window.location.href
  const descriptionMeta = document.querySelector('meta[name="description"]')
  const description = descriptionMeta?.getAttribute('content') || undefined

  return { title, url, description }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_CONTENT') {
    try {
      const content = extractPageContent()
      const metadata = getPageMetadata()
      sendResponse({
        success: true,
        content,
        metadata,
      })
    } catch (error) {
      console.error('[ContentScript] Error extracting content:', error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  // Return true to indicate async response
  return true
})

// Export for testing
export { extractPageContent, getPageMetadata }
