import { cn } from '@/lib/utils'
import type { Project } from '@/shared/types'

interface ProjectFilterProps {
  projects: Project[]
  selectedProject: string
  onProjectChange: (projectId: string) => void
}

export function ProjectFilter({
  projects,
  selectedProject,
  onProjectChange,
}: ProjectFilterProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Projetos
      </h2>
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

        {/* Project list */}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onProjectChange(project.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
              selectedProject === project.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color || '#6B7280' }}
            />
            <span className="truncate">{project.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
