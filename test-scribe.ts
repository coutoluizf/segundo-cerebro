/**
 * Test script for ElevenLabs Scribe v2 Realtime API
 * Run with: npx tsx test-scribe.ts
 */

import WebSocket from 'ws'

// Read API key from environment
const API_KEY = process.env.ELEVENLABS_API_KEY

if (!API_KEY) {
  console.error('Please set ELEVENLABS_API_KEY environment variable')
  console.error('Usage: ELEVENLABS_API_KEY=your_key npx tsx test-scribe.ts')
  process.exit(1)
}

const SAMPLE_RATE = 16000

async function getSingleUseToken(): Promise<string> {
  console.log('[Test] Getting single-use token...')

  const response = await fetch(
    'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY!,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log('[Test] Got token:', data.token.substring(0, 20) + '...')
  return data.token
}

async function testWebSocket() {
  const token = await getSingleUseToken()

  // Test with the params we were using in scribe.ts
  const params = new URLSearchParams({
    model_id: 'scribe_v2',  // Maybe this should be scribe_v2_realtime?
    language_code: 'pt',
    sample_rate: SAMPLE_RATE.toString(),
    enable_vad: 'true',
    token: token,
  })

  const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`
  console.log('[Test] Connecting with params: model_id=scribe_v2, language_code=pt, sample_rate=16000, enable_vad=true')

  const ws = new WebSocket(wsUrl)

  ws.on('open', () => {
    console.log('[Test] WebSocket connected!')

    // Generate audio chunk
    const samples = 3200
    const buffer = Buffer.alloc(samples * 2)
    for (let i = 0; i < samples; i++) {
      const t = i / SAMPLE_RATE
      const value = Math.sin(2 * Math.PI * 440 * t) * 0.3 * 32767
      buffer.writeInt16LE(Math.round(value), i * 2)
    }

    const base64Audio = buffer.toString('base64')

    // Send audio with the format we were using
    const message = {
      message_type: 'input_audio_chunk',
      audio_base_64: base64Audio,
      sample_rate: SAMPLE_RATE,  // Also included sample_rate in message
    }

    console.log('[Test] Sending input_audio_chunk with sample_rate in message...')
    ws.send(JSON.stringify(message))

    // Send a few more chunks
    let count = 0
    const interval = setInterval(() => {
      count++
      if (count > 5 || ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval)
        console.log('[Test] Sending commit...')
        ws.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          commit: true,
        }))
        return
      }
      ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: base64Audio,
        sample_rate: SAMPLE_RATE,
      }))
      console.log('[Test] Sent chunk', count)
    }, 200)
  })

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString())
    console.log('[Test] Received:', message.message_type, message.text || message.error || '')
    if (message.message_type === 'session_started') {
      console.log('[Test] Session model_id:', message.config?.model_id)
    }
  })

  ws.on('error', (error) => {
    console.error('[Test] WebSocket error:', error)
  })

  ws.on('close', (code, reason) => {
    console.log('[Test] WebSocket closed:', code, reason.toString())
    process.exit(0)
  })

  setTimeout(() => {
    console.log('[Test] Timeout, closing...')
    ws.close()
  }, 10000)
}

testWebSocket().catch(console.error)
