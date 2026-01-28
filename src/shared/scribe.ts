/**
 * ElevenLabs Scribe v2 Realtime STT Client
 * Handles real-time speech-to-text transcription via WebSocket
 * Reference: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
 *
 * Supports two authentication modes:
 * 1. Proxy mode (preferred): Gets token from Edge Function when user is authenticated
 * 2. Direct mode (fallback): Uses ElevenLabs API directly with provided key
 */

import type { ScribeState } from './types'
import { getScribeToken, isApiProxyAvailable } from './api-proxy'

// Configuration for the Scribe client
export interface ScribeConfig {
  apiKey?: string // Optional - only needed if proxy unavailable
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
  onStateChange: (state: ScribeState) => void
  language?: string // Default: 'pt' (Portuguese)
}

// Audio recording configuration
const SAMPLE_RATE = 16000
const CHANNELS = 1

export class ScribeClient {
  private config: ScribeConfig
  private ws: WebSocket | null = null
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private fullTranscript: string = ''
  private state: ScribeState = 'idle'

  constructor(config: ScribeConfig) {
    this.config = config
  }

  // Get current state
  getState(): ScribeState {
    return this.state
  }

  // Get current full transcript
  getTranscript(): string {
    return this.fullTranscript
  }

  // Update state and notify
  private setState(newState: ScribeState): void {
    this.state = newState
    this.config.onStateChange(newState)
  }

  // Get a single-use token for WebSocket authentication
  // Tries proxy first, falls back to direct API
  private async getSingleUseToken(): Promise<string> {
    // Try proxy mode first (for authenticated users)
    try {
      const proxyAvailable = await isApiProxyAvailable()
      if (proxyAvailable) {
        console.log('[Scribe] Getting token via proxy...')
        const response = await getScribeToken()
        console.log('[Scribe] Got token via proxy, expires:', response.expiresAt)
        return response.token
      }
    } catch (error) {
      console.log('[Scribe] Proxy unavailable or failed, trying direct mode:', error)
    }

    // Fall back to direct API mode
    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key required when not authenticated')
    }

    console.log('[Scribe] Getting token via direct API...')
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Scribe] Token error:', response.status, errorText)
      throw new Error(`Erro ao obter token: ${response.status}`)
    }

    const data = await response.json()
    console.log('[Scribe] Got single-use token via direct API')
    return data.token
  }

  // Connect to ElevenLabs and start recording
  async connect(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error('Already connected or connecting')
    }

    this.setState('connecting')
    this.fullTranscript = ''

    try {
      // First, get a single-use token for client-side authentication
      const token = await this.getSingleUseToken()

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Set up audio context
      this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create processor for capturing audio data
      // Using ScriptProcessorNode (deprecated but widely supported)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // Build WebSocket URL with query parameters
      // Use token instead of API key for client-side auth
      const params = new URLSearchParams({
        // IMPORTANT: must be scribe_v2_realtime, not scribe_v2
        model_id: 'scribe_v2_realtime',
        language_code: this.config.language || 'pt',
        // Use token for authentication
        token: token,
      })

      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`
      console.log('[Scribe] Connecting to WebSocket...')

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[Scribe] WebSocket connected and authenticated')

        this.setState('listening')

        // Start processing audio
        this.processor!.onaudioprocess = (event) => {
          if (this.ws?.readyState === WebSocket.OPEN && this.state === 'listening') {
            const inputData = event.inputBuffer.getChannelData(0)
            // Convert to 16-bit PCM and then to base64
            const audioData = this.floatTo16BitPCM(inputData)
            const base64Audio = this.arrayBufferToBase64(audioData)

            // Send audio chunk in ElevenLabs format
            this.ws.send(JSON.stringify({
              message_type: 'input_audio_chunk',
              audio_base_64: base64Audio,
            }))
          }
        }

        this.source!.connect(this.processor!)
        this.processor!.connect(this.audioContext!.destination)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('[Scribe] Error parsing message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[Scribe] WebSocket error:', error)
        this.config.onError('Erro de conexão')
        this.cleanup()
        this.setState('error')
      }

      this.ws.onclose = (event) => {
        console.log('[Scribe] WebSocket closed', event.code, event.reason)
        this.cleanup()
        if (this.state === 'listening') {
          this.setState('idle')
        }
      }
    } catch (error) {
      console.error('[Scribe] Error:', error)
      this.config.onError(error instanceof Error ? error.message : 'Erro desconhecido')
      this.cleanup()
      this.setState('error')
      throw error
    }
  }

  // Handle incoming WebSocket messages
  private handleMessage(data: {
    message_type: string
    text?: string
    error?: string
    session_id?: string
    [key: string]: unknown
  }): void {
    console.log('[Scribe] Received:', data.message_type, data)

    switch (data.message_type) {
      case 'session_started':
        console.log('[Scribe] Session started:', data.session_id)
        break

      case 'partial_transcript':
        // Partial result - show current state with partial text
        if (data.text) {
          const display = this.fullTranscript + (this.fullTranscript ? ' ' : '') + data.text
          this.config.onTranscript(display, false)
        }
        break

      case 'committed_transcript':
      case 'committed_transcript_with_timestamps':
        // Final transcript - append to full transcript
        if (data.text) {
          this.fullTranscript += (this.fullTranscript ? ' ' : '') + data.text
          this.config.onTranscript(this.fullTranscript, true)
        }
        break

      case 'auth_error':
      case 'quota_exceeded':
      case 'rate_limited':
      case 'error':
        console.error('[Scribe] Server error:', data.error || data.message_type)
        this.config.onError(data.error || `Erro: ${data.message_type}`)
        break

      default:
        // Log unknown message types for debugging
        console.log('[Scribe] Unknown message type:', data.message_type, data)
    }
  }

  // Convert float audio data to 16-bit PCM
  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }

    return buffer
  }

  // Convert ArrayBuffer to base64 string
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // Stop recording and disconnect
  async disconnect(): Promise<string> {
    this.setState('processing')

    // Send commit to finalize any pending transcript
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: '',
        commit: true,
      }))
    }

    // Wait a moment for final transcripts
    await new Promise(resolve => setTimeout(resolve, 1000))

    this.cleanup()
    this.setState('idle')

    return this.fullTranscript
  }

  // Clean up resources
  private cleanup(): void {
    // Stop audio processing
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
