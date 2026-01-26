/**
 * Offscreen document script for playing reminder sounds
 * This runs in an offscreen document that can play audio even when
 * the extension popup is closed
 */

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PLAY_REMINDER_SOUND') {
    playReminderSound()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // Keep the message channel open for async response
  }
})

/**
 * Play the reminder notification sound
 * Uses a simple generated tone for consistency and subtlety
 */
async function playReminderSound(): Promise<void> {
  // Use the simple generated tone - it's subtle and consistent
  return playGeneratedTone()
}

/**
 * Generate and play a pleasant double chime notification
 * Two descending notes for a familiar, elegant sound
 */
async function playGeneratedTone(): Promise<void> {
  const audioContext = new AudioContext()
  const now = audioContext.currentTime
  const volume = 0.5 // 50% volume

  // First chime - higher note (C6)
  const osc1 = audioContext.createOscillator()
  const gain1 = audioContext.createGain()
  osc1.connect(gain1)
  gain1.connect(audioContext.destination)
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(1047, now) // C6
  gain1.gain.setValueAtTime(0, now)
  gain1.gain.linearRampToValueAtTime(volume * 0.25, now + 0.01)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  osc1.start(now)
  osc1.stop(now + 0.5)

  // Second chime - lower note (G5), slightly delayed
  const osc2 = audioContext.createOscillator()
  const gain2 = audioContext.createGain()
  osc2.connect(gain2)
  gain2.connect(audioContext.destination)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(784, now + 0.15) // G5
  gain2.gain.setValueAtTime(0, now + 0.15)
  gain2.gain.linearRampToValueAtTime(volume * 0.2, now + 0.16)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  osc2.start(now + 0.15)
  osc2.stop(now + 0.8)

  // Wait for the sound to finish
  return new Promise((resolve) => {
    setTimeout(() => {
      audioContext.close()
      console.log('[Offscreen] Double chime finished playing')
      resolve()
    }, 900)
  })
}

console.log('[Offscreen] Offscreen document loaded and ready')
