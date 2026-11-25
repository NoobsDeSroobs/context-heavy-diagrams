import type { IconRef } from '../icons/schema.ts'
import type { LineStyleKind, MarkerKind } from '../styling/schema.ts'
import type { LineMotion } from '../styling/edgeAnimation.ts'

// Legend catalog — see ADR 0033. Each entry explains one visual
// convention the diagram author deliberately used, in the author's own
// words — never auto-derived from `highlights` or anything else. `color`
// only applies to 'line'/'entity' kinds: this app's icons are fixed
// multi-color bundled/custom assets, not tintable, so an 'icon' entry
// carries no color at all (see ADR 0033 for why a
// background chip was also rejected — same ambiguity as a colored box).
export type LegendEntryKind = 'line' | 'icon' | 'entity'
// A 'line' entry also carries an edge's animation, speed, direction, pulse distance and dash length
// and gap (ADR 0141), so the legend arrow moves like the edge it stands for.
export interface LegendEntry extends LineMotion {
  id: string
  kind: LegendEntryKind
  label: string
  // 'line' and 'entity' kinds only.
  color?: string
  // 'line' kind only — same fields/vocabulary as EdgeStyle's, reusing the
  // existing named line-style preset picker (ADR 0010) rather than a
  // parallel one.
  lineStyle?: LineStyleKind
  // How thick the line is drawn, in pixels, as an edge's `style.strokeWidth` (ADR 0197). Absent means
  // the built-in thickness.
  strokeWidth?: number
  startMarker?: MarkerKind
  endMarker?: MarkerKind
  // How an edge drawn with this line is laid out, as an edge's `style.routingStyle` (ADR 0196). Absent
  // means the personal default routing. The legend sample is always drawn straight.
  routingStyle?: 'straight' | 'step' | 'smoothstep' | 'catmullRom'
  // 'line' kind only: new edges are drawn with this line (ADR 0196). At most one entry has it.
  forNewEdges?: boolean
  // 'icon' kind only.
  icon?: IconRef
}
