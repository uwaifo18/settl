/**
 * Theme management — persists 'light' | 'dark' | 'system' to localStorage,
 * applies data-theme attribute to <html> so CSS tokens switch instantly.
 */

export type ThemePreference = 'dark' | 'light' | 'system'

const KEY = 'settl-theme'

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* ignore */ }
  return 'dark' // default: dark
}

export function setThemePreference(pref: ThemePreference): void {
  try { localStorage.setItem(KEY, pref) } catch { /* ignore */ }
  applyTheme(pref)
}

export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'light') {
    root.setAttribute('data-theme', 'light')
  } else if (pref === 'dark') {
    root.setAttribute('data-theme', 'dark')
  } else {
    // system: remove attribute and let prefers-color-scheme take over
    root.removeAttribute('data-theme')
  }
}

/** Call once on app startup to restore the saved preference. */
export function initTheme(): void {
  applyTheme(getThemePreference())
}
