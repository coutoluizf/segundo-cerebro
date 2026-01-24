import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { ExternalLink, Trash2, MessageSquare, Calendar } from 'lucide-react'

interface ItemListProps {
  items: (VoiceItem | SearchResult)[]
  projects: Project[]
  onDelete: (id: string) => void
  onOpen: (url: string) => void
}

// Type guard to check if item has similarity score
function isSearchResult(item: VoiceItem | SearchResult): item is SearchResult {
  return 'similarity' in item && typeof item.similarity === 'number'
}

export function ItemList({ items, projects, onDelete, onOpen }: ItemListProps) {
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

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const project = getProject(item.projectId)
        const hasSimlarity = isSearchResult(item)

        return (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
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
                    <span className="truncate">{getDomain(item.url)}</span>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
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
                {/* Project tag */}
                {project && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color || '#6B7280' }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {project.name}
                    </span>
                  </div>
                )}
                {!project && <div />}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpen(item.url)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Abrir
                  </Button>
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
