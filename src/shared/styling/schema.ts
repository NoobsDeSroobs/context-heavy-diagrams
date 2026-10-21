// Style schema — see ADR 0014. One `style` bag per node, one per edge;
// absent means "current hardcoded look," same as every other optional
// field. `MarkerKind`/`LineStyleKind` are deliberately shape-described
// ("arrowOpen", "crowsFootMany"), not notation-named — see ADR 0014's Notes
// for why the naming-system question is deliberately kept out of the schema.
export interface FontStyle {
  fontSize?: number
  fontColor?: string
  fontWeight?: 'normal' | 'bold'
  // Raw CSS font-family value — same "store the render value directly"
  // approach as `fill`/`stroke`, not a semantic enum. ADR 0014's original
  // pass omitted a font-family field entirely; added after-the-fact to
  // close that gap. The property panel currently only offers generic CSS
  // families (sans-serif/serif/monospace/cursive) since a specific named
  // font isn't reliably available on both of this app's target platforms
  // (Windows/Linux) — but the field itself is a plain string precisely so
  // curated specific fonts can be added to the picker later without a
  // schema change.
  fontFamily?: string
  // 0-100, not CSS's native 0-1 — reads more directly as "50%" in a
  // hand-edited file, matching this schema's existing precedent of picking
  // whichever unit is clearest for a human over blindly mirroring the
  // underlying CSS property (see ConnectionPoint's `offset`). Absent means
  // 100 (fully opaque). Per-channel, not one whole-element opacity — a
  // first pass added a single `opacity` field, but that couples "how faded
  // is the text" to "how faded is the fill," which isn't how most people
  // want to fade a shape (e.g. a solid fill behind translucent-feeling
  // text). Rendered via CSS color-mix(), not the `opacity` CSS property.
  fontOpacity?: number
}

export interface NodeStyle extends FontStyle {
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeOpacity?: number
  strokeWidth?: number
  textAlign?: 'start' | 'center' | 'end'
  // 'line' nodes only (see ADR 0050) — same fields/vocabulary as
  // EdgeStyle's, added here rather than making DiagramNode.style a union,
  // same precedent as LegendEntry's own 'line' kind.
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}

export type LineStyleKind = 'solid' | 'dashed' | 'dotted'
export type MarkerKind =
  | 'none'
  | 'arrowOpen'
  | 'arrowClosed'
  | 'circle'
  | 'circleFilled'
  | 'diamond'
  | 'diamondFilled'
  | 'crowsFootOne'
  | 'crowsFootMany'
  | 'crowsFootOneOrMany'
  | 'crowsFootZeroOrOne'
  | 'crowsFootZeroOrMany'

export interface EdgeStyle extends FontStyle {
  stroke?: string
  strokeOpacity?: number
  strokeWidth?: number
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
  // 0-1 fraction along the rendered path, same convention as
  // ConnectionPoint's `offset` — stays meaningful if the edge's endpoints
  // move, unlike a fixed pixel offset. Absent means 0.5 (today's only
  // behavior, the path midpoint) — see ADR 0045.
  labelPosition?: number
  // How the path is routed between the two endpoints — see ADR 0057.
  // 'straight'/'step'/'smoothstep' are React Flow's own built-in path
  // entities; 'catmullRom' reuses the freeform-line curve math (ADR 0050,
  // bendablePath.ts) with DiagramEdge.points as manual bend
  // points. Absent means today's only behavior, a plain bezier
  // (React Flow's default, plus the edgeStraightSegmentLength lead-in/out
  // setting) — kept as the omitted default rather than an explicit
  // `'bezier'` value, same "absent means current hardcoded look"
  // convention as every other style field.
  routingStyle?: 'straight' | 'step' | 'smoothstep' | 'catmullRom'
}
