import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Sparkles, Mic, MicOff } from 'lucide-react'
import { ScribeClient, type ScribeConfig } from '@/shared/scribe'
import type { ScribeState } from '@/shared/types'
import { sendMessage } from '@/shared/messaging'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  isSearching: boolean
  large?: boolean // Large hero mode
}

/**
 * Semantic search bar with AI indicator and voice search
 * Features debounced search, loading state, and speech-to-text
 */
export function SearchBar({ value, onChange, isSearching, large = false }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [voiceState, setVoiceState] = useState<ScribeState>('idle')
  const scribeRef = useRef<ScribeClient | null>(null)

  // Sync with external value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scribeRef.current) {
        scribeRef.current.disconnect()
      }
    }
  }, [])

  // Start voice search
  const startVoiceSearch = async () => {
    try {
      const apiKeys = await sendMessage({ type: 'GET_API_KEYS' })
      if (!apiKeys.elevenlabs) {
        console.error('[SearchBar] ElevenLabs API key not configured')
        return
      }

      const config: ScribeConfig = {
        apiKey: apiKeys.elevenlabs,
        language: 'pt',
        onTranscript: (text, _isFinal) => {
          setLocalValue(text)
        },
        onError: (err) => {
          console.error('[SearchBar] Scribe error:', err)
          setVoiceState('error')
        },
        onStateChange: (newState) => {
          setVoiceState(newState)
        },
      }

      scribeRef.current = new ScribeClient(config)
      await scribeRef.current.connect()
    } catch (err) {
      console.error('[SearchBar] Error starting voice search:', err)
      setVoiceState('error')
    }
  }

  // Stop voice search
  const stopVoiceSearch = async () => {
    if (scribeRef.current) {
      const finalTranscript = await scribeRef.current.disconnect()
      setLocalValue(finalTranscript)
      // Trigger search immediately after voice input
      onChange(finalTranscript)
      scribeRef.current = null
    }
  }

  // Toggle voice search
  const toggleVoiceSearch = () => {
    if (voiceState === 'listening') {
      stopVoiceSearch()
    } else if (voiceState === 'idle' || voiceState === 'error') {
      startVoiceSearch()
    }
  }

  const isListening = voiceState === 'listening'
  const isConnecting = voiceState === 'connecting'

  return (
    <div className={cn('relative group', large && 'w-full')}>
      {/* Glow effect on focus or listening */}
      <div
        className={cn(
          'absolute -inset-1 rounded-2xl blur-lg transition-opacity duration-300',
          isListening ? 'bg-red-500/30 opacity-100' : 'bg-primary/20',
          (isFocused || isListening) ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Search container */}
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-2xl transition-all duration-200',
          large ? 'px-5 py-4' : 'px-4 py-2.5',
          isListening
            ? 'bg-red-500/10 ring-2 ring-red-500/30'
            : isFocused
              ? 'bg-secondary ring-2 ring-primary/20'
              : 'bg-secondary/50 hover:bg-secondary/70'
        )}
      >
        {/* Search icon */}
        <div className="text-muted-foreground">
          {isSearching ? (
            <Loader2 className={cn('animate-spin text-primary', large ? 'h-5 w-5' : 'h-4 w-4')} />
          ) : (
            <Search className={cn(large ? 'h-5 w-5' : 'h-4 w-4')} />
          )}
        </div>

        {/* Input */}
        <input
          type="search"
          placeholder={isListening ? 'Ouvindo...' : 'Buscar por significado...'}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground/60',
            large ? 'text-base' : 'text-sm',
            isListening && 'placeholder:text-red-500/60'
          )}
          readOnly={isListening}
        />

        {/* Voice search button */}
        <button
          onClick={toggleVoiceSearch}
          disabled={isConnecting}
          className={cn(
            'p-2 rounded-xl transition-all duration-200',
            isListening
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'hover:bg-background/50 text-muted-foreground hover:text-foreground',
            isConnecting && 'opacity-50 cursor-not-allowed'
          )}
          title={isListening ? 'Parar gravação' : 'Buscar por voz'}
        >
          {isConnecting ? (
            <Loader2 className={cn('animate-spin', large ? 'h-5 w-5' : 'h-4 w-4')} />
          ) : isListening ? (
            <MicOff className={cn(large ? 'h-5 w-5' : 'h-4 w-4')} />
          ) : (
            <Mic className={cn(large ? 'h-5 w-5' : 'h-4 w-4')} />
          )}
        </button>

        {/* AI indicator */}
        <div className={cn(
          'flex items-center gap-1 text-muted-foreground/60',
          large ? 'text-sm' : 'text-xs'
        )}>
          <Sparkles className={cn(large ? 'h-4 w-4' : 'h-3 w-3')} />
          <span className="hidden sm:inline">AI</span>
        </div>
      </div>

      {/* Voice status indicator */}
      {isListening && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-red-500 flex items-center justify-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Fale sua busca...
          </span>
        </div>
      )}
    </div>
  )
}
