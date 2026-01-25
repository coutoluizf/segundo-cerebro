import { useState, useEffect } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  isSearching: boolean
}

/**
 * Semantic search bar with AI indicator
 * Features debounced search and loading state
 */
export function SearchBar({ value, onChange, isSearching }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)

  // Sync with external value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  return (
    <div className="relative group">
      {/* Glow effect on focus */}
      <div
        className={`absolute -inset-1 bg-primary/20 rounded-2xl blur-lg transition-opacity duration-300 ${
          isFocused ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Search container */}
      <div
        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-200 ${
          isFocused
            ? 'bg-secondary ring-2 ring-primary/20'
            : 'bg-secondary/50 hover:bg-secondary/70'
        }`}
      >
        {/* Icon */}
        <div className="text-muted-foreground">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>

        {/* Input */}
        <input
          type="search"
          placeholder="Buscar por significado..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-56 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
        />

        {/* AI indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">AI</span>
        </div>
      </div>
    </div>
  )
}
