import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendMessage } from '@/shared/messaging'
import type { Project } from '@/shared/types'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

// Preset colors for new projects
const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
]

interface ProjectFilterProps {
  projects: Project[]
  selectedProject: string
  onProjectChange: (projectId: string) => void
  onProjectsUpdated: () => void
}

export function ProjectFilter({
  projects,
  selectedProject,
  onProjectChange,
  onProjectsUpdated,
}: ProjectFilterProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')

  // Create new project
  const handleCreate = async () => {
    if (!newName.trim()) return

    // Pick a random color that's not already used
    const usedColors = projects.map(p => p.color)
    const availableColors = PROJECT_COLORS.filter(c => !usedColors.includes(c))
    const color = availableColors.length > 0
      ? availableColors[Math.floor(Math.random() * availableColors.length)]
      : PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]

    await sendMessage({ type: 'CREATE_PROJECT', name: newName.trim(), color })
    setNewName('')
    setIsCreating(false)
    onProjectsUpdated()
  }

  // Start editing project
  const startEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(project.id)
    setEditName(project.name)
  }

  // Save edited project
  const handleSaveEdit = async (project: Project) => {
    if (!editName.trim()) return

    await sendMessage({
      type: 'UPDATE_PROJECT',
      id: project.id,
      name: editName.trim(),
      color: project.color || undefined,
    })
    setEditingId(null)
    onProjectsUpdated()
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  // Delete project
  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Tem certeza que deseja excluir este projeto? Os itens não serão excluídos.')) {
      await sendMessage({ type: 'DELETE_PROJECT', id: projectId })
      if (selectedProject === projectId) {
        onProjectChange('')
      }
      onProjectsUpdated()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Projetos
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCreating(true)}
          title="Novo projeto"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {/* All projects option */}
        <button
          onClick={() => onProjectChange('')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
            selectedProject === ''
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          )}
        >
          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
          <span>Todos</span>
        </button>

        {/* Create new project input */}
        {isCreating && (
          <div className="flex items-center gap-1 px-2 py-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do projeto"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCreate}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsCreating(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Project list */}
        {projects.map((project) => (
          <div
            key={project.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer',
              selectedProject === project.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
            onClick={() => editingId !== project.id && onProjectChange(project.id)}
          >
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || '#6B7280' }}
            />

            {editingId === project.id ? (
              // Edit mode
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(project)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleSaveEdit(project) }}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              // View mode
              <>
                <span className="truncate flex-1">{project.name}</span>
                <div className={cn(
                  'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                  selectedProject === project.id ? 'opacity-100' : ''
                )}>
                  <button
                    onClick={(e) => startEdit(project, e)}
                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
