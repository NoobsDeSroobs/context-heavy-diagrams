import type { EdgeStyle, LineStyleKind, MarkerKind } from '../styling/schema.ts'
import type { MetadataEntry } from '../tagging/schema.ts'
import type { LinePoint } from '../nodes/schema.ts'

// A diagram-wide "reading" of every edge that differs only in arrow
// direction — see ADR 0081. "Data flow" vs. "Trigger direction" being the
// canonical pair. A set never adds or removes edges; every edge exists in
// every set, only its direction (and which connection point each end uses)
// changes. Empty `DiagramFile.edgeDirectionSets` means the feature is
// dormant. A *single* set is meaningful: it names the current reading,
// contributes a legend row, and its `style` is the default for edges drawn
// while it is active (see `style` below); per-edge `directionSets` records
// and the base-orientation rule only kick in at two or more sets.
export interface EdgeDirectionSet {
  id: string
  name: string
  // The default edge style for this reading — see ADR 0083. It does two
  // things: (1) it seeds the style of any edge *drawn while this set is
  // active* (composed over the global default-edge-style preference), and
  // (2) it is how this reading draws as a legend row (panel + PNG export)
  // while active — label is always `name`. It does NOT restyle edges that
  // already exist; switching the active set changes direction only (ADR
  // 0081). Absent `stroke` falls back to a default for the legend swatch.
  // Renamed from `legend` (ADR 0081) and widened — `fromDiagramFile`
  // migrates the old shape (`color` -> `stroke`).
  style?: EdgeDirectionSetStyle
}

// A strict subset of EdgeStyle: the fields that make sense as a per-reading
// default. No routingStyle (geometry, bend-point-coupled — stays per-edge),
// no font, no labelPosition.
export type EdgeDirectionSetStyle = Pick<
  EdgeStyle,
  'stroke' | 'strokeWidth' | 'strokeOpacity' | 'lineStyle' | 'startMarker' | 'endMarker'
>

// The pre-ADR-0083 shape of EdgeDirectionSet.style, still accepted on load.
export interface EdgeDirectionSetLegend {
  color?: string
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}

// One edge's orientation within one set. The two endpoint *nodes* are
// invariant across sets — only which end is `source`, and the connection
// point each end lands on, may differ.
export interface EdgeDirection {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface DiagramEdge {
  id: string
  // 'labeled'. Plain string, same reasoning as DiagramNode.type.
  type?: string
  // On disk these always hold the *base* set's orientation
  // (edgeDirectionSets[0]) regardless of which set is active — see ADR 0081
  // and `directionSets` below.
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  style?: EdgeStyle
  metadata?: Record<string, MetadataEntry>
  // Per-set orientation, keyed by EdgeDirectionSet.id — see ADR 0081. Only
  // present (on disk and in memory) when the diagram has >= 2 direction
  // sets; contains an entry for every set, the base set's entry matching
  // this edge's own top-level source/target/handles. Direction-sensitive
  // style (`points` order, style.startMarker/endMarker, style.labelPosition)
  // is *not* stored per set — it's single-copy in base orientation and
  // transformed at set-switch time.
  directionSets?: Record<string, EdgeDirection>
  // Manual routing points, absolute canvas coordinates. Meaning depends on
  // style.routingStyle (see ADR 0057, ADR 0077):
  //   - 'catmullRom': interior control points of a smooth curve, each
  //     `gravity` respected (bendablePath.ts).
  //   - 'step' / 'smoothstep': orthogonal waypoints the right-angled path
  //     is forced through (orthogonalPath.ts). `gravity` is not used and
  //     may be absent; the on-disk value is preserved, not stripped, if the
  //     edge was previously catmull-rom-routed.
  //   - any other routing style (straight / absent / bezier): ignored, but
  //     preserved so switching routing away and back is lossless.
  // Absent/empty means the routing style's own unbent default between the
  // two endpoints.
  points?: LinePoint[]
}
