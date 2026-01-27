import { useState, useEffect } from 'react'
import { VoiceCapture } from './VoiceCapture'
import { ProjectSelector } from './ProjectSelector'
import { ReminderPicker } from './ReminderPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage } from '@/shared/messaging'
import { getSettings, saveSettings } from '@/shared/settings'
import type { Project, ItemType, VoiceItem } from '@/shared/types'
import { Settings, ExternalLink, Mic, FileText, Globe, Clipboard, Sparkles, ChevronRight, X, LayoutDashboard, AlertCircle, Calendar, RefreshCw } from 'lucide-react'
import { RajiLogo } from '@/components/RajiLogo'
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
  const [reminderAt, setReminderAt] = useState<number | null>(null) // Reminder timestamp
  const [closeTabOnSave, setCloseTabOnSave] = useState<boolean>(true) // Override for global setting
  const [isSaving, setIsSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState<{
    url: string
    title: string
    favicon?: string
    id?: number
    windowId?: number
  } | null>(null)
  const [itemCount, setItemCount] = useState<number>(0) // Total saved items
  const [showDashboardBanner, setShowDashboardBanner] = useState(false) // First-time banner
  const [duplicateItem, setDuplicateItem] = useState<VoiceItem | null>(null) // Existing item with same URL
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false) // User chose to save as new
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

    // Get current tab info directly from Chrome API (more reliable than background)
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      console.log('[Popup] Direct tab query:', tab?.id, tab?.url, 'windowId:', tab?.windowId)
      if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        setCurrentTab({
          url: tab.url,
          title: tab.title || '',
          favicon: tab.favIconUrl,
          id: tab.id,
          windowId: tab.windowId,
        })
      }
    })

    // Get item count for footer link
    sendMessage({ type: 'GET_ITEMS' }).then((response) => {
      setItemCount(response.items.length)
    })

    // Load global closeTabOnSave setting
    getSettings().then((settings) => {
      setCloseTabOnSave(settings.closeTabOnSave)
    })

    // Check microphone permission
    checkMicPermission()

    // Check clipboard for text content
    checkClipboard()
  }, [])

  // Check for duplicate URL when we have current tab info
  useEffect(() => {
    console.log('[Popup] Duplicate useEffect triggered - mode:', mode, 'currentTab:', currentTab?.url, 'ignoreDuplicate:', ignoreDuplicate)

    // Only check in tab mode and if we have a URL
    if (mode !== 'tab' || !currentTab?.url || ignoreDuplicate) {
      console.log('[Popup] Skipping duplicate check - conditions not met')
      return
    }

    // Skip special URLs (chrome://, about:, etc.)
    if (currentTab.url.startsWith('chrome://') ||
        currentTab.url.startsWith('about:') ||
        currentTab.url.startsWith('chrome-extension://')) {
      return
    }

    // Check if this URL already exists
    console.log('[Popup] Checking for duplicate URL:', currentTab.url)
    sendMessage({ type: 'CHECK_DUPLICATE_URL', url: currentTab.url }).then((response) => {
      console.log('[Popup] Duplicate check response:', response)
      if (response.exists && response.item) {
        console.log('[Popup] Found duplicate item:', response.item.id, response.item.title)
        setDuplicateItem(response.item)
      } else {
        console.log('[Popup] No duplicate found')
        setDuplicateItem(null)
      }
    }).catch((error) => {
      console.error('[Popup] Error checking duplicate:', error)
    })
  }, [currentTab?.url, mode, ignoreDuplicate])

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
    // Transcription is required for notes, optional for tabs (since AI generates summary)
    if (mode === 'note' && !transcription.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite ou cole algo antes de salvar.',
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
          reminderAt: mode === 'tab' ? reminderAt : null, // Reminders only for tabs
        },
        transcription: transcription.trim(),
        closeTabOnSave: mode === 'tab' ? closeTabOnSave : undefined, // Pass override for tab mode
        tabId: mode === 'tab' ? currentTab?.id : undefined, // Pass tab ID for screenshot capture
        windowId: mode === 'tab' ? currentTab?.windowId : undefined, // Pass window ID for screenshot capture
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
        setReminderAt(null)

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

  // Toggle close tab on save (also saves to global settings)
  const toggleCloseTabOnSave = async () => {
    const newValue = !closeTabOnSave
    setCloseTabOnSave(newValue)
    // Save to global settings so it persists
    await saveSettings({ closeTabOnSave: newValue })
  }

  // Format date for duplicate item display
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Handle updating existing item instead of creating new
  const handleUpdateExisting = async () => {
    if (!duplicateItem) return

    setIsSaving(true)
    try {
      // Update the existing item with new transcription (if provided) and new thumbnail
      const updates: { transcription?: string; aiSummary?: string } = {}
      if (transcription.trim()) {
        updates.transcription = transcription.trim()
      }

      const response = await sendMessage({
        type: 'UPDATE_ITEM',
        id: duplicateItem.id,
        updates,
        // Capture a new thumbnail since we're on the same page
        captureNewThumbnail: true,
        tabId: currentTab?.id,
        windowId: currentTab?.windowId,
      })

      if (response.success) {
        toast({
          variant: 'success',
          title: 'Atualizado!',
          description: 'Item existente atualizado com sucesso.',
        })
        // Reset form and close
        setTranscription('')
        setDuplicateItem(null)
        setTimeout(() => window.close(), 1500)
      } else {
        throw new Error(response.error || 'Erro ao atualizar')
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // User chose to save as new item, ignore duplicate
  const handleSaveAsNew = () => {
    setIgnoreDuplicate(true)
    setDuplicateItem(null)
  }

  // Loading state
  if (hasApiKeys === null || micPermission === 'checking') {
    return (
      <div className="w-[550px] p-5 gradient-mesh flex flex-col items-center justify-center min-h-[200px]">
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
      <div className="w-[550px] p-5 gradient-mesh space-y-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <RajiLogo size={24} className="relative" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">HeyRaji</h1>
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
      <div className="w-[550px] p-5 gradient-mesh space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
              <RajiLogo size={24} className="relative" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">HeyRaji</h1>
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
    <div className="w-[550px] h-[600px] p-5 gradient-mesh space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <RajiLogo size={20} className="relative" />
          </div>
          <h1 className="font-semibold tracking-tight">HeyRaji</h1>
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
          onClick={() => {
            setMode('note')
            setReminderAt(null) // Clear reminder when switching to note mode
          }}
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

      {/* Duplicate URL warning */}
      {mode === 'tab' && duplicateItem && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          {/* Header with warning icon */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-500">Você já salvou esta página</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Salvo em {formatDate(duplicateItem.createdAt)}
              </p>
            </div>
          </div>

          {/* Existing item preview */}
          <div className="rounded-lg bg-background/50 p-3 space-y-1">
            <p className="text-sm font-medium line-clamp-1">
              {duplicateItem.title || 'Sem título'}
            </p>
            {duplicateItem.transcription && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {duplicateItem.transcription}
              </p>
            )}
            {duplicateItem.projectId && (
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {projects.find(p => p.id === duplicateItem.projectId)?.name || 'Projeto'}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateExisting}
              disabled={isSaving}
              className="flex-1 rounded-lg text-xs h-8"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Atualizar existente
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAsNew}
              className="flex-1 rounded-lg text-xs h-8"
            >
              Salvar como novo
            </Button>
          </div>
        </div>
      )}

      {/* Voice capture - optional for tabs (AI generates summary), required for notes */}
      <VoiceCapture
        onTranscriptionChange={setTranscription}
        transcription={transcription}
        placeholder={mode === 'tab' ? 'Comentário opcional (AI gera resumo)...' : 'Cole ou digite sua nota...'}
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

      {/* Reminder picker (only for tabs, not notes) - moved BEFORE project selector */}
      {mode === 'tab' && (
        <ReminderPicker
          value={reminderAt}
          onChange={setReminderAt}
          disabled={isSaving}
        />
      )}

      {/* Project, Save button, and footer - with spacing from reminder picker */}
      <div className="space-y-4 pt-6">
        {/* Project selector */}
        <ProjectSelector
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
        />

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={(mode === 'note' && !transcription.trim()) || isSaving}
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

        {/* Close tab toggle - only show in tab mode, friendly switch design */}
        {mode === 'tab' && (
          <button
            onClick={toggleCloseTabOnSave}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <span className="text-xs text-muted-foreground">Fechar tab ao salvar</span>
            {/* Custom switch */}
            <div
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                closeTabOnSave ? 'bg-primary' : 'bg-border'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  closeTabOnSave ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </div>
          </button>
        )}

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
      </div>

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
