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
  // findable at a glance in a busy diagram, even at a dense connection point (see
  // docs/known-issues.md).
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
  // User/org-owned reusable colours and fonts (ADR 0048), kept as named palettes (ADR 0068). They
  // appear as quick-picks in ColorField (Fill/Border/Font colour, panel and context-menu popups)
  // and the Font Family dropdown, from the palette activeStylePaletteId points at, resolved live
  // via effectiveStylePalette(). Several palettes are kept and switched in StylePalettePanel;
  // importing a file adds one. Colours and fonts only: canvas background and per-type default
  // styles below are single global values, since the feature is "get the colours right while
  // authoring", not swappable diagram themes.
  stylePalettes: NamedStylePalette[]
  // Which entry of stylePalettes is currently active. null (or a dangling
  // id) means "fall back to the first palette, or an empty set if there
  // are none" — see effectiveStylePalette().
  activeStylePaletteId: string | null
  // Default style stamped onto a new Entity/Container/Text (ADR 0048). Set explicitly
  // (StylePalettePanel's "Set as default", copying a selected element's style), never inferred from
  // what was used last. Edges have this via defaultEdgeStyle above (ADR 0045). Absent per type
  // means today's look (Container keeps its hardcoded faint-fill fallback; Entity/Text keep ADR
  // 0014's "no style at all").
  defaultStyles: { entity?: NodeStyle; container?: NodeStyle; text?: NodeStyle }
  // Overrides React Flow's own light/dark default canvas background —
  // ADR 0048. Global, not per-diagram (matches the rest of the
  // style palette). Absent means today's existing theme-based background,
  // unchanged.
  canvasBackgroundColor?: string
  // PNG export (ADR 0051): the last used values from the Export as PNG… dialog (ExportPngDialog),
  // kept only so the dialog reopens prefilled; the dialog is where they are edited. paddingPx:
  // pixels around the diagram's content bounds. transparentBackground: omit the canvas background
  // instead of filling it. backgroundColorOverride: an explicit fill distinct from
  // canvasBackgroundColor (the on-screen background); absent means use what is on screen now.
  pngExportPaddingPx: number
  pngExportTransparentBackground: boolean
  pngExportBackgroundColorOverride?: string
  // Which corner the auto-placed legend (diagram Legend entries + enabled
  // highlights) goes in — see exportLegendPlacement.ts. Same "remembers
  // the dialog's last choice" treatment as the three fields above.
  pngExportLegendCorner: LegendCorner
  // React Flow's own selectionMode prop (SelectionMode.Full/.Partial),
  // exposed as a Setting rather than hardcoded, since drag-to-select gets heavy use alongside
  // multi-connection lines. true (Full, today's only prior behavior):
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
  // Directory of the last opened or saved diagram, passed as `defaultPath` to File -> Open/Save As
  // so the dialogs start where the user was last working. Absent means no dialog opened yet this
  // install, deliberately not defaulted to e.g. the home directory. Written by main
  // (windows.ts/diagram.ts), never edited through PreferencesPanel: a silent backend preference,
  // not UI.
  lastOpenedDirectory?: string
  // Absolute paths of recently opened or saved diagrams, most recent first, feeding File -> Recent
  // Diagrams (ADR 0078). Every path that lands in a window funnels through diagram:openPath, so
  // "opened" covers File -> Open, drag-and-drop and following a linked diagram; a repeat Save
  // counts too. Deduped, clamped to `recentDiagramsLimit` at every normalize boundary. Written by
  // main; the list isn't user-facing, only its limit and "Clear Recent" are. Absent means none yet.
  recentDiagrams?: string[]
  // How many entries File -> Recent Diagrams keeps. User-facing (unlike the
  // list). Lowering it trims the stored list at the next normalize; the
  // dropped entries don't come back if raised again. Absent means the
  // default (10).
  recentDiagramsLimit: number
  // User default tier for line gravity/bend presets (ADR 0066; the Diagram override -> User default
  // -> Built-in default pattern of ADR 0052). Absent means no personal default, falling through to
  // DEFAULT_GRAVITY_PRESETS (lineGravityPresets.ts), the same "absent means default" convention as
  // everywhere else. It applies live to any open diagram without its own override, resolved
  // reactively and not baked in at load; a diagram with its own override always wins.
  gravityPresetsUserDefault?: GravityPreset[]
  // Whether the top-level AI menu (and everything hanging off it) is shown —
  // see ADR 0103. A pure chrome toggle: nothing in a .chd file depends on it.
  // Default on; a future installer can seed it from its "enable AI features?"
  // question.
  aiFeaturesEnabled: boolean
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
  recentDiagramsLimit: 10,
  aiFeaturesEnabled: true
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

// Every point that receives a stored or relayed preferences blob runs this (main's file read, the
// renderer's file read, the cross-window broadcast, the legacy-localStorage migration). The
// standing rule is that no AppPreferences field may resolve to undefined, so re-merging over
// DEFAULT_PREFERENCES at each boundary is deliberate, not redundant: a field added in newer
// renderer code must still show its default when main hasn't been rebuilt yet (this bit us once
// with isolateOpacity).
//
// It also carries the named-palettes migration (ADR 0068): an older blob has a single
// `stylePalette: { colors, fonts }` and no `stylePalettes`, and is folded into the collection as
// one "Default" palette. Idempotent: a migrated blob has `stylePalettes`, so the branch is skipped.
export function normalizePreferences(
  raw: Partial<AppPreferences> & {
    stylePalette?: LegacyStylePalette
    // Pre-rename field name (Shape -> Entity) — `defaultStyles`
    // itself is spread from `rest` below, so this legacy sub-key is read and
    // folded in separately rather than via `rest`.
    defaultStyles?: {
      shape?: NodeStyle
      entity?: NodeStyle
      container?: NodeStyle
      text?: NodeStyle
    }
  }
): AppPreferences {
  const { stylePalette: legacy, ...rest } = raw
  const merged: AppPreferences = { ...DEFAULT_PREFERENCES, ...rest }
  if (raw.defaultStyles?.shape && !raw.defaultStyles.entity) {
    merged.defaultStyles = { ...merged.defaultStyles, entity: raw.defaultStyles.shape }
  }
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

// The colours and fonts every colour field and the Font Family dropdown draw from: the palette
// `activeId` points at, falling back to the first palette if that id is dangling, then to an empty
// set. Takes the two fields, not the whole AppPreferences (as effectiveGravityPresets does, ADR
// 0066), so a useMemo over it lists exactly what it depends on. Resolved live on every render, so
// switching the active palette applies everywhere immediately.
export function effectiveStylePalette(
  palettes: NamedStylePalette[],
  activeId: string | null
): LegacyStylePalette {
  return palettes.find((p) => p.id === activeId) ?? palettes[0] ?? { colors: [], fonts: [] }
}
