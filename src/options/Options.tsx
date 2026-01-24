import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage } from '@/shared/messaging'
import type { Project } from '@/shared/types'
import { Brain, Key, FolderOpen, Plus, Trash2, ExternalLink } from 'lucide-react'

export function Options() {
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
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
