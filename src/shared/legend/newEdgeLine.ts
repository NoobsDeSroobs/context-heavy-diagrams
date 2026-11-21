// The legend line that new edges are drawn with (ADR 0196): one entry of kind `line` may carry
// `forNewEdges`. Pure, shared by the editor and the assistant tools.
import type { EdgeStyle } from '../styling/schema.ts'
import { lineMotionOf } from '../styling/edgeAnimation.ts'
import type { LegendEntry } from './schema.ts'

// The entry new edges follow, or undefined. If a hand-written file flags more than one, the first
// wins; an entry of another kind never counts.
export function newEdgeLineEntry(
  legend: readonly LegendEntry[] | undefined
): LegendEntry | undefined {
  return legend?.find((entry) => entry.kind === 'line' && entry.forNewEdges === true)
}

// What a new edge gets from the entry. The thickness, the line style and the markers are what the
// entry says; an entry with none leaves the field out, so the built-in or the personal default fills
// it in. Opacity is not in an entry and so is never set from it. `stroke` is the colour to store on
// the edge: the caller decides it, since an edge's stored colour is flipped for the light theme and a
// legend colour is not (ADR 0034, ADR 0123).
export function edgeStyleFromLegendLine(entry: LegendEntry, stroke?: string): EdgeStyle {
  return {
    ...(stroke !== undefined ? { stroke } : {}),
    ...(entry.strokeWidth !== undefined ? { strokeWidth: entry.strokeWidth } : {}),
    ...(entry.lineStyle !== undefined ? { lineStyle: entry.lineStyle } : {}),
    ...(entry.startMarker !== undefined ? { startMarker: entry.startMarker } : {}),
    ...(entry.endMarker !== undefined ? { endMarker: entry.endMarker } : {}),
    ...lineMotionOf(entry)
  }
}

// The legend with `id` as the line for new edges and no other entry; null for none. An id that is
// not a line entry changes nothing. The same array comes back when nothing changes.
export function withNewEdgeLine(legend: LegendEntry[], id: string | null): LegendEntry[] {
  if (id !== null && !legend.some((e) => e.id === id && e.kind === 'line')) return legend
  let changed = false
  const next = legend.map((entry) => {
    const wanted = id !== null && entry.id === id
    if ((entry.forNewEdges === true) === wanted) return entry
    changed = true
    if (wanted) return { ...entry, forNewEdges: true }
    const rest = { ...entry }
    delete rest.forNewEdges
    return rest
  })
  return changed ? next : legend
}
