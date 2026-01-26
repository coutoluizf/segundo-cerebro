import { useState, useEffect } from 'react'
import { VoiceCapture } from './VoiceCapture'
import { ProjectSelector } from './ProjectSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage } from '@/shared/messaging'
import type { Project, ItemType } from '@/shared/types'
import { Settings, ExternalLink, Mic, Brain, FileText, Globe, Clipboard, Sparkles, ChevronRight, X, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

// Key for storing whether the dashboard banner was shown (v2 = floating card after save)
const DASHBOARD_BANNER_SHOWN_KEY = 'segundo-cerebro-dashboard-banner-v2-shown'

// Permission states
type MicPermission = 'checking' | 'granted' | 'prompt' | 'denied'

export function Popup() {
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null)
  const [micPermission, setMicPermission] = useState<MicPermission>('checking')
  const [mode, setMode] = useState<ItemType>('tab') // 'tab' or 'note'
  const [transcription, setTranscription] = useState('')
  const [source, setSource] = useState('') // Source for notes (optional)
  const [clipboardText, setClipboardText] = useState<string | null>(null) // Detected clipboard content
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState<{
    url: string
    title: string
    favicon?: string
  } | null>(null)
  const [itemCount, setItemCount] = useState<number>(0) // Total saved items
  const [showDashboardBanner, setShowDashboardBanner] = useState(false) // First-time banner
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

    // Get item count for footer link
    sendMessage({ type: 'GET_ITEMS' }).then((response) => {
      setItemCount(response.items.length)
    })

    // Check microphone permission
    checkMicPermission()

    // Check clipboard for text content
    checkClipboard()
  }, [])

  // Check clipboard for text content
  const checkClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      // Only show if there's meaningful text (more than 10 chars)
      if (text && text.trim().length > 10) {
        setClipboardText(text.trim())
      }
    } catch {
      // Clipboard access denied or not available
      console.log('[Popup] Clipboard access not available')
    }
  }

  // Use clipboard text as transcription
  const useClipboardText = () => {
    if (clipboardText) {
      setTranscription(clipboardText)
      setMode('note') // Switch to note mode when using clipboard
      setClipboardText(null) // Clear the notification
    }
  }

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
        description: mode === 'tab' ? 'Grave algo antes de salvar.' : 'Digite ou cole algo antes de salvar.',
      })
      return
    }

    setIsSaving(true)

    try {
      const response = await sendMessage({
        type: 'SAVE_VOICE_ITEM',
        item: {
          type: mode,
          url: mode === 'tab' ? currentTab?.url : undefined, // undefined for notes, saveItem will handle
          title: mode === 'tab' ? currentTab?.title : null,
          source: mode === 'note' && source.trim() ? source.trim() : null,
          projectId: selectedProject || null,
        },
        transcription: transcription.trim(),
      })

      if (response.success) {
        toast({
          variant: 'success',
          title: 'Salvo!',
          description: mode === 'tab' ? 'Tab salva com sucesso.' : 'Nota salva com sucesso.',
        })

        // Update item count
        setItemCount((prev) => prev + 1)

        // Reset form
        setTranscription('')
        setSource('')

        // Check if dashboard banner was already shown
        chrome.storage.local.get(DASHBOARD_BANNER_SHOWN_KEY, (result) => {
          if (!result[DASHBOARD_BANNER_SHOWN_KEY]) {
            // Show the floating banner (first save after feature deployment)
            setShowDashboardBanner(true)
            // Mark as shown
            chrome.storage.local.set({ [DASHBOARD_BANNER_SHOWN_KEY]: true })
          } else {
            // Close popup after short delay
            setTimeout(() => window.close(), 1500)
          }
        })
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
      <div className="w-80 p-5 gradient-mesh flex flex-col items-center justify-center min-h-[200px]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          <Sparkles className="h-6 w-6 text-primary animate-pulse relative" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  // No API keys configured
  if (!hasApiKeys) {
    return (
      <div className="w-80 p-5 gradient-mesh space-y-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <Brain className="h-6 w-6 text-primary relative" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Segundo Cérebro</h1>
        </div>

        {/* Setup card */}
        <div className="card-luminous rounded-2xl p-5 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Configuração necessária</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure suas API keys para começar a usar.
            </p>
          </div>
          <Button onClick={openOptions} className="w-full rounded-xl h-11">
            <Settings className="h-4 w-4 mr-2" />
            Configurar API Keys
          </Button>
        </div>
        <Toaster />
      </div>
    )
  }

  // Microphone permission not granted - show setup screen
  if (micPermission !== 'granted') {
    return (
      <div className="w-80 p-5 gradient-mesh space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
              <Brain className="h-6 w-6 text-primary relative" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Segundo Cérebro</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={openDashboard} title="Abrir Dashboard" className="rounded-full">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={openOptions} title="Configurações" className="rounded-full">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Setup card */}
        <div className="card-luminous rounded-2xl p-6 text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-primary/10 flex items-center justify-center">
              <Mic className="h-8 w-8 text-primary" />
            </div>
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
        <Button onClick={openMicSetup} className="w-full h-12 rounded-xl text-base">
          <Mic className="h-5 w-5 mr-2" />
          Permitir Microfone
        </Button>

        {/* Quick access to dashboard */}
        <Button variant="outline" onClick={openDashboard} className="w-full rounded-xl">
          <ExternalLink className="h-4 w-4 mr-2" />
          Ver itens salvos
        </Button>

        <Toaster />
      </div>
    )
  }

  // Microphone granted - show full recording UI
  return (
    <div className="w-80 p-5 gradient-mesh space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <Brain className="h-5 w-5 text-primary relative" />
          </div>
          <h1 className="font-semibold tracking-tight">Segundo Cérebro</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={openDashboard} title="Abrir Dashboard" className="h-8 w-8 rounded-full">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={openOptions} title="Configurações" className="h-8 w-8 rounded-full">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode toggle tabs - Pill style */}
      <div className="flex rounded-2xl bg-secondary/50 p-1">
        <button
          onClick={() => setMode('tab')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-xl transition-all duration-200',
            mode === 'tab'
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          Salvar Tab
        </button>
        <button
          onClick={() => setMode('note')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-xl transition-all duration-200',
            mode === 'note'
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          Nota Rápida
        </button>
      </div>

      {/* Clipboard suggestion */}
      {clipboardText && (
        <div
          onClick={useClipboardText}
          className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clipboard className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Texto copiado detectado</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {clipboardText.substring(0, 50)}...
            </p>
          </div>
        </div>
      )}

      {/* Current tab info (only in tab mode) */}
      {mode === 'tab' && currentTab && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground truncate">
            {currentTab.title || currentTab.url}
          </span>
        </div>
      )}

      {/* Voice capture */}
      <VoiceCapture
        onTranscriptionChange={setTranscription}
        transcription={transcription}
        placeholder={mode === 'tab' ? 'Grave ou digite sobre esta tab...' : 'Cole ou digite sua nota...'}
      />

      {/* Source field (only in note mode) */}
      {mode === 'note' && (
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Fonte (opcional): Twitter @user, Livro X..."
          className="text-sm rounded-xl bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      )}

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
        className="w-full h-11 rounded-xl text-sm font-medium"
      >
        {isSaving ? (
          <>
            <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
            Salvando...
          </>
        ) : mode === 'tab' ? (
          'Salvar Tab'
        ) : (
          'Salvar Nota'
        )}
      </Button>

      {/* Footer link to dashboard */}
      {itemCount > 0 && (
        <button
          onClick={openDashboard}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>
            Ver seus <span className="font-medium text-foreground">{itemCount}</span> {itemCount === 1 ? 'item salvo' : 'itens salvos'}
          </span>
          <ChevronRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </button>
      )}

      {/* First-time dashboard floating card */}
      {showDashboardBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
          <div className="bg-background border border-border/50 rounded-2xl shadow-2xl p-4">
            {/* Close button */}
            <button
              onClick={() => {
                setShowDashboardBanner(false)
                setTimeout(() => window.close(), 300)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Item salvo!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conheça o Dashboard com busca semântica e organização por projetos.
                </p>

                {/* CTA */}
                <button
                  onClick={openDashboard}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Abrir Dashboard
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
