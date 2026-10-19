// v1 diagram file schema. See docs/decisions/0003-diagram-persistence-v1.md —
// later work adds fields here (style, details, linkedDiagram) additively,
// not as a rewrite. `size`/`rotation` (see ADR 0004), `icons` (see ADR 0006).

export type IconRef = { source: 'builtin'; id: string } | { source: 'custom'; path: string }

export type IconSlot = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

// Beyond the 4 default centered points (one per side, always present,
// never removable, never stored explicitly). `offset` is a
// 0-1 fraction along that side, not a pixel value, so a point survives
// resize without recomputing anything.
export type ConnectionPointSide = 'top' | 'right' | 'bottom' | 'left'

export interface ConnectionPoint {
  id: string
  side: ConnectionPointSide
  offset: number
}

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

// Tag/metadata schema — see ADR 0022 (supersedes ADR 0009). One
// `metadata` bag per node/edge, entries either free (human-added, `lock`
// absent) or diagram-required (see `RequiredTagDefinition` below).
// `lockedEditable`: diagram-required, key can't be removed, value can
// still be filled in/edited by a human. `lockedStatic`: diagram-required,
// fixed, not editable at all. Never used for a free entry — that's what
// `lock` being absent already means.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type MetadataLock = 'lockedEditable' | 'lockedStatic'
export interface MetadataEntry {
  value: JsonValue
  lock?: MetadataLock
}

// Diagram-level template: what every applicable element (entity/container/
// edge, not text — see ADR 0022) must carry. Not stored per
// element; used to seed new elements and to retroactively backfill
// existing ones when the template itself changes (see Canvas.tsx's
// `syncRequiredTags`).
export interface RequiredTagDefinition {
  key: string
  allowedValues?: string[]
  defaultValue?: JsonValue
  lock: MetadataLock
}

// Highlight catalog — see ADR 0025/ADR 0026. Each entry pairs an exact
// metadata key=value match with a display color. Deliberately no
// `enabled` field here: whether a given highlight is currently toggled on
// is session-only state, never persisted (ADR 0025's "split persistence"
// decision) — a reopened/shared file always starts with every highlight
// off, even though the catalog itself is shared.
export interface HighlightDefinition {
  key: string
  value: JsonValue
  color: string
}

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

export interface DiagramNode {
  id: string
  // 'entity' (resizable, connectable, never rotated) | 'text' (resizable,
  // rotatable, never connectable) | 'container' (resizable, connectable,
  // never rotated, can parent other nodes) | 'line' (a freeform curved
  // line, see ADR 0050 — position/size are the bounding box of data.points,
  // never connectable, never rotated) — see ADR 0004, ADR 0012. Kept as a
  // plain string, not a union, since more types may arrive later.
  type?: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  // Stacking order — see ADR 0035. Higher renders on top. No
  // type-based special-casing anywhere that reads this: the "containers
  // render behind entities" look most diagrams start with is just a
  // consequence of the backfilled starting values (containers seeded low,
  // entities/text seeded high), not a rule enforced on top of this field.
  // Absent means "never touched by the layer panel" — see Canvas.tsx's
  // load-time backfill for how an old file gets real values on first open.
  zIndex?: number
  // Only 'entity' nodes are connectable, so only they meaningfully have
  // this — same reasoning as size/rotation being optional. Absent/empty
  // means "just the 4 default points," not "no connection points at all."
  connectionPoints?: ConnectionPoint[]
  // Another node's id — this node is a child of that container, and
  // `position` is relative to the parent's origin, not the canvas's. See
  // ADR 0012. Absent means top-level (no container).
  parentId?: string
  // Blocks drag/resize/rotate and accidental delete via this app's own UI
  // — not a read-only mode, every other edit (style, tags, label,
  // connection points, details) stays allowed. Not meaningful on edges (no
  // position of their own to accidentally relocate). Absent means unlocked.
  locked?: boolean
  style?: NodeStyle
  // Only 'entity'/'container' meaningfully have this — see ADR 0022.
  // 'text' and 'line' nodes never get seeded or edited here.
  metadata?: Record<string, MetadataEntry>
  data: {
    label: string
    icons?: Partial<Record<IconSlot, IconRef>>
    details?: string
    linkedDiagram?: string
    // 'line' nodes only — see LinePoint/ADR 0050. Node-local coordinates
    // (relative to `position`, like a container child's own position),
    // ordered — array position is the only thing that identifies a point,
    // there is no separate id.
    points?: LinePoint[]
    // Reference images (see ADR 0069) — 'entity'/'container' only.
    // Ordered list of relative paths (from this diagram file's own dir,
    // same convention as `details`) to files under the sibling
    // assets/references/ folder. Pure working aid: shown only in floating
    // viewer panels the user opens/closes, never rendered on the canvas
    // and never included in exports. Absent/empty means none.
    references?: string[]
    // Threat/risk assessment for this element — see ADR 0082 (implements
    // ADR 0055). 'entity' nodes only. A sparse map keyed by
    // SecurityThreat.id (the diagram-level catalog in DiagramFile.security):
    // an entry exists only once that (entity, threat) pair has actually
    // been assessed. An entity carries this only while it's a member of
    // DiagramFile.security.matrixEntityIds; a missing cell for a member
    // pair is "not yet assessed" and drives the matrix's completeness
    // alert. Absent/empty means this entity isn't in the security matrix.
    security?: Record<string, RiskCell>
  }
}

