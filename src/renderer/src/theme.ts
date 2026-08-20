import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

// One per Electron window (each is its own renderer/localStorage-backed
// document), but the underlying localStorage is shared across all
// windows of this app — see useTheme's storage-event listener for how an
// explicit change in one window reaches the others live.
function readStoredTheme(): Theme | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : null
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// No explicit choice yet means "null" — deliberately never collapsed
// into a concrete Theme, so callers can tell "nothing chosen, following
// the OS" apart from "the OS happens to currently resolve to dark" (see
// epic 0005/ADR 0027 — the whole point is never defaulting to dark
// on purpose).
function applyTheme(theme: Theme | null): void {
  if (theme) document.documentElement.setAttribute('data-theme', theme)
  else document.documentElement.removeAttribute('data-theme')
}

// Resolved current theme (for React Flow's colorMode, which needs a
// concrete 'light' | 'dark', never "system") plus a setter that always
// makes an explicit, persisted choice — there's no UI path back to
// "follow system" once you've picked one, matching the epic's own
// "theme toggle" framing rather than a three-state picker.
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (): void => setSystem(systemTheme())
    media.addEventListener('change', onSystemChange)
    // Another window explicitly changing the theme updates this one too
    // — the base.css cascade already means only applyTheme's DOM
    // attribute matters, so this just needs to keep `stored` in sync.
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY || event.key === null) setStored(readStoredTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    applyTheme(stored)
  }, [stored])

  const setTheme = useCallback((theme: Theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    setStored(theme)
  }, [])

  return { theme: stored ?? system, setTheme }
}
