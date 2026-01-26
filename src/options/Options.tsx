import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendMessage } from '@/shared/messaging'
import { AVAILABLE_LANGUAGES } from '@/shared/settings'
import type { Project } from '@/shared/types'
import { Brain, Key, FolderOpen, Plus, Trash2, ExternalLink, Sparkles, Globe, TabletSmartphone } from 'lucide-react'

export function Options() {
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [language, setLanguage] = useState('pt-BR')
  const [autoSummarize, setAutoSummarize] = useState(true)
  const [closeTabOnSave, setCloseTabOnSave] = useState(true)
  const { toast } = useToast()

  // Load current settings
  useEffect(() => {
    // Load API keys
    sendMessage({ type: 'GET_API_KEYS' }).then((keys) => {
      setElevenlabsKey(keys.elevenlabs || '')
      setOpenaiKey(keys.openai || '')
    })

    // Load projects
    sendMessage({ type: 'GET_PROJECTS' }).then((response) => {
      setProjects(response.projects)
    })

    // Load user settings
    sendMessage({ type: 'GET_SETTINGS' }).then((settings) => {
      setLanguage(settings.language)
      setAutoSummarize(settings.autoSummarize)
      setCloseTabOnSave(settings.closeTabOnSave)
    })
  }, [])

  // Save API keys
  const handleSaveKeys = async () => {
    setIsSaving(true)
    try {
      await sendMessage({
        type: 'SET_API_KEYS',
        elevenlabs: elevenlabsKey || undefined,
        openai: openaiKey || undefined,
      })
      toast({
        variant: 'success',
        title: 'Salvo!',
        description: 'API keys salvas com sucesso.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar API keys.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle language change
  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage)
    try {
      await sendMessage({ type: 'SET_SETTINGS', settings: { language: newLanguage } })
      toast({
        variant: 'success',
        title: 'Idioma atualizado',
        description: 'Idioma dos resumos AI alterado.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar configuração.',
      })
    }
  }

  // Handle auto-summarize toggle
  const handleAutoSummarizeChange = async (enabled: boolean) => {
    setAutoSummarize(enabled)
    try {
      await sendMessage({ type: 'SET_SETTINGS', settings: { autoSummarize: enabled } })
      toast({
        variant: 'success',
        title: enabled ? 'Resumo automático ativado' : 'Resumo automático desativado',
        description: enabled
          ? 'Páginas serão resumidas automaticamente ao salvar.'
          : 'Apenas sua transcrição será salva.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar configuração.',
      })
    }
  }

  // Handle close tab on save toggle
  const handleCloseTabOnSaveChange = async (enabled: boolean) => {
    setCloseTabOnSave(enabled)
    try {
      await sendMessage({ type: 'SET_SETTINGS', settings: { closeTabOnSave: enabled } })
      toast({
        variant: 'success',
        title: enabled ? 'Fechar tab ativado' : 'Fechar tab desativado',
        description: enabled
          ? 'A tab será fechada automaticamente após salvar.'
          : 'A tab permanecerá aberta após salvar.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao salvar configuração.',
      })
    }
  }

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    try {
      const response = await sendMessage({
        type: 'CREATE_PROJECT',
        name: newProjectName.trim(),
      })

      if (response.success && response.project) {
        setProjects([...projects, response.project])
        setNewProjectName('')
        toast({
          variant: 'success',
          title: 'Projeto criado',
          description: `Projeto "${response.project.name}" criado.`,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao criar projeto.',
      })
    }
  }

  // Delete project
  const handleDeleteProject = async (project: Project) => {
    try {
      await sendMessage({ type: 'DELETE_PROJECT', id: project.id })
      setProjects(projects.filter((p) => p.id !== project.id))
      toast({
        variant: 'success',
        title: 'Projeto removido',
        description: `Projeto "${project.name}" removido.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao remover projeto.',
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Segundo Cérebro</h1>
        </div>

        <div className="space-y-6">
          {/* API Keys Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Configure suas API keys para ElevenLabs e OpenAI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ElevenLabs Key */}
              <div className="space-y-2">
                <Label htmlFor="elevenlabs">ElevenLabs API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="elevenlabs"
                    type="password"
                    placeholder="sk_..."
                    value={elevenlabsKey}
                    onChange={(e) => setElevenlabsKey(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a
                      href="https://elevenlabs.io/app/settings/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Obter API Key"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado para transcrição de voz em tempo real.
                </p>
              </div>

              {/* OpenAI Key */}
              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai"
                    type="password"
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Obter API Key"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado para gerar embeddings e busca semântica.
                </p>
              </div>

              <Button onClick={handleSaveKeys} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar API Keys'}
              </Button>
            </CardContent>
          </Card>

          {/* AI Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Resumo Automático (AI)
              </CardTitle>
              <CardDescription>
                Configure o resumo automático de páginas usando inteligência artificial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-summarize toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-summarize">Resumir páginas automaticamente</Label>
                  <p className="text-xs text-muted-foreground">
                    Gera um resumo AI do conteúdo da página ao salvar tabs.
                  </p>
                </div>
                <Switch
                  id="auto-summarize"
                  checked={autoSummarize}
                  onCheckedChange={handleAutoSummarizeChange}
                />
              </div>

              {/* Language selector */}
              <div className="space-y-2">
                <Label htmlFor="language" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Idioma dos resumos
                </Label>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O resumo será gerado neste idioma, independente do idioma da página.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Behavior Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TabletSmartphone className="h-5 w-5" />
                Comportamento
              </CardTitle>
              <CardDescription>
                Configure o comportamento ao salvar tabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Close tab on save toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="close-tab">Fechar tab ao salvar</Label>
                  <p className="text-xs text-muted-foreground">
                    Fecha automaticamente a tab após salvar. Não se aplica a notas.
                  </p>
                </div>
                <Switch
                  id="close-tab"
                  checked={closeTabOnSave}
                  onCheckedChange={handleCloseTabOnSaveChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Projects Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Projetos
              </CardTitle>
              <CardDescription>
                Gerencie seus projetos para organizar itens salvos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New project form */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do novo projeto"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <Button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Projects list */}
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum projeto criado ainda.
                  </p>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-2 rounded-md border"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: project.color || '#6B7280' }}
                        />
                        <span className="text-sm">{project.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProject(project)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
