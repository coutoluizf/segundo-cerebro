/**
 * Reminder scheduling module using chrome.alarms API
 * Manages scheduling, canceling, and recreating alarms for item reminders
 */

// Alarm name prefix for reminders
export const REMINDER_ALARM_PREFIX = 'reminder-'

/**
 * Schedule a reminder alarm for an item
 * @param itemId The ID of the item to remind about
 * @param reminderAt Unix timestamp (ms) for when to trigger the reminder
 */
export async function scheduleReminder(itemId: string, reminderAt: number): Promise<void> {
  const alarmName = `${REMINDER_ALARM_PREFIX}${itemId}`

  // Calculate delay in minutes (chrome.alarms uses minutes)
  const delayMs = reminderAt - Date.now()

  if (delayMs <= 0) {
    // Reminder time has already passed, trigger immediately
    console.log(`[Reminders] Reminder for ${itemId} is in the past, will trigger on next alarm check`)
    // Set alarm for 1 second from now (minimum practical delay)
    await chrome.alarms.create(alarmName, { when: Date.now() + 1000 })
  } else {
    // Schedule the alarm at the specified time
    await chrome.alarms.create(alarmName, { when: reminderAt })
    console.log(`[Reminders] Scheduled reminder for ${itemId} at ${new Date(reminderAt).toISOString()}`)
  }
}

/**
 * Cancel a scheduled reminder for an item
 * @param itemId The ID of the item whose reminder to cancel
 */
export async function cancelReminder(itemId: string): Promise<void> {
  const alarmName = `${REMINDER_ALARM_PREFIX}${itemId}`
  await chrome.alarms.clear(alarmName)
  console.log(`[Reminders] Cancelled reminder for ${itemId}`)
}

/**
 * Extract the item ID from an alarm name
 * @param alarmName The name of the alarm
 * @returns The item ID if this is a reminder alarm, null otherwise
 */
export function getItemIdFromAlarm(alarmName: string): string | null {
  if (alarmName.startsWith(REMINDER_ALARM_PREFIX)) {
    return alarmName.substring(REMINDER_ALARM_PREFIX.length)
  }
  return null
}

/**
 * Check if an alarm is a reminder alarm
 * @param alarmName The name of the alarm
 */
export function isReminderAlarm(alarmName: string): boolean {
  return alarmName.startsWith(REMINDER_ALARM_PREFIX)
}

/**
 * Get all currently scheduled reminder alarms
 * @returns Array of { itemId, scheduledTime } for each scheduled reminder
 */
export async function getScheduledReminders(): Promise<{ itemId: string; scheduledTime: number }[]> {
  const alarms = await chrome.alarms.getAll()

  return alarms
    .filter(alarm => isReminderAlarm(alarm.name))
    .map(alarm => ({
      itemId: getItemIdFromAlarm(alarm.name)!,
      scheduledTime: alarm.scheduledTime,
    }))
}

/**
 * Format a reminder date/time for display
 * @param timestamp Unix timestamp (ms)
 * @returns Formatted string like "seg, 3 fev 9h"
 */
export function formatReminderTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = timestamp - now.getTime()
  const diffMinutes = Math.round(diffMs / (1000 * 60))

  // For very short times (< 2 hours), show relative time
  if (diffMinutes > 0 && diffMinutes < 120) {
    if (diffMinutes < 60) {
      return `em ${diffMinutes} min`
    }
    const hours = Math.floor(diffMinutes / 60)
    const mins = diffMinutes % 60
    if (mins === 0) {
      return `em ${hours}h`
    }
    return `em ${hours}h ${mins}min`
  }

  // Day of week abbreviations in Portuguese
  const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

  const dayOfWeek = dayNames[date.getDay()]
  const dayOfMonth = date.getDate()
  const month = monthNames[date.getMonth()]
  const hours = date.getHours()
  const minutes = date.getMinutes()

  // Check if it's today
  const isToday = date.toDateString() === now.toDateString()

  // Check if it's tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  // Format time
  const timeStr = minutes === 0 ? `${hours}h` : `${hours}:${minutes.toString().padStart(2, '0')}`

  if (isToday) {
    return `hoje ${timeStr}`
  }

  if (isTomorrow) {
    return `amanhã ${timeStr}`
  }

  // Check if it's within the same week
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) {
    return `${dayOfWeek} ${timeStr}`
  }

  // Otherwise show full date
  return `${dayOfWeek}, ${dayOfMonth} ${month} ${timeStr}`
}

/**
 * Calculate common reminder presets
 * @returns Array of preset options with labels and timestamps
 */
export function getReminderPresets(): { label: string; value: number }[] {
  const now = new Date()
  const currentHour = now.getHours()

  // In 1 minute (for testing)
  const oneMinute = new Date(now.getTime() + 1 * 60 * 1000)

  // In 15 minutes
  const fifteenMinutes = new Date(now.getTime() + 15 * 60 * 1000)

  // In 1 hour
  const oneHour = new Date(now.getTime() + 60 * 60 * 1000)

  // Dynamic option based on time of day:
  // - Morning (before 12h): "Depois do almoço" at 14h today
  // - Afternoon/Evening (12h+): "Amanhã de manhã" at 9h tomorrow
  const isMorning = currentHour < 12
  let dynamicOption: { label: string; value: number }

  if (isMorning) {
    // After lunch today at 14h
    const afterLunch = new Date(now)
    afterLunch.setHours(14, 0, 0, 0)
    dynamicOption = { label: 'Depois do almoço (14h)', value: afterLunch.getTime() }
  } else {
    // Tomorrow morning at 9h
    const tomorrowMorning = new Date(now)
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
    tomorrowMorning.setHours(9, 0, 0, 0)
    dynamicOption = { label: 'Amanhã de manhã (9h)', value: tomorrowMorning.getTime() }
  }

  // Tomorrow at 9 AM (only show if we're not already showing "Amanhã de manhã")
  const tomorrow9am = new Date(now)
  tomorrow9am.setDate(tomorrow9am.getDate() + 1)
  tomorrow9am.setHours(9, 0, 0, 0)

  // Next Monday at 9 AM
  const nextMonday = new Date(now)
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7 // If today is Monday, go to next Monday
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
  nextMonday.setHours(9, 0, 0, 0)

  // In 1 week (same time)
  const oneWeek = new Date(now)
  oneWeek.setDate(oneWeek.getDate() + 7)

  // Build presets array
  const presets = [
    { label: 'Em 1 minuto', value: oneMinute.getTime() },
    { label: 'Em 15 minutos', value: fifteenMinutes.getTime() },
    { label: 'Em 1 hora', value: oneHour.getTime() },
    dynamicOption, // Dynamic: "Depois do almoço" or "Amanhã de manhã"
  ]

  // Only add "Amanhã (9h)" if we're in the morning (otherwise dynamicOption already covers it)
  if (isMorning) {
    presets.push({ label: 'Amanhã (9h)', value: tomorrow9am.getTime() })
  }

  presets.push(
    { label: 'Próxima segunda (9h)', value: nextMonday.getTime() },
    { label: 'Em 1 semana', value: oneWeek.getTime() }
  )

  return presets
}
