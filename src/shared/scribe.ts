/**
 * ElevenLabs Scribe v2 Realtime STT Client
 * Handles real-time speech-to-text transcription via WebSocket
 * Reference: https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime/client-side-streaming
 */

import type { ScribeState } from './types'

// Configuration for the Scribe client
export interface ScribeConfig {
  apiKey: string
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

  // Connect to ElevenLabs and start recording
  async connect(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error('Already connected or connecting')
    }

    this.setState('connecting')
    this.fullTranscript = ''

    try {
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
      // For production, consider using AudioWorklet
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // Connect to ElevenLabs WebSocket
      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?language_code=${this.config.language || 'pt'}`

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        // Send authentication and configuration
        this.ws?.send(JSON.stringify({
          type: 'config',
          api_key: this.config.apiKey,
          model_id: 'scribe_v2',
          transcription_config: {
            language: this.config.language || 'pt',
          },
        }))

        this.setState('listening')

        // Start processing audio
        this.processor!.onaudioprocess = (event) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const inputData = event.inputBuffer.getChannelData(0)
            const audioData = this.floatTo16BitPCM(inputData)
            this.ws.send(audioData)
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
        this.config.onError('Connection error')
        this.cleanup()
        this.setState('error')
      }

      this.ws.onclose = () => {
        console.log('[Scribe] WebSocket closed')
        this.cleanup()
        if (this.state === 'listening') {
          this.setState('idle')
        }
      }
    } catch (error) {
      console.error('[Scribe] Error:', error)
      this.config.onError(error instanceof Error ? error.message : 'Unknown error')
      this.cleanup()
      this.setState('error')
      throw error
    }
  }

  // Handle incoming WebSocket messages
  private handleMessage(data: {
    type: string
    text?: string
    is_final?: boolean
    error?: string
  }): void {
    switch (data.type) {
      case 'transcript':
        if (data.text) {
          if (data.is_final) {
            // Final transcript - append to full transcript
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + data.text
            this.config.onTranscript(this.fullTranscript, true)
          } else {
            // Partial transcript - show current state with partial text
            const display = this.fullTranscript + (this.fullTranscript ? ' ' : '') + data.text
            this.config.onTranscript(display, false)
          }
        }
        break

      case 'error':
        console.error('[Scribe] Server error:', data.error)
        this.config.onError(data.error || 'Server error')
        break

      case 'ready':
        console.log('[Scribe] Server ready')
        break

      default:
        console.log('[Scribe] Unknown message type:', data.type)
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

  // Stop recording and disconnect
  async disconnect(): Promise<string> {
    this.setState('processing')

    // Wait a moment for final transcripts
    await new Promise(resolve => setTimeout(resolve, 500))

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
