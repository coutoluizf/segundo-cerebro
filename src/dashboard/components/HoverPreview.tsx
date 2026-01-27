/**
 * HoverPreview - Expanded preview on hover using Radix Tooltip
 * Shows large thumbnail, full title, complete transcription, and AI summary
 * Delay of 1.5s before appearing to prevent accidental triggers while navigating
 */

import * as Tooltip from '@radix-ui/react-tooltip'
import { Globe, FileText, Sparkles, Quote, ExternalLink } from 'lucide-react'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { isNoteUrl } from '@/shared/types'
import { FaviconFallbackLarge } from './FaviconFallback'

interface HoverPreviewProps {
  item: VoiceItem | SearchResult
  project?: Project
  children: React.ReactNode
  disabled?: boolean
}

// Delay before showing preview (in ms)
// 1.5 seconds to prevent accidental triggers when navigating
const HOVER_DELAY = 1500

/**
 * HoverPreview - Wrapper component that shows an expanded preview on hover
 */
export function HoverPreview({
  item,
  project,
  children,
  disabled = false,
}: HoverPreviewProps) {
  // Skip hover preview if disabled
  if (disabled) {
    return <>{children}</>
  }

  const isNote = item.type === 'note' || isNoteUrl(item.url)

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <Tooltip.Provider delayDuration={HOVER_DELAY}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            className="z-[2000] w-80 rounded-2xl bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2"
            sideOffset={8}
            side="right"
            align="start"
            collisionPadding={16}
          >
            {/* Thumbnail */}
            <div className="relative rounded-t-2xl overflow-hidden">
              {item.thumbnail ? (
                <div className="relative w-full aspect-[16/9]">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                </div>
              ) : (
                <FaviconFallbackLarge
                  favicon={item.favicon}
                  projectColor={project?.color}
                  url={item.url}
                  isNote={isNote}
                  className="rounded-t-2xl"
                />
              )}

              {/* Header overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                {/* Domain/Type indicator */}
                <div className="flex items-center gap-2 mb-2">
                  {isNote ? (
                    <>
                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-500/80 font-medium">
                        {item.source || 'Nota'}
                      </span>
                    </>
                  ) : (
                    <>
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
                      <span className="text-xs text-muted-foreground">
                        {getDomain(item.url)}
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                {!isNote && (
                  <h3 className="font-semibold text-base leading-tight line-clamp-2">
                    {item.title || 'Sem título'}
                  </h3>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Transcription */}
              <div className="relative">
                <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary/0 rounded-full" />
                <div className="pl-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Quote className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Sua nota de voz
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {item.transcription}
                  </p>
                </div>
              </div>

              {/* AI Summary */}
              {item.aiSummary && (
                <div className="px-3 py-2.5 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3 w-3 text-primary/70" />
                    <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wider">
                      Resumo AI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.aiSummary}
                  </p>
                </div>
              )}

              {/* Project badge */}
              {project && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: project.color || '#6B7280' }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {project.name}
                  </span>
                </div>
              )}

              {/* Open link hint for tabs */}
              {!isNote && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                  <ExternalLink className="h-3 w-3" />
                  <span>Clique para ver detalhes</span>
                </div>
              )}
            </div>

            {/* Arrow */}
            <Tooltip.Arrow className="fill-background" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
