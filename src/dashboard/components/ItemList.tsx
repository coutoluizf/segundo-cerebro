import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { isNoteUrl } from '@/shared/types'
import { ExternalLink, Trash2, Quote, Calendar, ChevronDown, FolderOpen, FileText, Globe, Sparkles, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatReminderTime } from '@/shared/reminders'
import { FaviconFallbackLarge } from './FaviconFallback'
import { HoverPreview } from './HoverPreview'

interface ItemListProps {
  items: (VoiceItem | SearchResult)[]
  projects: Project[]
  columns?: 1 | 2 | 3 // Number of columns in grid view
  onDelete: (id: string) => void
  onOpen: (url: string, projectId?: string | null) => void
  onUpdateProject: (itemId: string, projectId: string | null) => void
  onItemClick?: (item: VoiceItem | SearchResult) => void // Click to expand item
}

// Type guard to check if item has similarity score
function isSearchResult(item: VoiceItem | SearchResult): item is SearchResult {
  return 'similarity' in item && typeof item.similarity === 'number'
}

/**
 * ItemList - Grid display of saved items with luminous card design
 * Features similarity badges, project selectors, and action buttons
 * Click on card to expand in drawer
 */
export function ItemList({ items, projects, columns = 1, onDelete, onOpen, onUpdateProject, onItemClick }: ItemListProps) {
  // Get project by ID
  const getProject = (projectId: string | null): Project | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)
  }

  // Format date in relative or absolute format
  const formatDate = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Hoje'
    if (days === 1) return 'Ontem'
    if (days < 7) return `${days} dias atrás`

    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
    })
  }

  // Format similarity score with visual indicator
  const formatSimilarity = (similarity: number): string => {
    return Math.round(similarity * 100) + '%'
  }

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  // Grid classes based on columns
  const gridClass =
    columns === 1
      ? 'flex flex-col gap-4'
      : columns === 2
        ? 'grid grid-cols-2 gap-4'
        : 'grid grid-cols-3 gap-4'

  return (
    <div className={gridClass}>
      {items.map((item, index) => {
        const project = getProject(item.projectId)
        const hasSimilarity = isSearchResult(item)
        const isNote = item.type === 'note' || isNoteUrl(item.url)

        return (
          <div
            key={item.id}
            className={cn(
              "card-luminous rounded-2xl overflow-hidden hover-glow animate-fade-in-up",
              onItemClick && "cursor-pointer"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => onItemClick?.(item)}
            role={onItemClick ? "button" : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onItemClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onItemClick(item)
              }
            }}
          >
            {/* Thumbnail section */}
            <div className="relative">
              {item.thumbnail ? (
                // Show actual thumbnail
                <div className="relative w-full aspect-[16/9] overflow-hidden">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Gradient overlay for better text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                </div>
              ) : (
                // Fallback with favicon/icon
                <FaviconFallbackLarge
                  favicon={item.favicon}
                  projectColor={project?.color}
                  url={item.url}
                  isNote={isNote}
                />
              )}

              {/* Similarity badge positioned on thumbnail */}
              {hasSimilarity && item.similarity > 0 && (
                <div className="absolute top-2 right-2 similarity-badge flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {formatSimilarity(item.similarity)}
                </div>
              )}
            </div>

            {/* Card content */}
            <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                {isNote ? (
                  // Note header with amber badge
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="note-badge">
                      <FileText className="h-3 w-3" />
                      Nota
                    </span>
                    {item.source && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {item.source}
                      </span>
                    )}
                  </div>
                ) : (
                  // Tab header with favicon and title
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      {item.favicon ? (
                        <img
                          src={item.favicon}
                          alt=""
                          className="h-4 w-4 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground truncate">
                        {item.url ? getDomain(item.url) : ''}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm leading-snug line-clamp-2">
                      {item.title || 'Sem título'}
                    </h3>
                  </>
                )}
              </div>

            </div>

            {/* Transcription - Quote style */}
            <div className="relative mb-3">
              <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary/0 rounded-full" />
              <div className="pl-3">
                <Quote className="h-3 w-3 text-muted-foreground/40 mb-1" />
                <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">
                  {item.transcription}
                </p>
              </div>
            </div>

            {/* AI Summary - Hover over to see full preview */}
            {item.aiSummary && (
              <HoverPreview item={item} project={project}>
                <div
                  className="mb-4 px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 cursor-pointer hover:bg-primary/10 hover:border-primary/20 transition-colors"
                  onClick={(e) => e.stopPropagation()} // Don't trigger card click
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3 w-3 text-primary/60" />
                    <span className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">
                      Resumo AI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {item.aiSummary}
                  </p>
                </div>
              </HoverPreview>
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between pt-3 border-t border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left side - Project + Date */}
              <div className="flex items-center gap-3">
                {/* Project selector dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary/70 transition-colors text-xs">
                      {project ? (
                        <>
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: project.color || '#6B7280' }}
                          />
                          <span className="text-muted-foreground max-w-[80px] truncate">{project.name}</span>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-muted-foreground/60">Projeto</span>
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 rounded-xl">
                    {/* Option to remove from project */}
                    <DropdownMenuItem
                      onClick={() => onUpdateProject(item.id, null)}
                      className="flex items-center gap-2 rounded-lg"
                    >
                      <FolderOpen className="h-3 w-3" />
                      <span>Sem projeto</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* List of projects */}
                    {projects.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => onUpdateProject(item.id, p.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg",
                          p.id === item.projectId && "bg-primary/10"
                        )}
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color || '#6B7280' }}
                        />
                        <span>{p.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Date */}
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(item.createdAt)}
                </span>

                {/* Reminder badge */}
                {item.reminderAt && (
                  <span className="text-xs text-primary/80 flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-md">
                    <Clock className="h-3 w-3" />
                    {formatReminderTime(item.reminderAt)}
                  </span>
                )}
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-1">
                {/* Open button for tabs only - primary action with solid orange background */}
                {!isNote && (
                  <Button
                    size="sm"
                    onClick={() => onOpen(item.url, item.projectId)}
                    className="h-8 px-3 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Abrir
                  </Button>
                )}
                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item.id)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
