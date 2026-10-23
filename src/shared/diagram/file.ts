// v1 diagram file schema. See docs/decisions/0003-diagram-persistence-v1.md —
// later work adds fields here (style, details, linkedDiagram) additively,
// not as a rewrite. `size`/`rotation` (see ADR 0004), `icons` (see ADR 0006).

import type { EdgeDirectionSet, DiagramEdge } from '../edges/schema.ts'
import type { LegendEntry } from '../legend/schema.ts'
import type { DiagramNode, GravityPreset } from '../nodes/schema.ts'
import type { HighlightDefinition, JsonValue, RequiredTagDefinition } from '../tagging/schema.ts'
import type { DiagramSecurity } from '../threat-matrix/schema.ts'

export interface DiagramFile {
  version: 1
  // The version of this app (e.g. "0.2.1") that last wrote the file, so an OLDER
  // app opening it can warn that saving may lose what it does not understand
  // (ADR 0118). Only ever raised: a save by the same or an older app leaves it
  // as it is. Absent in files written before the field existed and in files an
  // AI assistant created; absent means "unknown", which never warns.
  savedWith?: string
  // Camera position (pan/zoom) is deliberately NOT persisted here — it isn't
  // diagram content, and saving it made every save's diff carry an unrelated
  // viewport churn alongside real edits. See ADR 0090. A file written by an
  // older build may still have a `viewport` key at this level; a reader just
  // ignores it.
  // Diagram-level free-form bag — always unlocked, no requiredTags concept
  // at this level (see ADR 0022's Consequences).
  metadata?: Record<string, JsonValue>
  requiredTags?: RequiredTagDefinition[]
  highlights?: HighlightDefinition[]
  // Legend catalog — see ADR 0033. Unlike `highlights`, there is
  // no separate "enabled" concept per entry; the whole panel's shown/hidden
  // state is what's session-local (never stored here), not per-entry.
  legend?: LegendEntry[]
  // See GravityPreset above — absent/empty means "use this app's own
  // built-in four."
  gravityPresets?: GravityPreset[]
  // Per-diagram override for the max connection points allowed on one
  // side of a Entity/Container (see ADR 0067; ADR 0052's Diagram override ->
  // User default -> Built-in default pattern) — absent means fall back to
  // whoever opens this file's own Settings value (AppPreferences.
  // maxConnectionPointsPerSide). A real constraint on what the diagram
  // can contain, not just a display preference — see the ADR for why this
  // couldn't stay Settings-only. Lowering it below what an existing
  // element already has never clamps that element; the limit only stops
  // *adding* more points, same "never silently destroy data" convention
  // as the rest of this format.
  maxConnectionPointsPerSide?: number
  // The font every label in the diagram is drawn in unless the element sets its own (ADR 0130).
  // A raw CSS font-family value, like NodeStyle.fontFamily. Absent means the opening app's own
  // personal default, then the built-in font.
  fontFamily?: string
  // Named readings of the diagram's edges that differ only in arrow
  // direction — see ADR 0081 and EdgeDirectionSet above. Absent/empty means
  // the feature is unused. A single set names the current reading, adds a
  // legend row, and seeds the style of edges drawn while it is active;
  // per-edge `directionSets` records and the base-orientation rule only
  // apply at 2+ sets. Order matters: [0] is the "base" set whose
  // orientation the edges are stored in on disk.
  edgeDirectionSets?: EdgeDirectionSet[]
  // Which set of `edgeDirectionSets` is currently displayed. The on-disk
  // edges are always in the base ([0]) set's orientation regardless; this
  // only picks which reading to apply on load. Absent means the base set.
  activeEdgeDirectionSetId?: string
  // Threat/risk model — see ADR 0082 and DiagramSecurity above. Absent
  // means the Security Matrix has never been used for this diagram.
  security?: DiagramSecurity
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export function createEmptyDiagram(): DiagramFile {
  return { version: 1, nodes: [], edges: [] }
}
