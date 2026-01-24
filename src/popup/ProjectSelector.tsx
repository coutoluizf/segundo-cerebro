import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '@/shared/types'

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
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Projeto</label>
      <Select value={selectedProject} onValueChange={onProjectChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
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
