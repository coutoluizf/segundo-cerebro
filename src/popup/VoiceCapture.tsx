import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScribeClient, type ScribeConfig } from '@/shared/scribe'
import type { ScribeState } from '@/shared/types'
import { sendMessage } from '@/shared/messaging'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface VoiceCaptureProps {
  transcription: string
  onTranscriptionChange: (text: string) => void
}

export function VoiceCapture({ transcription, onTranscriptionChange }: VoiceCaptureProps) {
  const [state, setState] = useState<ScribeState>('idle')
  const [error, setError] = useState<string | null>(null)
  const scribeRef = useRef<ScribeClient | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scribeRef.current) {
        scribeRef.current.disconnect()
      }
    }
  }, [])

  // Start recording
  const startRecording = async () => {
    setError(null)

    try {
      // Get API key from storage
      const apiKeys = await sendMessage({ type: 'GET_API_KEYS' })

      if (!apiKeys.elevenlabs) {
        setError('ElevenLabs API key não configurada')
        return
      }

      // Create Scribe client
      const config: ScribeConfig = {
        apiKey: apiKeys.elevenlabs,
        language: 'pt',
        onTranscript: (text, _isFinal) => {
          onTranscriptionChange(text)
        },
        onError: (err) => {
          console.error('[VoiceCapture] Scribe error:', err)
          setError(err)
          setState('error')
        },
        onStateChange: (newState) => {
          setState(newState)
        },
      }

      scribeRef.current = new ScribeClient(config)
      await scribeRef.current.connect()
    } catch (err) {
      console.error('[VoiceCapture] Error starting recording:', err)
      setError(err instanceof Error ? err.message : 'Erro ao iniciar gravação')
      setState('error')
    }
  }

  // Stop recording
  const stopRecording = async () => {
    if (scribeRef.current) {
      const finalTranscript = await scribeRef.current.disconnect()
      onTranscriptionChange(finalTranscript)
      scribeRef.current = null
    }
  }

  // Toggle recording
  const toggleRecording = () => {
    if (state === 'listening') {
      stopRecording()
    } else if (state === 'idle' || state === 'error') {
      startRecording()
    }
  }

  // Get button state
  const isRecording = state === 'listening'
  const isConnecting = state === 'connecting'
  const isProcessing = state === 'processing'

  return (
    <div className="space-y-3">
      {/* Mic button */}
      <div className="flex justify-center">
        <Button
          variant={isRecording ? 'destructive' : 'default'}
          size="lg"
          className="h-16 w-16 rounded-full"
          onClick={toggleRecording}
          disabled={isConnecting || isProcessing}
        >
          {isConnecting || isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Status text */}
      <div className="text-center text-sm text-muted-foreground">
        {isConnecting && 'Conectando...'}
        {isProcessing && 'Processando...'}
        {isRecording && (
          <span className="text-red-500 animate-pulse">
            Gravando... Clique para parar
          </span>
        )}
        {state === 'idle' && !transcription && 'Grave ou digite abaixo'}
        {state === 'idle' && transcription && 'Gravação finalizada'}
        {state === 'error' && error && (
          <span className="text-destructive">{error}</span>
        )}
      </div>

      {/* Transcription/text input - same field for both */}
      <Textarea
        value={transcription}
        onChange={(e) => onTranscriptionChange(e.target.value)}
        placeholder="Grave ou digite sua anotação..."
        className="min-h-24 resize-none"
        readOnly={isRecording}
      />
    </div>
  )
}
