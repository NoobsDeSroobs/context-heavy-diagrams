import type {
  HighlightDefinition,
  IconRef,
  JsonValue,
  LegendEntry,
  LineStyleKind,
  MarkerKind
} from '@shared/diagram'
import { highlightId } from '../highlights'
import type { DirectionSetLegendRow } from '../edges/edgeDirectionSets'

export type { DirectionSetLegendRow }

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
// currently-*enabled* highlight (raised after live-testing PNG
// export — "if I use the GDPR highlights when exporting, the legend
// should contain green saying No PII, blue saying Pseudonymized...").
// Highlight enabled/disabled is deliberately session-only, never persisted
// (see HighlightDefinition's own comment in shared/diagram.ts) — this
// reads whatever's actually toggled on right now, the same set already
// visibly recoloring the canvas, not the full catalog regardless of state.
// A highlight's label mirrors HighlightsPanel's own convention exactly:
// `key = value` when it's the only enabled member of its key, just the
// value when it shares its key with other enabled entries (matching the
// user's own example: four GDPR classification values, no group header).
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
