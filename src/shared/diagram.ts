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
}

export interface DiagramFile {
  version: 1
  viewport: { x: number; y: number; zoom: number }
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export function createEmptyDiagram(): DiagramFile {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] }
}

// Fixed key order on every object built here is what makes JSON.stringify's
// output deterministic — see the ADR for why this matters for git diffs.
// Optional fields left `undefined` are dropped by JSON.stringify, so nodes
// without a size/rotation/icons set don't grow noisy keys in the saved file.
export function serializeDiagram(diagram: DiagramFile): string {
  const ordered: DiagramFile = {
    version: diagram.version,
    viewport: { x: diagram.viewport.x, y: diagram.viewport.y, zoom: diagram.viewport.zoom },
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
      style: e.style
    }))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

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
