import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { saveSettings } from '@/shared/settings'
import { useLanguage } from '@/i18n/useLanguage'
import type { Project } from '@/shared/types'
import type { User } from '@supabase/supabase-js'
import {
  User as UserIcon,
  Key,
  FolderOpen,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  TabletSmartphone,
  LogOut,
  Mail,
  Loader2,
  ChevronDown,
  ChevronUp,
  Languages,
} from 'lucide-react'
import { RajiLogo } from '@/components/RajiLogo'

export function Options() {
  const { t } = useTranslation()
  const { currentLanguage, setLanguage, locales, localeLabels, localeFlags } = useLanguage()

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
  const [autoSummarize, setAutoSummarize] = useState(true)
  const [closeTabOnSave, setCloseTabOnSave] = useState(true)
  const [useTabGroups, setUseTabGroups] = useState(true)
  const { toast } = useToast()

  // Load current settings
  useEffect(() => {
    // Check auth state
    sendMessage({ type: 'AUTH_GET_USER' })
      .then((response) => {
        setUser(response.user)
        setIsAuthLoading(false)
      })
      .catch(() => {
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
      setAutoSummarize(settings.autoSummarize)
      setCloseTabOnSave(settings.closeTabOnSave)
      setUseTabGroups(settings.useTabGroups)
    })
  }, [])

  // Handle UI language change
  const handleUILanguageChange = async (newLanguage: string) => {
    // Update i18n
    await setLanguage(newLanguage as 'en' | 'pt' | 'es')
    // Persist to settings (which also syncs to Supabase)
    await saveSettings({ language: newLanguage as 'en' | 'pt' | 'es' })
  }

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
          title: t('options.otp.codeSentTitle'),
          description: t('options.otp.codeSentDescription', { email }),
        })
      } else {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: response.error || t('options.toast.errorSaving'),
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
          title: t('options.auth.loginSuccess'),
          description: t('options.auth.welcome'),
        })
      } else {
        toast({
          variant: 'destructive',
          title: t('options.otp.invalidCode'),
          description: response.error || t('options.otp.invalidCodeDescription'),
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
        title: t('options.auth.signedOut'),
        description: t('options.auth.signedOutDescription'),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSignOut'),
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
        title: t('common.saved'),
        description: t('options.apiKeys.savedSuccess'),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle auto-summarize toggle
  const handleAutoSummarizeChange = async (enabled: boolean) => {
    setAutoSummarize(enabled)
    try {
      await sendMessage({ type: 'SET_SETTINGS', settings: { autoSummarize: enabled } })
      toast({
        variant: 'success',
        title: enabled
          ? t('options.ai.autoSummarize.enabled')
          : t('options.ai.autoSummarize.disabled'),
        description: enabled
          ? t('options.ai.autoSummarize.enabledDescription')
          : t('options.ai.autoSummarize.disabledDescription'),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
        title: enabled
          ? t('options.behavior.closeTab.enabled')
          : t('options.behavior.closeTab.disabled'),
        description: enabled
          ? t('options.behavior.closeTab.enabledDescription')
          : t('options.behavior.closeTab.disabledDescription'),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
        title: enabled
          ? t('options.behavior.tabGroups.enabled')
          : t('options.behavior.tabGroups.disabled'),
        description: enabled
          ? t('options.behavior.tabGroups.enabledDescription')
          : t('options.behavior.tabGroups.disabledDescription'),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
          title: t('options.projects.created'),
          description: t('options.projects.createdDescription', { name: response.project.name }),
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
        title: t('options.projects.deleted'),
        description: t('options.projects.deletedDescription', { name: project.name }),
      })
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('options.toast.errorSaving'),
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
                {t('options.account.title')}
              </CardTitle>
              <CardDescription>
                {user ? t('options.account.loggedIn') : t('options.account.loggedOut')}
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
                        {t('options.account.dataSynced')}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleSignOut} className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('options.account.signOut')}
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
                    <p className="font-medium">{t('options.otp.checkEmail')}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('options.otp.codeSent')} <strong>{email}</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp">{t('options.otp.verificationCode')}</Label>
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
                        {t('common.verifying')}
                      </>
                    ) : (
                      t('options.otp.verifyCode')
                    )}
                  </Button>

                  <div className="flex justify-center gap-4">
                    <Button variant="ghost" size="sm" onClick={handleSendOtp} disabled={isSigningIn}>
                      {t('options.otp.resendCode')}
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
                      {t('options.otp.useOtherEmail')}
                    </Button>
                  </div>
                </div>
              ) : (
                // Login form
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('options.email.label')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('options.email.placeholder')}
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
                        {t('common.sending')}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        {t('options.email.sendCode')}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('options.email.receiveCode')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* UI Language Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                {t('options.ai.language.label').replace(' dos resumos', '')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={currentLanguage} onValueChange={handleUILanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {localeFlags[locale]} {localeLabels[locale]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {t('options.apiKeys.title')}
                </div>
                {showAdvancedKeys ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CardTitle>
              {!showAdvancedKeys && (
                <CardDescription>{t('options.apiKeys.description')}</CardDescription>
              )}
            </CardHeader>
            {showAdvancedKeys && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground border-l-2 border-amber-500 pl-3">
                  {user ? t('options.apiKeys.loggedInNote') : t('options.apiKeys.loggedOutNote')}
                </p>

                {/* ElevenLabs Key */}
                <div className="space-y-2">
                  <Label htmlFor="elevenlabs">{t('options.apiKeys.elevenlabs.label')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="elevenlabs"
                      type="password"
                      placeholder="sk_..."
                      value={elevenlabsKey}
                      onChange={(e) => setElevenlabsKey(e.target.value)}
                    />
                    <Button variant="outline" size="icon" asChild>
                      <a
                        href="https://elevenlabs.io/app/settings/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('options.apiKeys.elevenlabs.getKey')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('options.apiKeys.elevenlabs.description')}
                  </p>
                </div>

                {/* OpenAI Key */}
                <div className="space-y-2">
                  <Label htmlFor="openai">{t('options.apiKeys.openai.label')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openai"
                      type="password"
                      placeholder="sk-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                    <Button variant="outline" size="icon" asChild>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('options.apiKeys.openai.getKey')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('options.apiKeys.openai.description')}
                  </p>
                </div>

                <Button onClick={handleSaveKeys} disabled={isSaving}>
                  {isSaving ? t('common.saving') : t('options.apiKeys.saveButton')}
                </Button>
              </CardContent>
            )}
          </Card>

          {/* AI Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t('options.ai.title')}
              </CardTitle>
              <CardDescription>{t('options.ai.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Auto-summarize toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-summarize">{t('options.ai.autoSummarize.label')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('options.ai.autoSummarize.description')}
                  </p>
                </div>
                <Switch
                  id="auto-summarize"
                  checked={autoSummarize}
                  onCheckedChange={handleAutoSummarizeChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Behavior Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TabletSmartphone className="h-5 w-5" />
                {t('options.behavior.title')}
              </CardTitle>
              <CardDescription>{t('options.behavior.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Close tab on save toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="close-tab">{t('options.behavior.closeTab.label')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('options.behavior.closeTab.description')}
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
                  <Label htmlFor="tab-groups">{t('options.behavior.tabGroups.label')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('options.behavior.tabGroups.description')}
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
                {t('options.projects.title')}
              </CardTitle>
              <CardDescription>{t('options.projects.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New project form */}
              <div className="flex gap-2">
                <Input
                  placeholder={t('options.projects.newProject')}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Projects list */}
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('options.projects.noProjects')}
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
