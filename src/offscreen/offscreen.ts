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
 * Falls back to a generated tone if the sound file is not available
 */
async function playReminderSound(): Promise<void> {
  try {
    // Try to play the custom sound file first
    const audio = new Audio(chrome.runtime.getURL('sounds/reminder.mp3'))
    audio.volume = 0.8

    await audio.play()

    // Wait for the audio to finish before resolving
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        console.log('[Offscreen] Reminder sound finished playing')
        resolve()
      }
      audio.onerror = (e) => {
        console.error('[Offscreen] Error playing reminder sound:', e)
        reject(new Error('Failed to play sound'))
      }
    })
  } catch (error) {
    console.warn('[Offscreen] Could not play sound file, using generated tone:', error)
    // Fallback: generate a simple notification tone using Web Audio API
    return playGeneratedTone()
  }
}

/**
 * Generate and play a simple notification tone using Web Audio API
 * Used as fallback when the sound file is not available
 */
async function playGeneratedTone(): Promise<void> {
  const audioContext = new AudioContext()

  // Create a pleasant two-tone notification sound
  const playTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)

    // Envelope for smooth attack and decay
    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05) // Attack
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + duration - 0.1) // Sustain
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration) // Decay

    oscillator.start(startTime)
    oscillator.stop(startTime + duration)
  }

  const now = audioContext.currentTime

  // Play a pleasant two-note chime (C5 and E5)
  playTone(523.25, now, 0.2) // C5
  playTone(659.25, now + 0.15, 0.25) // E5

  // Wait for the sound to finish
  return new Promise((resolve) => {
    setTimeout(() => {
      audioContext.close()
      console.log('[Offscreen] Generated tone finished playing')
      resolve()
    }, 500)
  })
}

console.log('[Offscreen] Offscreen document loaded and ready')
