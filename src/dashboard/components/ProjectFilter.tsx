import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendMessage } from '@/shared/messaging'
import type { Project, VoiceItem } from '@/shared/types'
import { Plus, Pencil, Trash2, Check, X, Layers } from 'lucide-react'

// Preset colors for new projects - More vibrant, modern palette
const PROJECT_COLORS = [
  '#F97316', // orange (primary)
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
]

interface ProjectFilterProps {
  projects: Project[]
  items: VoiceItem[] // All items to count per project
  selectedProject: string
  onProjectChange: (projectId: string) => void
  onProjectsUpdated: () => void
}

export function ProjectFilter({
  projects,
  items,
  selectedProject,
  onProjectChange,
  onProjectsUpdated,
}: ProjectFilterProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')

  // Count items per project
  const getItemCount = (projectId: string | null): number => {
    if (projectId === null) {
      // Count all items
      return items.length
    }
    return items.filter(item => item.projectId === projectId).length
  }

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
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Projetos
          </h2>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
          title="Novo projeto"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        {/* All projects option */}
        <button
          onClick={() => onProjectChange('')}
          className={cn(
            'sidebar-item w-full',
            selectedProject === '' && 'sidebar-item-active'
          )}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-primary to-amber-500" />
          <span className="flex-1 text-left">Todos os itens</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {getItemCount(null)}
          </span>
        </button>

        {/* Create new project input */}
        {isCreating && (
          <div className="flex items-center gap-1 px-2 py-2 bg-secondary/50 rounded-xl">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do projeto"
              className="h-8 text-sm bg-transparent border-0 focus-visible:ring-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg text-primary hover:text-primary"
              onClick={handleCreate}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg"
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
              'group sidebar-item relative',
              selectedProject === project.id && 'sidebar-item-active'
            )}
            onClick={() => editingId !== project.id && onProjectChange(project.id)}
          >
            {/* Project color dot with glow */}
            <div
              className="project-dot shrink-0"
              style={{
                backgroundColor: project.color || '#6B7280',
                color: project.color || '#6B7280'
              }}
            />

            {editingId === project.id ? (
              // Edit mode
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm bg-transparent border-0 focus-visible:ring-1"
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
                  className="h-6 w-6 shrink-0 rounded-lg"
                  onClick={(e) => { e.stopPropagation(); handleSaveEdit(project) }}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-lg"
                  onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              // View mode
              <>
                <span className="truncate flex-1 text-sm">{project.name}</span>
                {/* Item count - hidden when hovering to show actions */}
                <span className={cn(
                  'text-xs text-muted-foreground tabular-nums transition-opacity',
                  'group-hover:opacity-0',
                  selectedProject === project.id && 'group-hover:opacity-0'
                )}>
                  {getItemCount(project.id)}
                </span>
                {/* Action buttons - shown on hover */}
                <div className={cn(
                  'flex items-center gap-0.5 absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity',
                  selectedProject === project.id ? 'opacity-100' : ''
                )}>
                  <button
                    onClick={(e) => startEdit(project, e)}
                    className="p-1 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
