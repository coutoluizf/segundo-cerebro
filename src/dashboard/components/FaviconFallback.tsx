/**
 * FaviconFallback - Visual fallback when no thumbnail is available
 * Displays large favicon with colored background derived from project or domain
 */

import { Globe, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaviconFallbackProps {
  favicon: string | null
  projectColor?: string | null
  url?: string
  isNote?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg' // sm=32px, md=48px, lg=64px
}

/**
 * Generate a consistent color from a string (used for domain-based colors)
 * Returns a subtle HSL color that works well as a background
 */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Generate hue from hash, keep saturation and lightness subtle
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 25%, 85%)`
}

/**
 * Extract domain from URL for color generation
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

/**
 * Get size values based on size prop
 */
function getSizeValues(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return { container: 'h-8 w-8', icon: 'h-4 w-4', favicon: 'h-5 w-5' }
    case 'md':
      return { container: 'h-12 w-12', icon: 'h-6 w-6', favicon: 'h-7 w-7' }
    case 'lg':
      return { container: 'h-16 w-16', icon: 'h-8 w-8', favicon: 'h-10 w-10' }
  }
}

export function FaviconFallback({
  favicon,
  projectColor,
  url,
  isNote = false,
  className,
  size = 'md',
}: FaviconFallbackProps) {
  // Determine background color
  const bgColor = projectColor
    ? projectColor + '20' // Add 20% opacity to project color
    : url
      ? stringToColor(getDomain(url))
      : 'hsl(0, 0%, 90%)' // Neutral gray for notes without URL

  const sizeValues = getSizeValues(size)

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center shrink-0',
        sizeValues.container,
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      {isNote ? (
        // Note icon for notes
        <FileText
          className={cn(sizeValues.icon, 'text-amber-600/60')}
        />
      ) : favicon ? (
        // Favicon image
        <img
          src={favicon}
          alt=""
          className={cn(sizeValues.favicon, 'rounded')}
          onError={(e) => {
            // Replace with Globe icon on error
            const parent = e.currentTarget.parentElement
            if (parent) {
              e.currentTarget.style.display = 'none'
              // Icon will be shown via CSS
              parent.classList.add('favicon-error')
            }
          }}
        />
      ) : (
        // Globe icon fallback
        <Globe className={cn(sizeValues.icon, 'text-muted-foreground/50')} />
      )}
    </div>
  )
}

/**
 * FaviconFallbackLarge - Full-width fallback for card thumbnails
 * Shows large centered favicon/icon with gradient background
 */
interface FaviconFallbackLargeProps {
  favicon: string | null
  projectColor?: string | null
  url?: string
  isNote?: boolean
  className?: string
}

export function FaviconFallbackLarge({
  favicon,
  projectColor,
  url,
  isNote = false,
  className,
}: FaviconFallbackLargeProps) {
  // Determine background gradient colors
  const baseColor = projectColor
    ? projectColor
    : url
      ? stringToColor(getDomain(url))
      : 'hsl(0, 0%, 85%)'

  return (
    <div
      className={cn(
        'relative w-full aspect-[16/9] rounded-t-xl overflow-hidden flex items-center justify-center',
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${baseColor}40 0%, ${baseColor}20 100%)`,
      }}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] bg-[size:20px_20px]" />

      {/* Icon */}
      {isNote ? (
        <FileText className="h-12 w-12 text-amber-600/40 relative z-10" />
      ) : favicon ? (
        <div className="relative z-10">
          <div className="absolute inset-0 blur-xl opacity-50">
            <img src={favicon} alt="" className="h-16 w-16" />
          </div>
          <img
            src={favicon}
            alt=""
            className="h-12 w-12 rounded-lg shadow-lg relative"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      ) : (
        <Globe className="h-12 w-12 text-muted-foreground/30 relative z-10" />
      )}
    </div>
  )
}
