import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '@/shared/types'

// Special value for "no project" since Radix Select doesn't allow empty string
export const NO_PROJECT_VALUE = '__none__'

interface ProjectSelectorProps {
  projects: Project[]
  selectedProject: string
  onProjectChange: (projectId: string) => void
}

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
    <div className="space-y-1">
      <label className="text-sm font-medium">Projeto</label>
      <Select value={selectValue} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT_VALUE}>
            <span className="text-muted-foreground">Sem projeto</span>
          </SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <div className="flex items-center gap-2">
                {project.color && (
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <span>{project.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
