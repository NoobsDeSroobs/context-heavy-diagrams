import type { Edge, Node } from '@xyflow/react'
import {
  CONTAINER_BASE,
  ENTITY_BASE,
  TEXT_BASE,
  backfillZIndex,
  nextZIndexAbove
} from '@shared/canvas/zIndexOrdering'

// A 'line' node's bounding box is often much larger than its (possibly concave) curve; see ADR
// 0050's addendum. pointerEvents: 'none' makes the whole box click-through, and LineNode.tsx
// re-enables pointer events on its hit-stroke path and point handles (CSS pointer-events is
// overridable per descendant), so only the curve and its points stay interactive, like an edge near
// its own path.
function needsLineStyleFix(n: Node): boolean {
  return n.type === 'line' && (n.style as React.CSSProperties | undefined)?.pointerEvents !== 'none'
}

// Maps locked (data.locked, see docs/file-format.md) onto React Flow's per-node draggable/deletable
// overrides, and zIndex (ADR 0035) onto its own field. selectable is left alone on purpose: a
// locked node must stay selectable and highlightable.
//
// Pure: returns `n` itself when every derived field already matches (the common case), a new object
// only when something changes. CanvasInner's materializing effect relies on that to keep unrelated
// nodes' identity stable across renders, which matters on a large diagram.
export function deriveNodeFields(n: Node): Node {
  const zIndex = (n.data?.zIndex as number | undefined) ?? 0
  const draggable = n.data?.locked !== true
  const deletable = n.data?.locked !== true
  if (
    n.zIndex === zIndex &&
    n.draggable === draggable &&
    n.deletable === deletable &&
    !needsLineStyleFix(n)
  ) {
    return n
  }
  return {
    ...n,
    zIndex,
    draggable,
    deletable,
    ...(needsLineStyleFix(n) ? { style: { ...n.style, pointerEvents: 'none' as const } } : {})
  }
}

// An edge's own zIndex isn't derivable from the edge alone — it depends on
// its endpoints' current zIndex (see zIndexOrdering's SELECTED_EDGE_Z_BOOST
// comment) — so unlike deriveNodeFields this takes the already-resolved
// value as a plain param rather than recomputing it itself. Same "return
// `e` itself when nothing changed" contract otherwise. (Hover used to be
// materialized here too; it's per-edge local state in LabeledEdge now —
// ADR 0073.)
export function deriveEdgeFields(e: Edge, zIndex: number): Edge {
  if (e.zIndex === zIndex) return e
  return { ...e, zIndex }
}

// Ids are the type prefix plus a random UUID suffix. A per-session counter (entity-1, entity-2,
// ...) restarts at 1 every session, so adding an entity to a loaded file that already had
// "entity-1" silently overwrote it; a UUID makes that collision impossible without coordination on
// any load path. The readable prefix stays because the file format is meant to be git-diff-friendly
// and human-debuggable.
export function newNodeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// Adapter between React Flow's Node shape (zIndex lives in data.zIndex) and
// zIndexOrdering.ts's plain, React-Flow-agnostic ZIndexed shape — see
// ADR 0035. Only touches nodes that actually needed a value; a fully
// backfilled array is returned as-is (same node references, no new objects)
// so this is a safe no-op to call on every load.
export function applyZIndexBackfill(nodes: Node[]): Node[] {
  const extracted = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    zIndex: n.data?.zIndex as number | undefined
  }))
  const backfilled = backfillZIndex(extracted)
  if (backfilled === extracted) return nodes
  return nodes.map((n, i) =>
    backfilled[i].zIndex === n.data?.zIndex
      ? n
      : { ...n, data: { ...n.data, zIndex: backfilled[i].zIndex } }
  )
}

// Same data.zIndex extraction as applyZIndexBackfill, for a freshly created node (ADR 0035). "Above
// everything" is scoped to the node's own tier (CONTAINER_BASE/ENTITY_BASE/TEXT_BASE), so a new
// node lands inside its tier like the backfilled default: behind entities if it's a container,
// above them if it's text. Scoping to every node regardless of type, with no tier floor, put a
// fresh diagram's first entity or container at 10 or 20 (see docs/known-issues.md).
export function nextZIndex(nodes: Node[], type: 'entity' | 'text' | 'container' | 'line'): number {
  const base = type === 'container' ? CONTAINER_BASE : type === 'text' ? TEXT_BASE : ENTITY_BASE
  const scoped = nodes.filter((n) => n.type === type)
  return nextZIndexAbove(
    scoped.map((n) => ({ id: n.id, zIndex: n.data?.zIndex as number | undefined })),
    base
  )
}

// Only entity/container nodes and edges meaningfully carry metadata — see
// ADR 0022. Kept as a helper since both toDiagramFile and the metadata-only
// node type guard elsewhere need the same "does this node type qualify"
// check.
export function nodeMetadataEligible(type: string | undefined): boolean {
  return type === 'entity' || type === 'container'
}

// Only these two types render ConnectionHandles (see EntityNode/
// ContainerNode) — 'text' and 'line' have no handles at all, so
// a selected one of either can never legitimately be an edge endpoint.
// Used by multi-connection onConnect below to skip a selected node that
// happens not to be connectable, rather than trying to resolve a
// connection point that doesn't exist on it.
export function isConnectableNodeType(type: string | undefined): boolean {
  return type === 'entity' || type === 'container'
}
