/**
 * ProjectGrid - Grid view of projects with thumbnail previews
 * Shows project cards with 2x2 thumbnail grid, name, color, and item count
 * Clicking a project card filters the view to that project
 */

import { Folder, FolderOpen, ChevronRight } from 'lucide-react'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { cn } from '@/lib/utils'
import { FaviconFallback } from './FaviconFallback'

interface ProjectGridProps {
  projects: Project[]
  items: (VoiceItem | SearchResult)[]
  onProjectClick: (projectId: string) => void
  className?: string
}

/**
 * ProjectGrid - Displays projects as visual cards with thumbnail previews
 */
export function ProjectGrid({
  projects,
  items,
  onProjectClick,
  className,
}: ProjectGridProps) {
  // Get items for a specific project
  const getProjectItems = (projectId: string) => {
    return items.filter((item) => item.projectId === projectId)
  }

  // Get items without a project
  const getUnassignedItems = () => {
    return items.filter((item) => !item.projectId)
  }

  // Sort projects by item count (descending)
  const sortedProjects = [...projects].sort((a, b) => {
    const aCount = getProjectItems(a.id).length
    const bCount = getProjectItems(b.id).length
    return bCount - aCount
  })

  // Get unassigned items count
  const unassignedItems = getUnassignedItems()

  return (
    <div className={cn('space-y-6', className)}>
      {/* Projects header */}
      <div className="flex items-center gap-2">
        <Folder className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-medium">Projetos</h2>
        <span className="text-sm text-muted-foreground">
          ({projects.length})
        </span>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProjects.map((project) => {
          const projectItems = getProjectItems(project.id)
          const thumbnailItems = projectItems.slice(0, 4) // Get up to 4 items for thumbnail grid

          return (
            <ProjectCard
              key={project.id}
              project={project}
              items={thumbnailItems}
              totalCount={projectItems.length}
              onClick={() => onProjectClick(project.id)}
            />
          )
        })}

        {/* Unassigned items card */}
        {unassignedItems.length > 0 && (
          <ProjectCard
            project={{ id: '', name: 'Sem projeto', color: '#6B7280', createdAt: 0 }}
            items={unassignedItems.slice(0, 4)}
            totalCount={unassignedItems.length}
            onClick={() => onProjectClick('')}
            isUnassigned
          />
        )}
      </div>
    </div>
  )
}

// Individual project card component
interface ProjectCardProps {
  project: Project
  items: (VoiceItem | SearchResult)[]
  totalCount: number
  onClick: () => void
  isUnassigned?: boolean
}

function ProjectCard({
  project,
  items,
  totalCount,
  onClick,
  // isUnassigned kept for future styling differentiation
  isUnassigned: _isUnassigned = false,
}: ProjectCardProps) {
  // Empty state for projects with no items
  const isEmpty = totalCount === 0

  return (
    <div
      className={cn(
        'group card-luminous rounded-2xl overflow-hidden cursor-pointer hover-glow transition-all duration-200 hover:scale-[1.02]',
        isEmpty && 'opacity-60'
      )}
      onClick={onClick}
    >
      {/* Thumbnail grid section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
        {items.length > 0 ? (
          // 2x2 grid of thumbnails
          <div className="grid grid-cols-2 grid-rows-2 h-full">
            {[0, 1, 2, 3].map((index) => {
              const item = items[index]

              if (!item) {
                // Empty slot
                return (
                  <div
                    key={index}
                    className="bg-muted/20"
                    style={{
                      borderRight: index % 2 === 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                      borderBottom: index < 2 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                    }}
                  />
                )
              }

              return (
                <div
                  key={item.id}
                  className="relative overflow-hidden"
                  style={{
                    borderRight: index % 2 === 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                    borderBottom: index < 2 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                  }}
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                      <FaviconFallback
                        favicon={item.favicon}
                        projectColor={project.color}
                        url={item.url}
                        isNote={item.type === 'note'}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Empty project placeholder
          <div className="w-full h-full flex items-center justify-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

        {/* Color accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: project.color || '#6B7280' }}
        />
      </div>

      {/* Card content */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Project info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || '#6B7280' }}
            />
            <span className="font-medium text-sm truncate">
              {project.name}
            </span>
          </div>

          {/* Item count and arrow */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-xs">{totalCount}</span>
            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-muted-foreground mt-1">
          {isEmpty
            ? 'Nenhum item'
            : `${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`}
        </p>
      </div>
    </div>
  )
}