// One (entity, threat) risk assessment — unchanged from the earlier
// prototype, now part of the persisted schema (ADR 0082). `probability`
// and `consequence` are values on the diagram's probability/consequence
// scales (DiagramSecurity below; absent scales mean the app's built-in
// 1-5). The two notes are independent free-text rationales — the reasoning
// for "why this probability" and "why this consequence" are usually
// unrelated, and both are optional.
export interface RiskCell {
  probability: number
  consequence: number
  probabilityNote?: string
  consequenceNote?: string
}

// One threat in a diagram's threat catalog (DiagramSecurity.threats).
// Id-keyed like every other catalog in this schema, so renaming a threat
// is display-only and never touches per-element data.
export interface SecurityThreat {
  id: string
  name: string
  description?: string
}

// One level of a probability or consequence scale — supersedes the earlier
// prototype's `ScaleLevel`.
export interface SecurityScaleLevel {
  value: number
  label: string
  description: string
}

// How a probability/consequence pair becomes one cell score, and how a
// list of cell scores becomes one row/column summary — see
// threatMatrixMath.ts for the actual arithmetic. NOT persisted: since
// ADR 0088 (recursive rollup) these are renderer session state on the
// active matrix view, applied uniformly down a linked-diagram tree; a
// per-file mode would be either ignored or inconsistent once a traversal
// spans files. Defaults 'multiply' / 'average'.
export type CombineMethod = 'multiply' | 'add' | 'average'
export type AggregateMethod = 'average' | 'sum' | 'max'

// Diagram-level security/threat configuration — see ADR 0082. Absent means
// the diagram has never used the Security Matrix (no `data.security` on any
// node either). Same "absent means unused" convention as `requiredTags` /
// `highlights` / `legend` / `gravityPresets` / `edgeDirectionSets`.
export interface DiagramSecurity {
  // The threat catalog — matrix row candidates. Ordered (row order). The
  // matrix's data model spans EVERY threat here, shown or hidden.
  threats: SecurityThreat[]
  // Subset of `threats` (by id) currently not shown as a matrix row. Still
  // part of the data model — hidden threats still need assessments for the
  // completeness alert to clear. Absent/empty means all threats shown.
  hiddenThreatIds?: string[]
  // The matrix's data model on the entity axis: ids of 'entity' nodes being
  // assessed. Ordered (column order). An entity NOT listed here has no
  // `data.security` at all. Ids that no longer resolve to a Entity node are
  // pruned on load.
  matrixEntityIds: string[]
  // Subset of `matrixEntityIds` (by id) currently not shown as a matrix
  // column. Data kept, still counts toward completeness. Absent/empty
  // means all shown.
  hiddenEntityIds?: string[]
  // Per-diagram scale definitions. Absent means the app's built-in 1-5
  // scales (see threatMatrixScale.ts) — same Diagram-value-or-built-in
  // pattern as gravityPresets (ADR 0052). No in-app editor in v1; the
  // fields persist and are read.
  probabilityScale?: SecurityScaleLevel[]
  consequenceScale?: SecurityScaleLevel[]
  // combineMethod / aggregateMethod are deliberately NOT here — they are
  // renderer session state, not persisted (ADR 0088). A file written by an
  // older build may still carry them; they are ignored on read.
}

