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
import type { User } from '@supabase/supabase-js'
import { User as UserIcon, Key, FolderOpen, Plus, Trash2, ExternalLink, Sparkles, Globe, TabletSmartphone, LogOut, Mail, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { RajiLogo } from '@/components/RajiLogo'

export function Options() {
  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false)

  // API Keys state (legacy/fallback)
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [language, setLanguage] = useState('pt-BR')
  const [autoSummarize, setAutoSummarize] = useState(true)
  const [closeTabOnSave, setCloseTabOnSave] = useState(true)
  const [useTabGroups, setUseTabGroups] = useState(true)
  const { toast } = useToast()

  // Load current settings
  useEffect(() => {
    // Check auth state
    sendMessage({ type: 'AUTH_GET_USER' }).then((response) => {
      setUser(response.user)
      setIsAuthLoading(false)
    }).catch(() => {
      setIsAuthLoading(false)
    })

    // Load API keys (for backward compatibility / advanced users)
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
      setUseTabGroups(settings.useTabGroups)
    })
  }, [])

  // Handle sending OTP code
  const handleSendOtp = async () => {
    if (!email.trim()) return

    setIsSigningIn(true)
    try {
      const response = await sendMessage({ type: 'AUTH_SEND_OTP', email: email.trim() })
      if (response.success) {
        setOtpSent(true)
        toast({
          variant: 'success',
          title: 'Código enviado!',
          description: `Verifique seu email ${email} e digite o código.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: response.error || 'Erro ao enviar código.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao enviar código.',
      })
    } finally {
      setIsSigningIn(false)
    }
  }

  // Handle verifying OTP code
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) return

    setIsVerifying(true)
    try {
      const response = await sendMessage({
        type: 'AUTH_VERIFY_OTP',
        email: email.trim(),
        code: otpCode.trim(),
      })
      if (response.success && response.user) {
        setUser(response.user)
        setOtpSent(false)
        setOtpCode('')
        toast({
          variant: 'success',
          title: 'Login realizado!',
          description: 'Bem-vindo ao HeyRaji!',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Código inválido',
          description: response.error || 'Verifique o código e tente novamente.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao verificar código.',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await sendMessage({ type: 'AUTH_SIGN_OUT' })
      setUser(null)
      setOtpSent(false)
      setOtpCode('')
      setEmail('')
      toast({
        variant: 'success',
        title: 'Deslogado',
        description: 'Você saiu da sua conta.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao sair da conta.',
      })
    }
  }

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

  // Handle use tab groups toggle
  const handleUseTabGroupsChange = async (enabled: boolean) => {
    setUseTabGroups(enabled)
    try {
      await sendMessage({ type: 'SET_SETTINGS', settings: { useTabGroups: enabled } })
      toast({
        variant: 'success',
        title: enabled ? 'Grupos de tabs ativado' : 'Grupos de tabs desativado',
        description: enabled
          ? 'Tabs serão organizadas em grupos por projeto.'
          : 'Tabs não serão agrupadas automaticamente.',
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
          <RajiLogo size={32} />
          <h1 className="text-2xl font-bold">HeyRaji</h1>
        </div>

        <div className="space-y-6">
          {/* Account Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Conta
              </CardTitle>
              <CardDescription>
                {user
                  ? 'Você está logado. Seus dados são sincronizados automaticamente.'
                  : 'Faça login para sincronizar seus dados entre dispositivos.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAuthLoading ? (
                // Loading state
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : user ? (
                // Logged in state
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Dados sincronizados
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair da conta
                  </Button>
                </div>
              ) : otpSent ? (
                // OTP verification state
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <div className="flex justify-center mb-3">
                      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <p className="font-medium">Verifique seu email</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enviamos um código para <strong>{email}</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp">Código de verificação</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                      className="text-center text-2xl tracking-[0.3em] font-mono"
                    />
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    disabled={isVerifying || otpCode.length !== 6}
                    className="w-full"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      'Verificar código'
                    )}
                  </Button>

                  <div className="flex justify-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSendOtp}
                      disabled={isSigningIn}
                    >
                      Reenviar código
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOtpSent(false)
                        setOtpCode('')
                        setEmail('')
                      }}
                    >
                      Usar outro email
                    </Button>
                  </div>
                </div>
              ) : (
                // Login form
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    />
                  </div>
                  <Button
                    onClick={handleSendOtp}
                    disabled={isSigningIn || !email.trim()}
                    className="w-full"
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar código de verificação
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Você receberá um código no seu email para fazer login.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced: API Keys Card (collapsible) */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowAdvancedKeys(!showAdvancedKeys)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys (Avançado)
                </div>
                {showAdvancedKeys ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CardTitle>
              {!showAdvancedKeys && (
                <CardDescription>
                  Opcional - configure suas próprias API keys se preferir.
                </CardDescription>
              )}
            </CardHeader>
            {showAdvancedKeys && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground border-l-2 border-amber-500 pl-3">
                  {user
                    ? 'Você está logado, então não precisa configurar API keys. Elas são opcionais.'
                    : 'Se você não quiser criar uma conta, pode usar suas próprias API keys.'}
                </p>

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
            )}
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

              {/* Use tab groups toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tab-groups">Organizar em grupos por projeto</Label>
                  <p className="text-xs text-muted-foreground">
                    Agrupa tabs automaticamente pelo projeto ao salvar ou abrir lembretes.
                  </p>
                </div>
                <Switch
                  id="tab-groups"
                  checked={useTabGroups}
                  onCheckedChange={handleUseTabGroupsChange}
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
