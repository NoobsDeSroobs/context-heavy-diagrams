import type { IconRef, IconSlot } from '../icons/schema.ts'
import type { NodeStyle } from '../styling/schema.ts'
import type { MetadataEntry } from '../tagging/schema.ts'
import type { RiskCell } from '../threat-matrix/schema.ts'

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
