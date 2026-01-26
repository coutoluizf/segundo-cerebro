/**
 * ItemDetail - Expanded view of a saved item in a slide-in drawer
 * Shows full transcription, AI summary, metadata, and actions
 * Supports inline editing of title, transcription, and AI summary
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { isNoteUrl } from '@/shared/types'
import {
  ExternalLink,
  Trash2,
  Quote,
  Calendar,
  ChevronDown,
  FolderOpen,
  FileText,
  Globe,
  Sparkles,
  Clock,
  Link2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FaviconFallbackLarge } from './FaviconFallback'

interface ItemDetailProps {
  item: VoiceItem | SearchResult | null
  items: (VoiceItem | SearchResult)[] // All items for navigation
  projects: Project[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => void
  onOpen: (url: string) => void
  onUpdateProject: (itemId: string, projectId: string | null) => void
  onNavigate: (item: VoiceItem | SearchResult) => void
  onUpdate?: (itemId: string, updates: { title?: string; transcription?: string; aiSummary?: string }) => Promise<void>
}

// Type guard to check if item has similarity score
function isSearchResult(item: VoiceItem | SearchResult): item is SearchResult {
  return 'similarity' in item && typeof item.similarity === 'number'
}

/**
 * ItemDetail - Drawer component for expanded item view with inline editing
 */
