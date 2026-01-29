import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
 * VoiceCapture - Integrated voice + text input component
 * Features a textarea with embedded mic button for seamless voice/text entry
 */
export function VoiceCapture({ transcription, onTranscriptionChange, placeholder }: VoiceCaptureProps) {
  const { t } = useTranslation()
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
        setError(t('voice.apiKeyMissing'))
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
      setError(err instanceof Error ? err.message : t('voice.errorStarting'))
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
    <div className="space-y-2">
      {/* Integrated textarea with mic button */}
      <div className="relative">
        {/* Textarea */}
        <Textarea
          value={transcription}
          onChange={(e) => onTranscriptionChange(e.target.value)}
          placeholder={placeholder || t('popup.placeholder.note')}
          className={cn(
            'min-h-24 resize-none rounded-xl pr-12',
            'bg-secondary/50 border transition-all duration-200',
            // Recording state - pulsing red border
            isRecording
              ? 'border-red-500/50 bg-red-500/5 ring-2 ring-red-500/20'
              : 'border-border/40 focus-visible:border-primary/30',
            'focus-visible:ring-2 focus-visible:ring-primary/10',
            'placeholder:text-muted-foreground/60'
          )}
          readOnly={isRecording}
        />

        {/* Mic button - embedded in textarea */}
        <button
          onClick={toggleRecording}
          disabled={isConnecting || isProcessing}
          type="button"
          className={cn(
            'absolute top-3 right-3 h-8 w-8 rounded-lg',
            'flex items-center justify-center',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Idle state - subtle orange
            !isRecording && !isConnecting && !isProcessing && 'bg-primary/10 hover:bg-primary/20 text-primary hover:scale-105',
            // Recording state - red with glow
            isRecording && 'bg-red-500 text-white shadow-lg shadow-red-500/40',
            // Processing state
            (isConnecting || isProcessing) && 'bg-secondary text-muted-foreground'
          )}
          title={isRecording ? t('voice.clickToStop') : t('voice.clickToRecord')}
        >
          {/* Pulse ring while recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-lg border border-red-500 recording-pulse" />
              <div className="absolute inset-[-2px] rounded-lg border border-red-500/40 recording-pulse" style={{ animationDelay: '0.75s' }} />
            </>
          )}

          {/* Icon */}
          <div className="relative z-10">
            {isConnecting || isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </div>
        </button>
      </div>

      {/* Status text - compact and only when relevant */}
      {(isRecording || isConnecting || isProcessing || error) && (
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5">
            {isConnecting && (
              <span className="text-muted-foreground">{t('voice.connecting')}</span>
            )}
            {isProcessing && (
              <span className="text-muted-foreground">{t('voice.processing')}</span>
            )}
            {isRecording && (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-500 font-medium">{t('voice.recording')}</span>
              </>
            )}
            {error && (
              <span className="text-destructive">{error}</span>
            )}
          </div>
          {isRecording && (
            <span className="text-muted-foreground text-[10px]">{t('voice.clickToStop')}</span>
          )}
        </div>
      )}
    </div>
  )
}
