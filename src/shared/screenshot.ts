/**
 * Screenshot utility for capturing tab thumbnails
 * Uses chrome.tabs.captureVisibleTab to capture screenshots
 * Compresses to JPEG for smaller storage size (~30KB target)
 */

// Target dimensions for thumbnail
const THUMBNAIL_WIDTH = 400
const THUMBNAIL_QUALITY = 0.7 // JPEG quality (0-1)

/**
 * Captures a thumbnail of the currently visible tab
 * Returns base64 data URL or null if capture fails
 *
 * @param windowId - Optional window ID to capture from
 * @returns Promise<string | null> - Data URL of the captured thumbnail
 */
export async function captureTabThumbnail(windowId?: number): Promise<string | null> {
  try {
    // Get the current window if not specified
    const targetWindowId = windowId ?? chrome.windows.WINDOW_ID_CURRENT

    // Check if we can capture the current tab
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: targetWindowId })

    // Skip capture for special URLs (chrome://, about:, etc.)
    if (!activeTab?.url || isSpecialUrl(activeTab.url)) {
      console.log('[Screenshot] Skipping capture for special URL:', activeTab?.url)
      return null
    }

    // Capture the visible tab as PNG (Chrome's default format)
    const dataUrl = await chrome.tabs.captureVisibleTab(targetWindowId, {
      format: 'png',
    })

    if (!dataUrl) {
      console.log('[Screenshot] captureVisibleTab returned empty')
      return null
    }

    // Resize and compress to JPEG
    const thumbnail = await resizeAndCompressImage(dataUrl)

    return thumbnail
  } catch (error) {
    // Gracefully handle errors (e.g., permission denied, special pages)
    console.error('[Screenshot] Error capturing thumbnail:', error)
    return null
  }
}

/**
 * Check if URL is a special browser page that can't be captured
 */
function isSpecialUrl(url: string): boolean {
  const specialPrefixes = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'brave://',
    'opera://',
    'vivaldi://',
    'moz-extension://',
    'file://',
    'view-source:',
    'devtools://',
  ]

  return specialPrefixes.some(prefix => url.startsWith(prefix))
}

/**
 * Resizes and compresses an image to target dimensions and JPEG format
 * Uses OffscreenCanvas for background service worker compatibility
 *
 * @param dataUrl - Source image as data URL
 * @returns Promise<string> - Compressed JPEG data URL
 */
async function resizeAndCompressImage(dataUrl: string): Promise<string> {
  // Create a blob from the data URL
  const response = await fetch(dataUrl)
  const blob = await response.blob()

  // Create ImageBitmap from blob
  const imageBitmap = await createImageBitmap(blob)

  // Calculate new dimensions maintaining aspect ratio
  const aspectRatio = imageBitmap.height / imageBitmap.width
  const newWidth = THUMBNAIL_WIDTH
  const newHeight = Math.round(newWidth * aspectRatio)

  // Use OffscreenCanvas (works in service workers)
  const canvas = new OffscreenCanvas(newWidth, newHeight)
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get 2D context from OffscreenCanvas')
  }

  // Draw resized image
  ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight)

  // Close the ImageBitmap to free memory
  imageBitmap.close()

  // Convert to JPEG blob with quality setting
  const jpegBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: THUMBNAIL_QUALITY,
  })

  // Convert blob to data URL
  const reader = new FileReader()
  const thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(jpegBlob)
  })

  // Log size for debugging
  const sizeKB = Math.round(thumbnailDataUrl.length * 0.75 / 1024) // Approx base64 to bytes
  console.log(`[Screenshot] Thumbnail created: ${newWidth}x${newHeight}, ~${sizeKB}KB`)

  return thumbnailDataUrl
}