export function ItemDetail({
  item,
  items,
  projects,
  open,
  onOpenChange,
  onDelete,
  onOpen,
  onUpdateProject,
  onNavigate,
  onUpdate,
}: ItemDetailProps) {
  // Editing state
  const [editingField, setEditingField] = useState<'title' | 'transcription' | 'aiSummary' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Reset editing state when item changes
  useEffect(() => {
    setEditingField(null)
    setEditValue('')
  }, [item?.id])

  if (!item) return null

  const isNote = item.type === 'note' || isNoteUrl(item.url)
  const hasSimilarity = isSearchResult(item)
  const project = projects.find((p) => p.id === item.projectId)

  // Find current index for navigation
  const currentIndex = items.findIndex((i) => i.id === item.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < items.length - 1

  // Navigate to previous/next item
  const goToPrev = () => {
    if (hasPrev) {
      onNavigate(items[currentIndex - 1])
    }
  }

  const goToNext = () => {
    if (hasNext) {
      onNavigate(items[currentIndex + 1])
    }
  }

  // Format date with time
  const formatDateTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  // Format similarity score
  const formatSimilarity = (similarity: number): string => {
    return Math.round(similarity * 100) + '%'
  }

  // Handle delete with confirmation
  const handleDelete = () => {
    onDelete(item.id)
    onOpenChange(false)
  }

  // Start editing a field
  const startEditing = (field: 'title' | 'transcription' | 'aiSummary') => {
    const currentValue = field === 'title' ? item.title || '' :
                         field === 'transcription' ? item.transcription :
                         item.aiSummary || ''
    setEditValue(currentValue)
    setEditingField(field)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }

  // Save edited field
  const saveEdit = async () => {
    if (!onUpdate || !editingField) return

    setIsSaving(true)
    try {
      await onUpdate(item.id, { [editingField]: editValue })
      setEditingField(null)
      setEditValue('')
    } catch (error) {
      console.error('Error saving edit:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle keyboard navigation (only when not editing)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingField) return // Don't navigate while editing

    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      goToPrev()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      goToNext()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Thumbnail section at top */}
        <div className="relative">
          {item.thumbnail ? (
            <div className="relative w-full aspect-[16/9]">
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            </div>
          ) : (
            <FaviconFallbackLarge
              favicon={item.favicon}
              projectColor={project?.color}
              url={item.url}
              isNote={isNote}
            />
          )}
        </div>

        <div className="p-6 pb-24">
        {/* Header */}
        <SheetHeader className="pr-10 pb-6 border-b border-border/50">
          {isNote ? (
            // Note header
            <div className="flex items-center gap-2">
              <span className="note-badge">
                <FileText className="h-3 w-3" />
                Nota
              </span>
              {item.source && (
                <span className="text-sm text-muted-foreground">
                  {item.source}
                </span>
              )}
            </div>
          ) : (
            // Tab header
            <>
              <div className="flex items-center gap-2 mb-2">
                {item.favicon ? (
                  <img
                    src={item.favicon}
                    alt=""
                    className="h-5 w-5 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <Globe className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {getDomain(item.url)}
                </span>
              </div>
              {/* Editable title */}
              {editingField === 'title' ? (
                <div className="space-y-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-xl font-semibold rounded-xl"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={isSaving}
                      className="rounded-lg"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="rounded-lg"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <SheetTitle className="text-xl leading-tight flex-1">
                    {item.title || 'Sem título'}
                  </SheetTitle>
                  {onUpdate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                      onClick={() => startEditing('title')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Similarity badge for search results */}
          {hasSimilarity && item.similarity > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="similarity-badge flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {formatSimilarity(item.similarity)} relevante
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <div className="py-6 space-y-6">
          {/* Transcription - Editable */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Quote className="h-4 w-4" />
                Sua nota de voz
              </div>
              {onUpdate && editingField !== 'transcription' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg opacity-60 hover:opacity-100"
                  onClick={() => startEditing('transcription')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {editingField === 'transcription' ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-h-[100px] resize-none rounded-xl"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={isSaving} className="rounded-lg">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving} className="rounded-lg">
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary/0 rounded-full" />
                <p className="pl-4 text-foreground/90 leading-relaxed">
                  {item.transcription || <span className="text-muted-foreground/50 italic">Sem conteúdo</span>}
                </p>
              </div>
            )}
          </div>

          {/* AI Summary - Editable */}
          {(item.aiSummary || editingField === 'aiSummary') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-primary/70">
                  <Sparkles className="h-4 w-4" />
                  Resumo AI
                </div>
                {onUpdate && editingField !== 'aiSummary' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg opacity-60 hover:opacity-100"
                    onClick={() => startEditing('aiSummary')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {editingField === 'aiSummary' ? (
                <div className="space-y-2">
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-h-[100px] resize-none rounded-xl"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={isSaving} className="rounded-lg">
                      {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving} className="rounded-lg">
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.aiSummary || <span className="text-muted-foreground/50 italic">Sem resumo</span>}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            {/* URL */}
            {!isNote && (
              <div className="flex items-center gap-3 text-sm">
                <Link2 className="h-4 w-4 text-muted-foreground/60" />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary truncate transition-colors"
                >
                  {item.url}
                </a>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-muted-foreground">
                {formatDateTime(item.createdAt)}
              </span>
            </div>

            {/* Project selector */}
            <div className="flex items-center gap-3 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground/60" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/70 transition-colors">
                    {project ? (
                      <>
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: project.color || '#6B7280' }}
                        />
                        <span className="text-muted-foreground">{project.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/60">Sem projeto</span>
                    )}
                    <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => onUpdateProject(item.id, null)}
                    className="flex items-center gap-2 rounded-lg"
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>Sem projeto</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => onUpdateProject(item.id, p.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg',
                        p.id === item.projectId && 'bg-primary/10'
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
            </div>

            {/* Context tabs count */}
            {!isNote && item.contextTabCount > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-muted-foreground">
                  {item.contextTabCount} abas abertas no momento
                </span>
              </div>
            )}
          </div>
        </div>

        </div>

        {/* Footer - Actions */}
        <div className="fixed bottom-0 right-0 w-full sm:max-w-lg p-4 border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrev}
                disabled={!hasPrev}
                className="h-9 w-9 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {currentIndex + 1} / {items.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                disabled={!hasNext}
                className="h-9 w-9 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!isNote && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpen(item.url)}
                  className="rounded-lg"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
