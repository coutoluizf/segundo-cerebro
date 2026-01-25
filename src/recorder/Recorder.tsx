import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScribeClient, type ScribeConfig } from '@/shared/scribe'
import { sendMessage } from '@/shared/messaging'
import type { Project, ScribeState } from '@/shared/types'
import { Mic, MicOff, Loader2, Brain, ExternalLink, ArrowLeft } from 'lucide-react'

// Special value for "no project" since Radix Select doesn't allow empty string
const NO_PROJECT_VALUE = '__none__'

// Get URL params
function getUrlParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    url: params.get('url') || '',
    title: params.get('title') || '',
    favicon: params.get('favicon') || '',
  }
}

export function Recorder() {
  const [state, setState] = useState<ScribeState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcription, setTranscription] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [tabInfo] = useState(getUrlParams)
  const scribeRef = useRef<ScribeClient | null>(null)
  const { toast } = useToast()

  // Load projects on mount
  useEffect(() => {
    sendMessage({ type: 'GET_PROJECTS' }).then((response) => {
      setProjects(response.projects)
    })

    // Cleanup on unmount
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
          setTranscription(text)
        },
        onError: (err) => {
          console.error('[Recorder] Scribe error:', err)
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
      console.error('[Recorder] Error starting recording:', err)
      setError(err instanceof Error ? err.message : 'Erro ao iniciar gravação')
      setState('error')
    }
  }

  // Stop recording
  const stopRecording = async () => {
    if (scribeRef.current) {
      const finalTranscript = await scribeRef.current.disconnect()
      setTranscription(finalTranscript)
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

  // Handle save
  const handleSave = async () => {
    if (!transcription.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Grave algo antes de salvar.',
      })
      return
    }

    setIsSaving(true)

    try {
      const projectId = selectedProject === NO_PROJECT_VALUE ? '' : selectedProject

      const response = await sendMessage({
        type: 'SAVE_VOICE_ITEM',
        item: {
          url: tabInfo.url,
          title: tabInfo.title,
          favicon: tabInfo.favicon,
          projectId: projectId || null,
        },
        transcription: transcription.trim(),
      })

      if (response.success) {
        toast({
          variant: 'success',
          title: 'Salvo!',
          description: 'Item salvo com sucesso.',
        })
        // Close tab after short delay
        setTimeout(() => window.close(), 1000)
      } else {
        throw new Error(response.error || 'Erro ao salvar')
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Open dashboard
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
  }

  // Go back (close this tab)
  const goBack = () => {
    window.close()
  }

  // Get button state
  const isRecording = state === 'listening'
  const isConnecting = state === 'connecting'
  const isProcessing = state === 'processing'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} title="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Segundo Cérebro</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={openDashboard}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver salvos
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Tab info */}
          {tabInfo.title && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-1">
              <div className="text-sm text-muted-foreground">Salvando página:</div>
              <div className="font-medium truncate">{tabInfo.title}</div>
              {tabInfo.url && (
                <div className="text-sm text-muted-foreground truncate">{tabInfo.url}</div>
              )}
            </div>
          )}

          {/* Mic button - centered and prominent */}
          <div className="flex flex-col items-center gap-4 py-8">
            <Button
              variant={isRecording ? 'destructive' : 'default'}
              size="lg"
              className="h-24 w-24 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              onClick={toggleRecording}
              disabled={isConnecting || isProcessing}
            >
              {isConnecting || isProcessing ? (
                <Loader2 className="h-10 w-10 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-10 w-10" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </Button>

            {/* Status text */}
            <div className="text-center text-sm">
              {isConnecting && (
                <span className="text-muted-foreground">Conectando ao microfone...</span>
              )}
              {isProcessing && (
                <span className="text-muted-foreground">Processando...</span>
              )}
              {isRecording && (
                <span className="text-red-500 animate-pulse font-medium">
                  🔴 Gravando... Clique para parar
                </span>
              )}
              {state === 'idle' && !transcription && (
                <span className="text-muted-foreground">Clique no microfone para gravar</span>
              )}
              {state === 'idle' && transcription && (
                <span className="text-green-600 dark:text-green-400">✓ Gravação finalizada</span>
              )}
              {state === 'error' && error && (
                <span className="text-destructive">{error}</span>
              )}
            </div>
          </div>

          {/* Transcription */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Transcrição</label>
            <Textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="A transcrição aparecerá aqui..."
              className="min-h-40 resize-none text-base"
              readOnly={isRecording}
            />
            <p className="text-xs text-muted-foreground">
              Você pode editar a transcrição antes de salvar.
            </p>
          </div>

          {/* Project selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Projeto</label>
            <Select
              value={selectedProject || NO_PROJECT_VALUE}
              onValueChange={(v) => setSelectedProject(v === NO_PROJECT_VALUE ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT_VALUE}>
                  <span className="text-muted-foreground">Sem projeto</span>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      {project.color && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                      )}
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={!transcription.trim() || isSaving}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </main>

      <Toaster />
    </div>
  )
}
