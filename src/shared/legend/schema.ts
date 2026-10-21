import type { IconRef } from '../icons/schema.ts'
import type { LineStyleKind, MarkerKind } from '../styling/schema.ts'

// Legend catalog — see ADR 0033. Each entry explains one visual
// convention the diagram author deliberately used, in the author's own
// words — never auto-derived from `highlights` or anything else. `color`
// only applies to 'line'/'entity' kinds: this app's icons are fixed
// multi-color bundled/custom assets, not tintable, so an 'icon' entry
// carries no color at all (see ADR 0033 for why a
// background chip was also rejected — same ambiguity as a colored box).
export type LegendEntryKind = 'line' | 'icon' | 'entity'
export interface LegendEntry {
  id: string
  kind: LegendEntryKind
  label: string
  // 'line' and 'entity' kinds only.
  color?: string
  // 'line' kind only — same fields/vocabulary as EdgeStyle's, reusing the
  // existing named line-style preset picker (ADR 0010) rather than a
  // parallel one.
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
  // 'icon' kind only.
  icon?: IconRef
}
