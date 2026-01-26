/**
 * RecentCarousel - Horizontal scrolling carousel of recent items
 * Shows last 8 items with compact cards featuring thumbnails
 */

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock, Globe, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { isNoteUrl } from '@/shared/types'
import { cn } from '@/lib/utils'
import { FaviconFallbackLarge } from './FaviconFallback'

interface RecentCarouselProps {
  items: (VoiceItem | SearchResult)[]
  projects: Project[]
  onItemClick: (item: VoiceItem | SearchResult) => void
  maxItems?: number // Default 8
  className?: string
}

/**
 * RecentCarousel - Displays recent items in a horizontal scrollable carousel
 */
export function RecentCarousel({
  items,
  projects,
  onItemClick,
  maxItems = 8,
  className,
}: RecentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get most recent items (already sorted by createdAt DESC from API)
  const recentItems = items.slice(0, maxItems)

  // Don't render if no items
  if (recentItems.length === 0) {
    return null
  }

  // Get project by ID
  const getProject = (projectId: string | null): Project | undefined => {
    if (!projectId) return undefined
    return projects.find((p) => p.id === projectId)
  }

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  // Format date in relative format
  const formatDate = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}m atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days === 1) return 'Ontem'
    if (days < 7) return `${days}d atrás`

    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
    })
  }

  // Scroll handlers
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 200 // Slightly more than card width
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div className={cn('relative group', className)}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">Recentes</h2>
      </div>

      {/* Scroll container */}
      <div className="relative">
        {/* Left scroll button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2 -mx-2 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {recentItems.map((item) => {
            const project = getProject(item.projectId)
            const isNote = item.type === 'note' || isNoteUrl(item.url)

            return (
              <div
                key={item.id}
                className="shrink-0 w-48 cursor-pointer"
                onClick={() => onItemClick(item)}
              >
                <div className="card-luminous rounded-xl overflow-hidden hover-glow transition-all duration-200 hover:scale-[1.02]">
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FaviconFallbackLarge
                        favicon={item.favicon}
                        projectColor={project?.color}
                        url={item.url}
                        isNote={isNote}
                      />
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

                    {/* Time badge */}
                    <div className="absolute bottom-2 left-2 text-[10px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {formatDate(item.createdAt)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    {/* Header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      {isNote ? (
                        <FileText className="h-3 w-3 text-amber-500/70 shrink-0" />
                      ) : item.favicon ? (
                        <img
                          src={item.favicon}
                          alt=""
                          className="h-3 w-3 rounded shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">
                        {isNote
                          ? item.source || 'Nota'
                          : getDomain(item.url)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-medium leading-snug line-clamp-2 min-h-[2.5em]">
                      {isNote
                        ? item.transcription.slice(0, 50) + (item.transcription.length > 50 ? '...' : '')
                        : item.title || 'Sem título'}
                    </h3>

                    {/* Project indicator */}
                    {project && (
                      <div className="flex items-center gap-1 mt-2">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: project.color || '#6B7280' }}
                        />
                        <span className="text-[9px] text-muted-foreground/60 truncate">
                          {project.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right scroll button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  )
}
