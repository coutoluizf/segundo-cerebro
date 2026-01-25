import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { ScribeClient, type ScribeConfig } from '@/shared/scribe'
import type { ScribeState } from '@/shared/types'
import { sendMessage } from '@/shared/messaging'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceCaptureProps {
  transcription: string
  onTranscriptionChange: (text: string) => void
  placeholder?: string
}

/**
 * VoiceCapture - Recording interface with real-time transcription
 * Features a luminous mic button with pulse animation while recording
 */
export function VoiceCapture({ transcription, onTranscriptionChange, placeholder }: VoiceCaptureProps) {
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
      {/* Mic button with glow effect */}
      <div className="flex justify-center">
        <button
          onClick={toggleRecording}
          disabled={isConnecting || isProcessing}
          className={cn(
            'relative h-16 w-16 rounded-full transition-all duration-300',
            'flex items-center justify-center',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105'
          )}
        >
          {/* Glow effect */}
          <div
            className={cn(
              'absolute inset-0 rounded-full blur-xl transition-opacity duration-300',
              isRecording ? 'bg-red-500/50 opacity-100' : 'bg-primary/30 opacity-0 group-hover:opacity-100'
            )}
          />

          {/* Pulse ring while recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-red-500 recording-pulse" />
              <div className="absolute inset-[-8px] rounded-full border border-red-500/30 recording-pulse" style={{ animationDelay: '0.5s' }} />
            </>
          )}

          {/* Icon */}
          <div className="relative">
            {isConnecting || isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </div>
        </button>
      </div>

      {/* Status text */}
      <div className="text-center text-xs">
        {isConnecting && <span className="text-muted-foreground">Conectando...</span>}
        {isProcessing && <span className="text-muted-foreground">Processando...</span>}
        {isRecording && (
          <span className="text-red-500 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
            Gravando... Toque para parar
          </span>
        )}
        {state === 'idle' && !transcription && (
          <span className="text-muted-foreground">Toque para gravar ou digite abaixo</span>
        )}
        {state === 'idle' && transcription && (
          <span className="text-muted-foreground">Pronto para salvar</span>
        )}
        {state === 'error' && error && (
          <span className="text-destructive text-xs">{error}</span>
        )}
      </div>

      {/* Transcription/text input */}
      <Textarea
        value={transcription}
        onChange={(e) => onTranscriptionChange(e.target.value)}
        placeholder={placeholder || "Grave ou digite sua anotação..."}
        className={cn(
          'min-h-20 resize-none rounded-xl',
          'bg-secondary/50 border-0',
          'focus-visible:ring-1 focus-visible:ring-primary/30',
          'placeholder:text-muted-foreground/50',
          isRecording && 'ring-1 ring-red-500/30 bg-red-500/5'
        )}
        readOnly={isRecording}
      />
    </div>
  )
}