// A freeform line's own bend points (see ADR 0050) — see NodeStyle
// for the line's stroke/dash/marker styling, kept separate from geometry.
export interface LinePoint {
  x: number
  y: number
  // Per-point Catmull-Rom tension, see bendablePath.ts for the actual
  // curve math. Absent means 0.5 (a smooth pass-through curve — the
  // standard uniform-tension Catmull-Rom default). 0 gives a sharp corner
  // (zero tangent); higher values bend/bulge more.
  gravity?: number
}

// Named gravity values offered on a line point's right-click menu — a
// diagram-level catalog (like `highlights`/`legend`), not a hardcoded app
// constant, because a specific diagram's layout may call for its own bend
// values, and any reader reproducing the diagram needs those same named
// options available, not just this app's own built-in defaults. Absent/
// empty on `DiagramFile.gravityPresets` means "use this app's own built-in
// four" (see lineGravityPresets.ts) — a fresh diagram doesn't need to spell
// those out explicitly, same "absent means default" convention as
// everywhere else in this schema.
export interface GravityPreset {
  id: string
  label: string
  value: number
}

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

// Recursively sorts object keys alphabetically — applied to metadata dicts
// specifically (see ADR 0022's Determinism note, carried over from ADR
// 0009), so a bucket entry's own nested object values also get consistent
// key order, not just the top level. Arrays keep their existing element
// order (position is meaningful there); only plain-object keys get sorted.
function sortKeysDeep<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => sortKeysDeep(v)) as T
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, JsonValue> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, JsonValue>)[key])
    }
    return sorted as T
  }
  return value
}

// Fixed key order for an EdgeDirectionSet's default style (ADR 0083);
// dropped entirely when it carries nothing. Also accepts (and up-converts)
// the pre-ADR-0083 `legend` shape, so a file that never passed through the
// renderer's load migration still serializes cleanly.
function sortedDirectionSetStyle(set: EdgeDirectionSet): EdgeDirectionSetStyle | undefined {
  const legacy = (set as { legend?: EdgeDirectionSetLegend }).legend
  const style: EdgeDirectionSetStyle | undefined =
    set.style ??
    (legacy
      ? {
          stroke: legacy.color,
          lineStyle: legacy.lineStyle,
          startMarker: legacy.startMarker,
          endMarker: legacy.endMarker
        }
      : undefined)
  if (!style) return undefined
  const { stroke, strokeWidth, strokeOpacity, lineStyle, startMarker, endMarker } = style
  if (
    stroke === undefined &&
    strokeWidth === undefined &&
    strokeOpacity === undefined &&
    lineStyle === undefined &&
    startMarker === undefined &&
    endMarker === undefined
  ) {
    return undefined
  }
  return { stroke, strokeWidth, strokeOpacity, lineStyle, startMarker, endMarker }
}

// Deterministic per-edge directionSets: set ids in sorted order, each
// EdgeDirection with a fixed key order (undefined handles dropped by
// JSON.stringify). Only emitted when the diagram actually has >= 2 sets.
function sortedDirectionSets(
  directionSets: Record<string, EdgeDirection> | undefined,
  hasMultipleSets: boolean
): Record<string, EdgeDirection> | undefined {
  if (!hasMultipleSets || !directionSets || Object.keys(directionSets).length === 0) {
    return undefined
  }
  const sorted: Record<string, EdgeDirection> = {}
  for (const key of Object.keys(directionSets).sort()) {
    const d = directionSets[key]
    sorted[key] = {
      source: d.source,
      target: d.target,
      sourceHandle: d.sourceHandle,
      targetHandle: d.targetHandle
    }
  }
  return sorted
}

// Fixed key order for one RiskCell; notes dropped when blank.
function orderedRiskCell(cell: RiskCell): RiskCell {
  return {
    probability: cell.probability,
    consequence: cell.consequence,
    probabilityNote: cell.probabilityNote || undefined,
    consequenceNote: cell.consequenceNote || undefined
  }
}

// A node's `data.security` map — threat ids sorted, each cell key-ordered.
// Dropped entirely when empty or on a non-'entity' node (ADR 0082: sparse
// storage, entities only).
function sortedNodeSecurity(
  security: Record<string, RiskCell> | undefined,
  nodeType: string | undefined
): Record<string, RiskCell> | undefined {
  if (nodeType !== 'entity' || !security || Object.keys(security).length === 0) return undefined
  const sorted: Record<string, RiskCell> = {}
  for (const key of Object.keys(security).sort()) sorted[key] = orderedRiskCell(security[key])
  return sorted
}

