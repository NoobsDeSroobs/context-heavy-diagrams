import type { EdgeStyle, GravityPreset, NodeStyle } from './diagram'

// The app-wide Preferences tier — per-installation, every-diagram (see the
// glossary and ADR 0052's addendum for the "Settings" -> "Preferences"
// rename). Moved here from the renderer (see ADR 0053) — main needs this
// exact shape too, to read/write the real per-OS file directly
// (app.getPath('userData')/settings.json — filename kept for existing
// installs) rather than the renderer's own localStorage, which only a
// renderer can reach.

export interface PaletteColor {
  label: string
  value: string
}

// One named set of reusable colors + fonts (see ADR 0068). Several
// are kept around at once ("Company", "GDPR", "Client"); exactly one is
// active at a time and feeds the color fields / Font Family dropdown. The
// `id` is the stable handle the active pointer uses, so renaming a palette
// never loses its active status.
export interface NamedStylePalette {
  id: string
  name: string
  colors: PaletteColor[]
  fonts: string[]
}

// The older single-palette shape, kept only so normalizePreferences can
// migrate an older settings.json forward. Never written by current code.
export interface LegacyStylePalette {
  colors: PaletteColor[]
  fonts: string[]
}

// Fixed id for the palette an older single-palette settings.json is migrated into, and
// for the one DEFAULT_PREFERENCES seeds — deterministic so the migration is
// idempotent and so every fresh install starts from the same handle.
export const DEFAULT_STYLE_PALETTE_ID = 'palette-default'

