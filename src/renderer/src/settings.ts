import { useCallback, useEffect, useState } from 'react'
import type { EdgeStyle } from '@shared/diagram'

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
  // Whether app startup scans for crash-recovery snapshots from diagrams
  // that were never saved (epic 0020/ADR 0040) — a real cost (disk scan
  // before the first window can usefully act on it) some users may want
  // to skip. Mirrored to a small main-process-readable file on every
  // change, since main needs this before any renderer/localStorage
  // exists — see useSettings below and settingsMirror.ts.
  scanForUnsavedRecoveryOnStartup: boolean
  // A selected edge's stroke swaps to this color entirely (overriding its
  // own explicit style and any highlight-match color), so it stays
  // findable at a glance in a busy diagram — raised after live-testing the
  // edge z-index fix (docs/known-issues.md) surfaced how hard a selected
  // edge could be to visually track at a dense connection point.
  // Edges only, not nodes — nodes already get a normal selection outline
  // from React Flow itself.
  selectedEdgeHighlightColor: string
  // Raw style fields stamped onto every newly created edge's data.style
  // (Canvas.tsx's onConnect/onConnectEnd) — epic 0061/ADR 0045. Same
  // EdgeStyle shape StylePicker's presets already produce (ADR 0010), so
  // the toolbar control reuses that exact picker rather than a new one.
  // Empty object means "today's existing look" (whatever LabeledEdge and
  // <ReactFlow>'s own defaultEdgeOptions fall back to) — an unset field
  // here doesn't get a hardcoded second default of its own.
  defaultEdgeStyle: EdgeStyle
}

export const DEFAULT_SETTINGS: AppSettings = {
  edgeStraightSegmentLength: 8,
  maxConnectionPointsPerSide: 12,
  scanForUnsavedRecoveryOnStartup: true,
  // Vivid magenta — deliberately outside the typical blue/green/red/orange
  // range diagram content tends to use, so it reads unambiguously as "this
  // is a UI selection indicator," not part of the diagram itself.
  selectedEdgeHighlightColor: '#ff00aa',
  defaultEdgeStyle: {}
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

  // Keeps main's mirrored copy in sync on mount too, not just on change —
  // covers a fresh install (mirror file doesn't exist yet) and any future
  // drift between the two stores.
  useEffect(() => {
    window.api.mirrorScanOnStartupSetting(settings.scanForUnsavedRecoveryOnStartup)
  }, [settings.scanForUnsavedRecoveryOnStartup])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, updateSettings }
}
