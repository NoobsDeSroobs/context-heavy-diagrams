// v1 diagram file schema. See docs/decisions/0003-diagram-persistence-v1.md —
// later epics add fields here (style, details, linkedDiagram) additively,
// not as a rewrite. `size`/`rotation` added in epic 0002 (see ADR 0004),
// `icons` added in epic 0007 (see ADR 0006).

export type IconRef = { source: 'builtin'; id: string } | { source: 'custom'; path: string }

export type IconSlot = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

// Beyond the 4 default centered points (one per side, always present,
// never removable, never stored explicitly) — see epic 0013. `offset` is a
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
  // 'line' nodes only (epic 0064/ADR 0050) — same fields/vocabulary as
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
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type MetadataLock = 'lockedEditable' | 'lockedStatic'
export interface MetadataEntry {
  value: JsonValue
  lock?: MetadataLock
}

// Diagram-level template: what every applicable element (shape/container/
// edge, not text/anchor — see epic 0034) must carry. Not stored per
// element; used to seed new elements and to retroactively backfill
// existing ones when the template itself changes (see Canvas.tsx's
// `syncRequiredTags`).
export interface RequiredTagDefinition {
  key: string
  allowedValues?: string[]
  defaultValue?: JsonValue
  lock: MetadataLock
}

// Highlight catalog — see epic 0026/ADR 0025. Each entry pairs an exact
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

// Legend catalog — see epic 0037/ADR 0033. Each entry explains one visual
// convention the diagram author deliberately used, in the author's own
// words — never auto-derived from `highlights` or anything else. `color`
// only applies to 'line'/'shape' kinds: this app's icons are fixed
// multi-color bundled/custom assets, not tintable, so an 'icon' entry
// carries no color at all (see the epic's Decided section for why a
// background chip was also rejected — same ambiguity as a colored box).
export type LegendEntryKind = 'line' | 'icon' | 'shape'
export interface LegendEntry {
  id: string
  kind: LegendEntryKind
  label: string
  // 'line' and 'shape' kinds only.
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
  // behavior, the path midpoint) — see epic 0045.
  labelPosition?: number
}

export interface DiagramNode {
  id: string
  // 'shape' (resizable, connectable, never rotated) | 'text' (resizable,
  // rotatable, never connectable) | 'container' (resizable, connectable,
  // never rotated, can parent other nodes) | 'line' (a freeform curved
  // line, see ADR 0050 — position/size are the bounding box of data.points,
  // never connectable, never rotated) — see ADR 0004, ADR 0012. Kept as a
  // plain string, not a union, since more types may arrive later.
  type?: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  // Stacking order — see epic 0043/ADR 0035. Higher renders on top. No
  // type-based special-casing anywhere that reads this: the "containers
  // render behind shapes" look most diagrams start with is just a
  // consequence of the backfilled starting values (containers seeded low,
  // shapes/text seeded high), not a rule enforced on top of this field.
  // Absent means "never touched by the layer panel" — see Canvas.tsx's
  // load-time backfill for how an old file gets real values on first open.
  zIndex?: number
  // Only 'shape' nodes are connectable, so only they meaningfully have
  // this — same reasoning as size/rotation being optional. Absent/empty
  // means "just the 4 default points," not "no connection points at all."
  connectionPoints?: ConnectionPoint[]
  // Another node's id — this node is a child of that container, and
  // `position` is relative to the parent's origin, not the canvas's. See
  // ADR 0012. Absent means top-level (no container).
  parentId?: string
  // Blocks drag/resize/rotate and accidental delete via this app's own UI
  // — not a read-only mode, every other edit (style, tags, label,
  // connection points, details) stays allowed. Not meaningful on 'anchor'
  // (transient, never persists as a real element) or edges (no position
  // of their own to accidentally relocate). Absent means unlocked.
  locked?: boolean
  style?: NodeStyle
  // Only 'shape'/'container' meaningfully have this — see epic 0034/ADR
  // 0022. 'text', 'anchor', and 'line' nodes never get seeded or edited here.
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
  }
}

// A freeform line's own bend points (epic 0064/ADR 0050) — see NodeStyle
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

export interface DiagramEdge {
  id: string
  // 'labeled' — see epic 0012. Plain string, same reasoning as DiagramNode.type.
  type?: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  style?: EdgeStyle
  metadata?: Record<string, MetadataEntry>
}

export interface DiagramFile {
  version: 1
  viewport: { x: number; y: number; zoom: number }
  // Diagram-level free-form bag — always unlocked, no requiredTags concept
  // at this level (see ADR 0022's Consequences).
  metadata?: Record<string, JsonValue>
  requiredTags?: RequiredTagDefinition[]
  highlights?: HighlightDefinition[]
  // Legend catalog — see epic 0037/ADR 0033. Unlike `highlights`, there is
  // no separate "enabled" concept per entry; the whole panel's shown/hidden
  // state is what's session-local (never stored here), not per-entry.
  legend?: LegendEntry[]
  // See GravityPreset above — absent/empty means "use this app's own
  // built-in four."
  gravityPresets?: GravityPreset[]
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export function createEmptyDiagram(): DiagramFile {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] }
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

function sortedMetadata(
  metadata: Record<string, MetadataEntry> | undefined
): Record<string, MetadataEntry> | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined
  const sorted: Record<string, MetadataEntry> = {}
  for (const key of Object.keys(metadata).sort()) {
    const entry = metadata[key]
    sorted[key] = entry.lock ? { value: sortKeysDeep(entry.value), lock: entry.lock } : { value: sortKeysDeep(entry.value) }
  }
  return sorted
}

// Fixed key order on every object built here is what makes JSON.stringify's
// output deterministic — see the ADR for why this matters for git diffs.
// Optional fields left `undefined` are dropped by JSON.stringify, so nodes
// without a size/rotation/icons set don't grow noisy keys in the saved file.
export function serializeDiagram(diagram: DiagramFile): string {
  const ordered: DiagramFile = {
    version: diagram.version,
    viewport: { x: diagram.viewport.x, y: diagram.viewport.y, zoom: diagram.viewport.zoom },
    metadata: diagram.metadata && Object.keys(diagram.metadata).length > 0
      ? (sortKeysDeep(diagram.metadata) as Record<string, JsonValue>)
      : undefined,
    requiredTags: diagram.requiredTags && diagram.requiredTags.length > 0 ? diagram.requiredTags : undefined,
    highlights: diagram.highlights && diagram.highlights.length > 0 ? diagram.highlights : undefined,
    legend: diagram.legend && diagram.legend.length > 0 ? diagram.legend : undefined,
    gravityPresets:
      diagram.gravityPresets && diagram.gravityPresets.length > 0 ? diagram.gravityPresets : undefined,
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
        points: n.data.points && n.data.points.length > 0 ? n.data.points : undefined
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
      metadata: sortedMetadata(e.metadata)
    }))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

// Deliberately no metadata/requiredTags-specific validation here (epic
// 0034) — parseDiagram has never validated the shape of any other optional
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
  return parsed as DiagramFile
}
