import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { ExternalLink, Trash2, MessageSquare, Calendar, ChevronDown, FolderOpen, FileText } from 'lucide-react'

interface ItemListProps {
  items: (VoiceItem | SearchResult)[]
  projects: Project[]
  columns?: 1 | 2 | 3 // Number of columns in grid view
  onDelete: (id: string) => void
  onOpen: (url: string) => void
  onUpdateProject: (itemId: string, projectId: string | null) => void
}

// Type guard to check if item has similarity score
function isSearchResult(item: VoiceItem | SearchResult): item is SearchResult {
  return 'similarity' in item && typeof item.similarity === 'number'
}

export function ItemList({ items, projects, columns = 1, onDelete, onOpen, onUpdateProject }: ItemListProps) {
  // Get project by ID
  const getProject = (projectId: string | null): Project | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)
  }

  // Format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Format similarity score
  const formatSimilarity = (similarity: number): string => {
    return Math.round(similarity * 100) + '%'
  }

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname
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
      {items.map((item) => {
        const project = getProject(item.projectId)
        const hasSimlarity = isSearchResult(item)
        const isNote = item.type === 'note' || !item.url

        return (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  {isNote ? (
                    // Note header
                    <>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium rounded">
                          <FileText className="h-3 w-3" />
                          Nota
                        </span>
                        {item.source && (
                          <span className="text-xs text-muted-foreground truncate">
                            {item.source}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </>
                  ) : (
                    // Tab header
                    <>
                      <h3 className="font-medium truncate">
                        {item.title || 'Sem título'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {item.favicon && (
                          <img
                            src={item.favicon}
                            alt=""
                            className="h-3 w-3"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        )}
                        <span className="truncate">{item.url ? getDomain(item.url) : ''}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Similarity badge */}
                {hasSimlarity && item.similarity > 0 && (
                  <div className="shrink-0 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                    {formatSimilarity(item.similarity)}
                  </div>
                )}
              </div>

              {/* Transcription */}
              <div className="flex items-start gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/80 line-clamp-3">
                  {item.transcription}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                {/* Project selector dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent transition-colors text-xs">
                      {project ? (
                        <>
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: project.color || '#6B7280' }}
                          />
                          <span className="text-muted-foreground">{project.name}</span>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Sem projeto</span>
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {/* Option to remove from project */}
                    <DropdownMenuItem
                      onClick={() => onUpdateProject(item.id, null)}
                      className="flex items-center gap-2"
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
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.color || '#6B7280' }}
                        />
                        <span>{p.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Only show "Abrir" button for items with URL */}
                  {item.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpen(item.url!)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