export type LegendCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// Global, app-wide preferences — not diagram content, not window-local UI
// state. Deliberately one extensible object under one storage key, not one
// key per field (theme.ts's own pattern, predating this): the next global
// preference just adds a field here and a row in PreferencesPanel, no new
// storage/sync plumbing. See ADR 0032 for why this exists as its own thing
// rather than being folded into wherever the first one happened to be
// needed.
export interface AppPreferences {
  // Pixels each edge travels straight out from its endpoint before
  // curving toward the other end — 0 means "no forced straight segment,"
  // today's only behavior. See ADR 0032.
  edgeStraightSegmentLength: number
  // Upper bound on the property panel's per-side connection point count
  // field — the total shown to the user, including the always-present
  // default point for that side.
  maxConnectionPointsPerSide: number
  // Whether app startup scans for crash-recovery snapshots from diagrams
  // that were never saved (see ADR 0040) — a real cost (disk scan
  // before the first window can usefully act on it) some users may want
  // to skip. Main reads this directly from the real settings file at
  // startup (ADR 0053), no separate mirror file needed anymore.
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
  // (Canvas.tsx's onConnect/onConnectEnd) — see ADR 0045. Same
  // EdgeStyle shape StylePicker's presets already produce (ADR 0010), so
  // the toolbar control reuses that exact picker rather than a new one.
  // Empty object means "today's existing look" (whatever LabeledEdge and
  // <ReactFlow>'s own defaultEdgeOptions fall back to) — an unset field
  // here doesn't get a hardcoded second default of its own.
  defaultEdgeStyle: EdgeStyle
  // User/org-owned reusable colors and fonts — ADR 0048,
  // reshaped into a named collection by ADR 0068. Surfaced as
  // quick-pick options inside ColorField (Fill/Border/Font color, panel
  // and context-menu popups both) and the Font Family dropdown — always
  // from whichever palette activeStylePaletteId points at, resolved live
  // via effectiveStylePalette(). Several named palettes are kept around at
  // once and switched between in StylePalettePanel; importing a file adds
  // a new one rather than overwriting. Colors/fonts only — canvas
  // background and per-type default styles below are still single global
  // values, not per-palette (the feature is "get the colors right while
  // authoring," not swappable diagram themes).
  stylePalettes: NamedStylePalette[]
  // Which entry of stylePalettes is currently active. null (or a dangling
  // id) means "fall back to the first palette, or an empty set if there
  // are none" — see effectiveStylePalette().
  activeStylePaletteId: string | null
  // Default style stamped onto a freshly created Shape/Container/Text —
  // ADR 0048. Set explicitly (StylePalettePanel's "Set as default"
  // button, copying a selected element's current style), never inferred
  // from "whatever was last used." Edges already have this via
  // defaultEdgeStyle above (ADR 0045) — deliberately not duplicated here.
  // Absent per type means today's existing look (Container keeps its own
  // hardcoded faint-fill fallback; Shape/Text keep ADR 0014's "no style at
  // all").
  defaultStyles: { shape?: NodeStyle; container?: NodeStyle; text?: NodeStyle }
  // Overrides React Flow's own light/dark default canvas background —
  // ADR 0048. Global, not per-diagram (matches the rest of the
  // style palette). Absent means today's existing theme-based background,
  // unchanged.
  canvasBackgroundColor?: string
  // PNG export (ADR 0051, revised after live testing) — the
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
  // React Flow's own selectionMode prop (SelectionMode.Full/.Partial),
  // exposed as a Setting rather than hardcoded — raised after the user
  // started relying on drag-to-select more heavily alongside the
  // multi-connection-line feature. true (Full, today's only prior behavior):
  // an element must be entirely inside the drag box to be selected.
  // false (Partial): touching the box's edge is enough — usually the more
  // useful mode once you're deliberately drag-selecting a cluster rather
  // than a precise sub-area.
  dragSelectRequiresFullEnclosure: boolean
  // React Flow's own minZoom/maxZoom props, exposed as a Setting rather
  // than hardcoded — previously never set at all (silently inheriting
  // React Flow's own 0.5/2 library defaults) until a large diagram made
  // "zoom out further" a real ask. Global, not per-diagram, same as every
  // other canvas-behavior Setting here.
  minZoom: number
  maxZoom: number
  // Opacity applied to every element outside the current search match set
  // while Isolate is active (see ADR 0063) — global, not per-diagram,
  // same tier as every other canvas-behavior Setting here. 0 would hide
  // non-matches entirely; deliberately left as a plain opacity rather than
  // a visibility toggle so de-emphasized structure/context stays visible.
  isolateOpacity: number
  // Directory of the last opened/saved diagram — passed as
  // `defaultPath` to File -> Open/Save As's dialogs so they default to
  // wherever the user was last working, instead of the OS/Electron's own
  // arbitrary default. Absent means "no dialog opened yet this install,"
  // not a meaningful default of its own — deliberately optional rather
  // than defaulted to e.g. the home directory. Written directly by main
  // (windows.ts/diagram.ts), never edited through PreferencesPanel — this is
  // a silent backend preference, not user-facing UI.
  lastOpenedDirectory?: string
  // Absolute paths of recently opened/saved diagrams, most-recent-first —
  // feeds File -> Recent Diagrams (see ADR 0078). Every path that lands in a
  // window funnels through diagram:openPath, so "opened" here includes File
  // -> Open, drag-and-drop, and following a linked diagram; a repeat Save
  // counts too. Deduped, and clamped to `recentDiagramsLimit` at every
  // normalize boundary. Written directly by main, never edited through
  // PreferencesPanel (the list itself is not user-facing — only its limit
  // and the "Clear Recent" action are). Absent means none yet.
  recentDiagrams?: string[]
  // How many entries File -> Recent Diagrams keeps. User-facing (unlike the
  // list). Lowering it trims the stored list at the next normalize; the
  // dropped entries don't come back if raised again. Absent means the
  // default (10).
  recentDiagramsLimit: number
  // User default tier for line gravity/bend presets (see ADR 0066;
  // ADR 0052's Diagram override -> User default -> Built-in default
  // fallback pattern) — the middle tier that was missing when that pattern was
  // first named. Absent means "no personal default set," falling all the
  // way through to DEFAULT_GRAVITY_PRESETS (lineGravityPresets.ts), same
  // "absent means default" convention as everything else in this app.
  // Applies live to any already-open diagram that has no override of its
  // own — resolved reactively (same as every other Setting here), not
  // baked in once at load time. A diagram with its own override is
  // unaffected either way, since that tier always wins outright.
  gravityPresetsUserDefault?: GravityPreset[]
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  edgeStraightSegmentLength: 8,
  maxConnectionPointsPerSide: 12,
  scanForUnsavedRecoveryOnStartup: true,
  // Vivid magenta — deliberately outside the typical blue/green/red/orange
  // range diagram content tends to use, so it reads unambiguously as "this
  // is a UI selection indicator," not part of the diagram itself.
  selectedEdgeHighlightColor: '#ff00aa',
  defaultEdgeStyle: {},
  stylePalettes: [{ id: DEFAULT_STYLE_PALETTE_ID, name: 'Default', colors: [], fonts: [] }],
  activeStylePaletteId: DEFAULT_STYLE_PALETTE_ID,
  defaultStyles: {},
  pngExportPaddingPx: 40,
  pngExportTransparentBackground: false,
  pngExportLegendCorner: 'bottom-left',
  dragSelectRequiresFullEnclosure: true,
  minZoom: 0.1,
  maxZoom: 2,
  isolateOpacity: 0.5,
  recentDiagramsLimit: 10
}

