/**
 * TrashView - Shows deleted items with restore/permanent delete options
 * Allows users to recover accidentally deleted items or permanently remove them
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { sendMessage } from '@/shared/messaging'
import type { VoiceItem, Project } from '@/shared/types'
import { isNoteUrl } from '@/shared/types'
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Globe,
  Calendar,
  Loader2,
} from 'lucide-react'
// cn utility available if needed for conditional classes

interface TrashViewProps {
  projects: Project[]
  onItemRestored: () => void // Callback when an item is restored
  onClose: () => void // Close trash view
}

/**
 * TrashView - Grid display of deleted items with restore functionality
 */
export function TrashView({ projects, onItemRestored, onClose }: TrashViewProps) {
  const [deletedItems, setDeletedItems] = useState<VoiceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load deleted items
  useEffect(() => {
    loadDeletedItems()
  }, [])

  const loadDeletedItems = async () => {
    setIsLoading(true)
    try {
      const response = await sendMessage({ type: 'GET_DELETED_ITEMS' })
      setDeletedItems(response.items)
    } catch (error) {
      console.error('Error loading deleted items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Restore an item
  const handleRestore = async (id: string) => {
    setRestoringId(id)
    try {
      const response = await sendMessage({ type: 'RESTORE_ITEM', id })
      if (response.success) {
        // Remove from local list
        setDeletedItems(prev => prev.filter(item => item.id !== id))
        onItemRestored()
      }
    } catch (error) {
      console.error('Error restoring item:', error)
    } finally {
      setRestoringId(null)
    }
  }

  // Permanently delete an item
  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return

    setDeletingId(id)
    try {
      const response = await sendMessage({ type: 'PERMANENT_DELETE_ITEM', id })
      if (response.success) {
        setDeletedItems(prev => prev.filter(item => item.id !== id))
      }
    } catch (error) {
      console.error('Error permanently deleting item:', error)
    } finally {
      setDeletingId(null)
    }
  }

  // Empty all trash
  const handleEmptyTrash = async () => {
    if (!window.confirm(`Excluir permanentemente ${deletedItems.length} itens? Esta ação não pode ser desfeita.`)) return

    setIsLoading(true)
    try {
      const response = await sendMessage({ type: 'EMPTY_TRASH' })
      if (response.success) {
        setDeletedItems([])
      }
    } catch (error) {
      console.error('Error emptying trash:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get project by ID
  const getProject = (projectId: string | null): Project | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)
  }

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando lixeira...</p>
      </div>
    )
  }

  // Empty trash state
  if (deletedItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Trash2 className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium">Lixeira vazia</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Itens excluídos aparecerão aqui
        </p>
        <Button variant="outline" onClick={onClose} className="mt-6 rounded-xl">
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-destructive/10">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Lixeira</h2>
            <p className="text-sm text-muted-foreground">
              {deletedItems.length} {deletedItems.length === 1 ? 'item' : 'itens'} na lixeira
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleEmptyTrash}
            className="rounded-xl"
            disabled={isLoading}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Esvaziar Lixeira
          </Button>
        </div>
      </div>

      {/* Deleted items list */}
      <div className="flex flex-col gap-3">
        {deletedItems.map((item) => {
          const project = getProject(item.projectId)
          const isNote = item.type === 'note' || isNoteUrl(item.url)
          const isRestoring = restoringId === item.id
          const isDeleting = deletingId === item.id

          return (
            <div
              key={item.id}
              className="card-luminous rounded-xl p-4 opacity-75 hover:opacity-100 transition-opacity"
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail or icon */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : isNote ? (
                    <FileText className="h-6 w-6 text-amber-500/50" />
                  ) : (
                    <Globe className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    {isNote ? (
                      <span className="text-xs text-amber-500/70 font-medium">Nota</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {getDomain(item.url)}
                      </span>
                    )}
                    {project && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <div
                          className="h-2 w-2 rounded-full opacity-50"
                          style={{ backgroundColor: project.color || '#6B7280' }}
                        />
                        <span className="text-xs text-muted-foreground/70">
                          {project.name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-medium text-sm line-clamp-1 mb-1">
                    {item.title || item.transcription?.substring(0, 50) || 'Sem título'}
                  </h3>

                  {/* Transcription preview */}
                  {item.transcription && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.transcription}
                    </p>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/60">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.createdAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Restore button */}
                  <Button
                    size="sm"
                    onClick={() => handleRestore(item.id)}
                    disabled={isRestoring || isDeleting}
                    className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isRestoring ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restaurar
                      </>
                    )}
                  </Button>

                  {/* Permanent delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePermanentDelete(item.id)}
                    disabled={isRestoring || isDeleting}
                    className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Excluir permanentemente"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
