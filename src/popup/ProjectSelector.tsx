import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '@/shared/types'
import { FolderOpen } from 'lucide-react'

// Special value for "no project" since Radix Select doesn't allow empty string
export const NO_PROJECT_VALUE = '__none__'

interface ProjectSelectorProps {
  projects: Project[]
  selectedProject: string
  onProjectChange: (projectId: string) => void
}

/**
 * ProjectSelector - Dropdown to select which project to associate with an item
 * Features colored dots for visual project identification
 */
export function ProjectSelector({
  projects,
  selectedProject,
  onProjectChange,
}: ProjectSelectorProps) {
  // Convert empty string to special value for Select
  const selectValue = selectedProject || NO_PROJECT_VALUE

  // Convert special value back to empty string for parent
  const handleChange = (value: string) => {
    onProjectChange(value === NO_PROJECT_VALUE ? '' : value)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <FolderOpen className="h-3 w-3" />
        Projeto
      </label>
      <Select value={selectValue} onValueChange={handleChange}>
        <SelectTrigger className="rounded-xl bg-secondary/50 border-0 focus:ring-1 focus:ring-primary/30 h-10">
          <SelectValue placeholder="Selecione um projeto" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value={NO_PROJECT_VALUE} className="rounded-lg">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="text-muted-foreground">Sem projeto</span>
            </div>
          </SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id} className="rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: project.color || '#6B7280' }}
                />
                <span>{project.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
