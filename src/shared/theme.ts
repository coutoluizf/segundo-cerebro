/**
 * Theme management for dark mode
 * MV3 CSP-safe: no inline scripts, uses programmatic theme detection
 */

type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'segundo-cerebro-theme'

// Get stored theme preference
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // localStorage not available in some contexts
  }
  return 'system'
}

// Store theme preference
export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // localStorage not available in some contexts
  }
}

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Apply theme to document
function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
  }
}

// Get resolved theme (resolves 'system' to actual theme)
export function getResolvedTheme(): 'light' | 'dark' {
  const stored = getStoredTheme()
  if (stored === 'system') {
    return getSystemTheme()
  }
  return stored
}

// Initialize theme system
// Call this in each UI entry point (popup, dashboard, options)
export function initSystemTheme(): void {
  // Apply initial theme
  applyTheme(getResolvedTheme())

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme(getSystemTheme())
      }
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // Legacy support
      mediaQuery.addListener(handleChange)
    }
  }
}

// Set theme programmatically
export function setTheme(theme: Theme): void {
  setStoredTheme(theme)
  if (theme === 'system') {
    applyTheme(getSystemTheme())
  } else {
    applyTheme(theme)
  }
}