// The diagram-level `security` block — deterministic key order, ordered
// arrays kept as-is (threats/matrixEntityIds order is meaningful), hidden id
// lists sorted, empty optional pieces dropped. Emitted only when it carries
// something (ADR 0082).
function orderedDiagramSecurity(
  security: DiagramSecurity | undefined
): DiagramSecurity | undefined {
  if (!security) return undefined
  if (security.threats.length === 0 && security.matrixEntityIds.length === 0) return undefined
  const hiddenThreatIds =
    security.hiddenThreatIds && security.hiddenThreatIds.length > 0
      ? [...security.hiddenThreatIds].sort()
      : undefined
  const hiddenEntityIds =
    security.hiddenEntityIds && security.hiddenEntityIds.length > 0
      ? [...security.hiddenEntityIds].sort()
      : undefined
  return {
    threats: security.threats.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined
    })),
    hiddenThreatIds,
    matrixEntityIds: security.matrixEntityIds,
    hiddenEntityIds,
    probabilityScale:
      security.probabilityScale && security.probabilityScale.length > 0
        ? security.probabilityScale.map((l) => ({
            value: l.value,
            label: l.label,
            description: l.description
          }))
        : undefined,
    consequenceScale:
      security.consequenceScale && security.consequenceScale.length > 0
        ? security.consequenceScale.map((l) => ({
            value: l.value,
            label: l.label,
            description: l.description
          }))
        : undefined
    // combineMethod / aggregateMethod are session-only, never serialized (ADR 0088).
  }
}

function sortedMetadata(
  metadata: Record<string, MetadataEntry> | undefined
): Record<string, MetadataEntry> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined
  const sorted: Record<string, MetadataEntry> = {}
  for (const key of Object.keys(metadata).sort()) {
    const entry = metadata[key]
    sorted[key] = entry.lock
      ? { value: sortKeysDeep(entry.value), lock: entry.lock }
      : { value: sortKeysDeep(entry.value) }
  }
  return sorted
}

// Fixed key order on every object built here is what makes JSON.stringify's
// output deterministic — see the ADR for why this matters for git diffs.
// Optional fields left `undefined` are dropped by JSON.stringify, so nodes
// without a size/rotation/icons set don't grow noisy keys in the saved file.
export function serializeDiagram(diagram: DiagramFile): string {
  // Edge direction sets (ADR 0081): the registry + active pointer are
  // written from the first set (a single set names the current reading and
  // adds a legend row). Per-edge `directionSets` records are only written
  // at 2+ sets — with one set an edge's direction is just its own
  // source/target/handles.
  const hasDirectionSets = !!diagram.edgeDirectionSets && diagram.edgeDirectionSets.length >= 1
  const hasMultipleDirectionSets =
    !!diagram.edgeDirectionSets && diagram.edgeDirectionSets.length >= 2
  const ordered: DiagramFile = {
    version: diagram.version,
    savedWith: diagram.savedWith,
    metadata:
      diagram.metadata && Object.keys(diagram.metadata).length > 0
        ? (sortKeysDeep(diagram.metadata) as Record<string, JsonValue>)
        : undefined,
    requiredTags:
      diagram.requiredTags && diagram.requiredTags.length > 0 ? diagram.requiredTags : undefined,
    highlights:
      diagram.highlights && diagram.highlights.length > 0 ? diagram.highlights : undefined,
    legend: diagram.legend && diagram.legend.length > 0 ? diagram.legend : undefined,
    gravityPresets:
      diagram.gravityPresets && diagram.gravityPresets.length > 0
        ? diagram.gravityPresets
        : undefined,
    maxConnectionPointsPerSide: diagram.maxConnectionPointsPerSide,
    edgeDirectionSets: hasDirectionSets
      ? diagram.edgeDirectionSets!.map((s) => ({
          id: s.id,
          name: s.name,
          style: sortedDirectionSetStyle(s)
        }))
      : undefined,
    activeEdgeDirectionSetId: hasDirectionSets ? diagram.activeEdgeDirectionSetId : undefined,
    security: orderedDiagramSecurity(diagram.security),
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.size ? { width: n.size.width, height: n.size.height } : undefined,
      rotation: n.rotation,
      zIndex: n.zIndex,
      connectionPoints:
        n.connectionPoints && n.connectionPoints.length > 0 ? n.connectionPoints : undefined,
      parentId: n.parentId,
      locked: n.locked,
      style: n.style,
      metadata: sortedMetadata(n.metadata),
      data: {
        label: n.data.label,
        icons: n.data.icons && Object.keys(n.data.icons).length > 0 ? n.data.icons : undefined,
        details: n.data.details,
        linkedDiagram: n.data.linkedDiagram,
        points: n.data.points && n.data.points.length > 0 ? n.data.points : undefined,
        // NB: `references` was missing here until 2026-09-01 — a 5th
        // instance of the serialize-picklist gap (see known-issues.md),
        // found while adding `security`. Both added together.
        references:
          n.data.references && n.data.references.length > 0 ? n.data.references : undefined,
        security: sortedNodeSecurity(n.data.security, n.type)
      }
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      style: e.style,
      metadata: sortedMetadata(e.metadata),
      points: e.points && e.points.length > 0 ? e.points : undefined,
      directionSets: sortedDirectionSets(e.directionSets, hasMultipleDirectionSets)
    }))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

