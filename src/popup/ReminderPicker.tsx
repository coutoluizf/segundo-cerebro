/**
 * ReminderPicker component
 * Collapsible picker for selecting reminder time
 *
 * States:
 * - Closed: Shows "Add reminder" button
 * - Expanded: Shows preset options and custom date picker
 * - Selected: Shows selected date with cancel button
 */

import { useState } from 'react'
import { Clock, ChevronDown, ChevronUp, X, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getReminderPresets, formatReminderTime } from '@/shared/reminders'

interface ReminderPickerProps {
  value: number | null // Unix timestamp (ms) or null
  onChange: (value: number | null) => void
  disabled?: boolean
}

export function ReminderPicker({ value, onChange, disabled }: ReminderPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  // Get preset options
  const presets = getReminderPresets()

  // Handle preset selection
  const handlePresetSelect = (timestamp: number) => {
    onChange(timestamp)
    setIsExpanded(false)
    setShowCustomPicker(false)
  }

  // Handle custom date/time selection
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value
    if (dateValue) {
      const timestamp = new Date(dateValue).getTime()
      onChange(timestamp)
      setIsExpanded(false)
      setShowCustomPicker(false)
    }
  }

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setIsExpanded(false)
    setShowCustomPicker(false)
  }

  // Toggle expansion
  const toggleExpanded = () => {
    if (!disabled) {
      setIsExpanded(!isExpanded)
      setShowCustomPicker(false)
    }
  }

  // Get minimum datetime (now + 5 minutes)
  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5)
    return now.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM
  }

  // If a value is selected, show the selected state
  if (value) {
    return (
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-xl',
          'bg-primary/10 border border-primary/20',
          'text-sm text-primary hover:bg-primary/15 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{formatReminderTime(value)}</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
          aria-label="Remover lembrete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* Main button */}
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-xl',
          'bg-secondary/50 border border-transparent',
          'text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors',
          isExpanded && 'bg-secondary/80 text-foreground',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>Adicionar lembrete</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expanded options */}
      {isExpanded && (
        <div className="rounded-xl border border-border/50 bg-background/80 backdrop-blur overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Preset options */}
          <div className="p-2 space-y-1">
            {presets.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                  'text-sm text-left hover:bg-secondary/80 transition-colors'
                )}
              >
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                <span>{preset.label}</span>
              </button>
            ))}

            {/* Custom date option */}
            <button
              type="button"
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                'text-sm text-left hover:bg-secondary/80 transition-colors',
                showCustomPicker && 'bg-secondary/60'
              )}
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Escolher data...</span>
            </button>
          </div>

          {/* Custom date picker */}
          {showCustomPicker && (
            <div className="px-3 pb-3 pt-1 border-t border-border/50">
              <input
                type="datetime-local"
                min={getMinDateTime()}
                onChange={handleCustomDateChange}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-secondary/50 border border-border/50',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30'
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