// Standard desktop convention; also a floor for the user-facing limit input
// so "0 recents" can't be configured (use Clear Recent to empty it).
export const MIN_RECENT_DIAGRAMS_LIMIT = 1

// Prepend `path` to the recent list, move it to the top if already present
// (case-sensitive exact match — these are absolute paths from the OS, not
// user input), and clamp to `limit`. Pure; main calls this before writing.
export function withRecentDiagram(
  list: string[] | undefined,
  path: string,
  limit: number
): string[] {
  const rest = (list ?? []).filter((p) => p !== path)
  return [path, ...rest].slice(0, Math.max(1, limit))
}

// Every point that receives a stored/relayed preferences blob runs this
// (main's file read, the renderer's file read, the cross-window broadcast,
// the legacy-localStorage migration) — the standing rule is that no
// AppPreferences field may ever resolve to undefined, so re-merging over
// DEFAULT_PREFERENCES at each boundary is deliberate, not redundant (a field
// added in newer renderer code must still show its default even if main
// hasn't been rebuilt yet — this bit us once with isolateOpacity).
//
// It also carries the named-style-palettes migration (ADR 0068): an older
// blob has a single `stylePalette: { colors, fonts }` and no
// `stylePalettes` array. Fold it
// into the named collection as one "Default" palette. Idempotent — an
// already-migrated blob has `stylePalettes` set, so the branch is skipped.
export function normalizePreferences(
  raw: Partial<AppPreferences> & { stylePalette?: LegacyStylePalette }
): AppPreferences {
  const { stylePalette: legacy, ...rest } = raw
  const merged: AppPreferences = { ...DEFAULT_PREFERENCES, ...rest }
  // Recent-diagrams list: dedupe defensively and clamp to the (possibly
  // just-lowered) limit, so every boundary that receives a prefs blob
  // enforces both — same "normalize, don't trust the stored shape" stance
  // as the stylePalette migration below.
  if (merged.recentDiagrams && merged.recentDiagrams.length > 0) {
    const deduped = [...new Set(merged.recentDiagrams)]
    merged.recentDiagrams = deduped.slice(
      0,
      Math.max(MIN_RECENT_DIAGRAMS_LIMIT, merged.recentDiagramsLimit)
    )
  }
  if (legacy && !rest.stylePalettes) {
    merged.stylePalettes = [
      {
        id: DEFAULT_STYLE_PALETTE_ID,
        name: 'Default',
        colors: legacy.colors ?? [],
        fonts: legacy.fonts ?? []
      }
    ]
    merged.activeStylePaletteId = DEFAULT_STYLE_PALETTE_ID
  }
  return merged
}

// The colors/fonts every color field and the Font Family dropdown draw
// from — whichever palette `activeId` points at, falling back to the first
// palette if that id is dangling (deleted without the pointer being
// updated), then to an empty set if there are no palettes at all. Takes
// the two fields rather than the whole AppPreferences (same shape as
// effectiveGravityPresets, ADR 0066) so a useMemo over it lists exactly
// what it depends on. Resolved live on every render — nothing snapshotted
// at load, so switching the active palette applies immediately everywhere.
export function effectiveStylePalette(
  palettes: NamedStylePalette[],
  activeId: string | null
): LegacyStylePalette {
  return palettes.find((p) => p.id === activeId) ?? palettes[0] ?? { colors: [], fonts: [] }
}