// Legacy field/value names from before the Shape -> Entity rename — accepted on
// load so a file saved before the rename keeps opening
// unmodified, never written. serializeDiagram always emits the current
// names, so a loaded-then-saved file silently upgrades itself. Remove once
// no file predating the rename is expected to still be opened. Three spots
// carried 'shape': a node's own `type`, a legend entry's `kind`, and
// DiagramSecurity's matrix-membership id lists.
function normalizeLegacyFields(diagram: DiagramFile): DiagramFile {
  const hasLegacyNodeType = diagram.nodes.some((n) => (n.type as string | undefined) === 'shape')
  const nodes = hasLegacyNodeType
    ? diagram.nodes.map((n) =>
        (n.type as string | undefined) === 'shape' ? { ...n, type: 'entity' } : n
      )
    : diagram.nodes

  const hasLegacyLegendKind = diagram.legend?.some((entry) => (entry.kind as string) === 'shape')
  const legend = hasLegacyLegendKind
    ? diagram.legend!.map((entry) =>
        (entry.kind as string) === 'shape' ? { ...entry, kind: 'entity' as const } : entry
      )
    : diagram.legend

  const legacySecurity = diagram.security as
    (DiagramSecurity & { matrixShapeIds?: string[]; hiddenShapeIds?: string[] }) | undefined
  const hasLegacySecurityIds = !!(legacySecurity?.matrixShapeIds || legacySecurity?.hiddenShapeIds)
  const security = hasLegacySecurityIds
    ? (() => {
        // Destructure the legacy keys out rather than spreading them
        // through — `rest` carries only current-shape fields, so the
        // normalized object never leaks the old names back into memory.
        const { matrixShapeIds, hiddenShapeIds, ...rest } = legacySecurity!
        return {
          ...rest,
          matrixEntityIds: legacySecurity!.matrixEntityIds ?? matrixShapeIds ?? [],
          hiddenEntityIds: legacySecurity!.hiddenEntityIds ?? hiddenShapeIds
        }
      })()
    : diagram.security

  if (!hasLegacyNodeType && !hasLegacyLegendKind && !hasLegacySecurityIds) return diagram
  return {
    ...diagram,
    nodes,
    ...(legend !== undefined ? { legend } : {}),
    ...(security ? { security } : {})
  }
}

// Deliberately no metadata/requiredTags-specific validation here (see
// ADR 0022) — parseDiagram has never validated the shape of any other optional
// field either (icons, style, connectionPoints, ...), so singling out
// metadata for stricter treatment would be inconsistent rather than more
// correct. A malformed metadata value just flows through as-is; Canvas's
// own sync pass (syncElementMetadata) is what actually reconciles required
// tags against reality, on every file open.
export function parseDiagram(raw: string): DiagramFile {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
    !Array.isArray((parsed as { edges?: unknown }).edges)
  ) {
    throw new Error('Not a recognized diagram.json (expected { version: 1, nodes, edges, ... })')
  }
  return normalizeLegacyFields(parsed as DiagramFile)
}
