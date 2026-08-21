import { useCallback, useEffect, useState } from 'react'

// Global, app-wide preferences — not diagram content, not window-local UI
// state. Deliberately one extensible object under one storage key, not one
// key per setting (theme.ts's own pattern, predating this): the next
// global setting just adds a field here and a row in SettingsPanel, no new
// storage/sync plumbing. See ADR 0032 for why this exists as its own thing
// rather than being folded into wherever the first setting happened to be
// needed.
export interface AppSettings {
  // Pixels each edge travels straight out from its endpoint before
  // curving toward the other end — 0 means "no forced straight segment,"
  // today's only behavior. Epic 0047.
  edgeStraightSegmentLength: number
  // Upper bound on the property panel's per-side connection point count
  // field (epic 0039) — the total shown to the user, including the
  // always-present default point for that side.
  maxConnectionPointsPerSide: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  edgeStraightSegmentLength: 8,
  maxConnectionPointsPerSide: 12
}

const STORAGE_KEY = 'settings'

function readStoredSettings(): AppSettings {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    // Spread over the defaults, not a bare parse — an older stored blob
    // missing a field newer code added should still fill in a sane value,
    // same "absent means default" reasoning as the .chd format (ADR 0029),
    // applied here to a different storage medium.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// One per Electron window, live-synced across all of them via the
// `storage` event — same mechanism and reasoning as theme.ts's useTheme.
export function useSettings(): { settings: AppSettings; updateSettings: (patch: Partial<AppSettings>) => void } {
  const [settings, setSettings] = useState<AppSettings>(readStoredSettings)

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY || event.key === null) setSettings(readStoredSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, updateSettings }
}
