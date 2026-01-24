import { useState, useEffect } from 'react'
import { VoiceCapture } from './VoiceCapture'
import { ProjectSelector } from './ProjectSelector'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage } from '@/shared/messaging'
import type { Project } from '@/shared/types'
import { Settings, ExternalLink } from 'lucide-react'

export function Popup() {
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null)
  const [transcription, setTranscription] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState<{ url: string; title: string } | null>(null)
  const { toast } = useToast()

  // Check API keys and load projects on mount
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
  }, [])

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
  if (hasApiKeys === null) {
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
        <h1 className="text-lg font-semibold">Segundo Cérebro</h1>
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

  return (
    <div className="w-80 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Segundo Cérebro</h1>
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
