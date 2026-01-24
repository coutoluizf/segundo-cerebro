import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  isSearching: boolean
}

export function SearchBar({ value, onChange, isSearching }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)

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
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </div>
      <Input
        type="search"
        placeholder="Buscar semanticamente..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-10 w-64"
      />
    </div>
  )
}
