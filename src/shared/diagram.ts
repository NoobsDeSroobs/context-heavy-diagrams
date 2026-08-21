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
  // never rotated, can parent other nodes) — see ADR 0004, ADR 0012. Kept
  // as a plain string, not a union, since more types may arrive later.
  type?: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  // Only 'shape' nodes are connectable, so only they meaningfully have
  // this — same reasoning as size/rotation being optional. Absent/empty
  // means "just the 4 default points," not "no connection points at all."
  connectionPoints?: ConnectionPoint[]
  // Another node's id — this node is a child of that container, and
  // `position` is relative to the parent's origin, not the canvas's. See
  // ADR 0012. Absent means top-level (no container).
  parentId?: string
  style?: NodeStyle
  // Only 'shape'/'container' meaningfully have this — see epic 0034/ADR
  // 0022. 'text' and 'anchor' nodes never get seeded or edited here.
  metadata?: Record<string, MetadataEntry>
  data: {
    label: string
    icons?: Partial<Record<IconSlot, IconRef>>
    details?: string
    linkedDiagram?: string
  }
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
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.size ? { width: n.size.width, height: n.size.height } : undefined,
      rotation: n.rotation,
      connectionPoints:
        n.connectionPoints && n.connectionPoints.length > 0 ? n.connectionPoints : undefined,
      parentId: n.parentId,
      style: n.style,
      metadata: sortedMetadata(n.metadata),
      data: {
        label: n.data.label,
        icons: n.data.icons && Object.keys(n.data.icons).length > 0 ? n.data.icons : undefined,
        details: n.data.details,
        linkedDiagram: n.data.linkedDiagram
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
