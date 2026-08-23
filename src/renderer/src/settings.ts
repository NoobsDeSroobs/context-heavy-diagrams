import { useCallback, useEffect, useState } from 'react'
import type { EdgeStyle, NodeStyle } from '@shared/diagram'
import type { LegendCorner } from './export/exportLegendPlacement'

export interface PaletteColor {
  label: string
  value: string
}

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
  // User/org-owned reusable colors and fonts — epic 0030/ADR 0048.
  // Surfaced as quick-pick options inside ColorField (Fill/Border/Font
  // color, panel and context-menu popups both, since both already reuse
  // that one component) and the Font Family dropdown. One active palette,
  // not several merged ones — importing a file replaces this outright
  // (confirmed in-panel first, see StylePalettePanel — not window.confirm(),
  // see docs/known-issues.md's entry on why).
  stylePalette: { colors: PaletteColor[]; fonts: string[] }
  // Default style stamped onto a freshly created Shape/Container/Text —
  // epic 0030/ADR 0048. Set explicitly (StylePalettePanel's "Set as
  // default" button, copying a selected element's current style), never
  // inferred from "whatever was last used." Edges already have this via
  // defaultEdgeStyle above (epic 0061) — deliberately not duplicated here.
  // Absent per type means today's existing look (Container keeps its own
  // hardcoded faint-fill fallback; Shape/Text keep ADR 0014's "no style at
  // all").
  defaultStyles: { shape?: NodeStyle; container?: NodeStyle; text?: NodeStyle }
  // Overrides React Flow's own light/dark default canvas background —
  // epic 0030/ADR 0048. Global, not per-diagram (matches the rest of the
  // style palette). Absent means today's existing theme-based background,
  // unchanged.
  canvasBackgroundColor?: string
  // PNG export (epic 0010/ADR 0051, revised after live testing) — the
  // *last used* values from the Export as PNG… dialog (ExportPngDialog),
  // remembered here purely so the dialog reopens prefilled next time
  // rather than resetting to defaults on every export. The dialog itself,
  // not this settings object, is the actual place these get edited.
  // paddingPx: exported-image pixels around the diagram's own content
  // bounds. transparentBackground: omit the canvas background entirely
  // instead of filling it. backgroundColorOverride: an explicit fill color
  // distinct from canvasBackgroundColor above (the on-screen editor
  // background) — absent means "use whatever's on screen right now."
  pngExportPaddingPx: number
  pngExportTransparentBackground: boolean
  pngExportBackgroundColorOverride?: string
  // Which corner the auto-placed legend (diagram Legend entries + enabled
  // highlights) goes in — see exportLegendPlacement.ts. Same "remembers
  // the dialog's last choice" treatment as the three fields above.
  pngExportLegendCorner: LegendCorner
}

export const DEFAULT_SETTINGS: AppSettings = {
  edgeStraightSegmentLength: 8,
  maxConnectionPointsPerSide: 12,
  scanForUnsavedRecoveryOnStartup: true,
  // Vivid magenta — deliberately outside the typical blue/green/red/orange
  // range diagram content tends to use, so it reads unambiguously as "this
  // is a UI selection indicator," not part of the diagram itself.
  selectedEdgeHighlightColor: '#ff00aa',
  defaultEdgeStyle: {},
  stylePalette: { colors: [], fonts: [] },
  defaultStyles: {},
  pngExportPaddingPx: 40,
  pngExportTransparentBackground: false,
  pngExportLegendCorner: 'bottom-left'
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
