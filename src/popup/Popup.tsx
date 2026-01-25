import { useState, useEffect } from 'react'
import { VoiceCapture } from './VoiceCapture'
import { ProjectSelector } from './ProjectSelector'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage } from '@/shared/messaging'
import type { Project } from '@/shared/types'
import { Settings, ExternalLink, Mic, Brain } from 'lucide-react'

// Permission states
type MicPermission = 'checking' | 'granted' | 'prompt' | 'denied'

export function Popup() {
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null)
  const [micPermission, setMicPermission] = useState<MicPermission>('checking')
  const [transcription, setTranscription] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState<{
    url: string
    title: string
    favicon?: string
  } | null>(null)
  const { toast } = useToast()

  // Check API keys, mic permission, and get current tab on mount
  useEffect(() => {
    // Check API keys
    sendMessage({ type: 'CHECK_API_KEYS' }).then((response) => {
      setHasApiKeys(response.hasKeys)
    })

    // Load projects
    sendMessage({ type: 'GET_PROJECTS' }).then((response) => {
      setProjects(response.projects)
    })

    // Get current tab info
    sendMessage({ type: 'GET_CONTEXT' }).then((context) => {
      setCurrentTab(context.activeTab)
    })

    // Check microphone permission
    checkMicPermission()
  }, [])

  // Check microphone permission status
  const checkMicPermission = async () => {
    try {
      // Use Permissions API to check without prompting
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setMicPermission(result.state as MicPermission)

      // Listen for permission changes
      result.onchange = () => {
        setMicPermission(result.state as MicPermission)
      }
    } catch (error) {
      // Permissions API not supported, assume we need to ask
      console.log('[Popup] Permissions API not available, will try on first use')
      setMicPermission('prompt')
    }
  }

  // Open setup page to request microphone permission
  const openMicSetup = () => {
    const params = new URLSearchParams()
    if (currentTab?.url) params.set('url', currentTab.url)
    if (currentTab?.title) params.set('title', currentTab.title)
    if (currentTab?.favicon) params.set('favicon', currentTab.favicon)
    params.set('setup', 'true') // Flag to indicate this is setup mode

    const recorderUrl = chrome.runtime.getURL(
      `src/recorder/index.html?${params.toString()}`
    )

    chrome.tabs.create({ url: recorderUrl })
    window.close()
  }

  // Handle save action
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
      const response = await sendMessage({
        type: 'SAVE_VOICE_ITEM',
        item: {
          url: currentTab?.url,
          title: currentTab?.title,
          projectId: selectedProject || null,
        },
        transcription: transcription.trim(),
      })

      if (response.success) {
        toast({
          variant: 'success',
          title: 'Salvo!',
          description: 'Item salvo com sucesso.',
        })
        // Reset after save
        setTranscription('')
        // Close popup after short delay
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

  // Open options page
  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  // Open dashboard
  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })
  }

  // Loading state
  if (hasApiKeys === null || micPermission === 'checking') {
    return (
      <div className="w-80 p-4 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  // No API keys configured
  if (!hasApiKeys) {
    return (
      <div className="w-80 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Segundo Cérebro</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure suas API keys para começar a usar.
        </p>
        <Button onClick={openOptions} className="w-full">
          <Settings className="h-4 w-4 mr-2" />
          Configurar API Keys
        </Button>
        <Toaster />
      </div>
    )
  }

  // Microphone permission not granted - show setup screen
  if (micPermission !== 'granted') {
    return (
      <div className="w-80 p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Segundo Cérebro</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={openDashboard} title="Abrir Dashboard">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={openOptions} title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Setup message */}
        <div className="text-center py-4 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Configuração Inicial</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {micPermission === 'denied'
                ? 'Permissão de microfone negada. Clique para configurar novamente.'
                : 'Permita o acesso ao microfone para gravar suas anotações por voz.'}
            </p>
          </div>
        </div>

        {/* Setup button */}
        <Button onClick={openMicSetup} className="w-full h-12 text-base" size="lg">
          <Mic className="h-5 w-5 mr-2" />
          Permitir Microfone
        </Button>

        {/* Quick access to dashboard */}
        <Button variant="outline" onClick={openDashboard} className="w-full">
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver itens salvos
        </Button>

        <Toaster />
      </div>
    )
  }

  // Microphone granted - show full recording UI
  return (
    <div className="w-80 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Segundo Cérebro</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={openDashboard} title="Abrir Dashboard">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={openOptions} title="Configurações">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Current tab info */}
      {currentTab && (
        <div className="text-xs text-muted-foreground truncate">
          Salvando: {currentTab.title || currentTab.url}
        </div>
      )}

      {/* Voice capture */}
      <VoiceCapture
        onTranscriptionChange={setTranscription}
        transcription={transcription}
      />

      {/* Project selector */}
      <ProjectSelector
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
      />

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!transcription.trim() || isSaving}
        className="w-full"
      >
        {isSaving ? 'Salvando...' : 'Salvar'}
      </Button>

      <Toaster />
    </div>
  )
}
