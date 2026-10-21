import type {
  EdgeDirectionSet,
  HighlightDefinition,
  IconRef,
  JsonValue,
  LegendEntry,
  LineStyleKind,
  MarkerKind
} from '../diagram/index.ts'
import { highlightId } from '../tagging/highlights.ts'

// The legend row the active direction set contributes (ADR 0081): its name
// drawn as an arrow, shown in the Legend panel and prepended to the image
// exports' legend. `null` when the diagram has no direction set.
export interface DirectionSetLegendRow {
  label: string
  color: string
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}

// Seed / fallback colour for a direction set's legend swatch — same value
// as LegendPanel's own DEFAULT_COLOR so a fresh set's row looks like a
// fresh authored 'line' entry.
export const DEFAULT_DIRECTION_SET_LEGEND_COLOR = '#e6194b'

export function directionSetLegendRow(
  sets: EdgeDirectionSet[],
  activeId: string | undefined
): DirectionSetLegendRow | null {
  const active = sets.find((s) => s.id === activeId) ?? sets[0]
  if (!active) return null
  return {
    label: active.name,
    // The legend row shows the set's own default edge style (ADR 0083).
    // `strokeWidth` is deliberately not reflected in the swatch in v1.
    color: active.style?.stroke ?? DEFAULT_DIRECTION_SET_LEGEND_COLOR,
    lineStyle: active.style?.lineStyle,
    startMarker: active.style?.startMarker,
    endMarker: active.style?.endMarker
  }
}

export type ExportLegendSwatch =
  | {
      kind: 'line'
      color: string
      lineStyle?: LineStyleKind
      startMarker?: MarkerKind
      endMarker?: MarkerKind
    }
  | { kind: 'entity'; color: string }
  | { kind: 'icon'; icon: IconRef }
  | { kind: 'highlight'; color: string }

export interface ExportLegendItem {
  swatch: ExportLegendSwatch
  label: string
}

// Same stringify-for-display convention as HighlightsPanel/MetadataSection/
// RequiredTagsPanel — small independent copy, not a shared import, matching
// this codebase's existing pattern for this exact one-liner.
function stringifyValue(value: JsonValue): string {
  if (value === null) return 'None'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

// Combines the diagram's own authored Legend entries with one row per
// currently-*enabled* highlight (so an exported image explains the GDPR highlights: green for No
// PII, blue for Pseudonymized, and so on).
// Highlight enabled/disabled is deliberately session-only, never persisted
// (see HighlightDefinition's own comment in shared/diagram.ts) — this
// reads whatever's actually toggled on right now, the same set already
// visibly recoloring the canvas, not the full catalog regardless of state.
// A highlight's label mirrors HighlightsPanel's own convention exactly:
// `key = value` when it's the only enabled member of its key, just the
// value when it shares its key with other enabled entries (e.g. four GDPR classification values, no
// group header).
export function buildExportLegendItems(
  legend: LegendEntry[],
  highlights: HighlightDefinition[],
  enabledHighlightIds: Set<string>,
  directionSetRow?: DirectionSetLegendRow | null
): ExportLegendItem[] {
  const directionItems: ExportLegendItem[] = directionSetRow
    ? [
        {
          swatch: {
            kind: 'line',
            color: directionSetRow.color,
            lineStyle: directionSetRow.lineStyle,
            startMarker: directionSetRow.startMarker,
            endMarker: directionSetRow.endMarker
          },
          label: directionSetRow.label
        }
      ]
    : []

  const legendItems: ExportLegendItem[] = legend.map((entry) => ({
    swatch:
      entry.kind === 'icon'
        ? { kind: 'icon', icon: entry.icon as IconRef }
        : {
            kind: entry.kind,
            color: entry.color ?? '#000000',
            lineStyle: entry.lineStyle,
            startMarker: entry.startMarker,
            endMarker: entry.endMarker
          },
    label: entry.label
  }))

  const enabled = highlights.filter((h) => enabledHighlightIds.has(highlightId(h)))
  const countByKey = new Map<string, number>()
  for (const h of enabled) countByKey.set(h.key, (countByKey.get(h.key) ?? 0) + 1)

  const highlightItems: ExportLegendItem[] = enabled.map((h) => ({
    swatch: { kind: 'highlight', color: h.color },
    label:
      countByKey.get(h.key) === 1
        ? `${h.key} = ${stringifyValue(h.value)}`
        : stringifyValue(h.value)
  }))

  return [...directionItems, ...legendItems, ...highlightItems]
}
