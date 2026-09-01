import type { Edge, Node } from '@xyflow/react'

// Real OS clipboard, not in-app-only state — this app already committed to
// one real BrowserWindow per diagram (ADR 0023), so an in-app
// React-state clipboard couldn't cross windows at all (separate renderer
// processes); the system clipboard makes cross-window/cross-diagram paste
// work for free, and matches what a user already expects from every other
// desktop app. Plain JSON text, not a custom native format — Electron's
// clipboard exposes `writeText`/`readText` directly in the (unsandboxed,
// see main/windows.ts's `sandbox: false`) preload with no IPC round-trip
// needed. The `chdClipboard` marker is what tells "this is our own payload"
// apart from arbitrary text the user copied from somewhere else — an
// unmarked or malformed clipboard is just a silent no-op on paste, never an
// error, same as duplicateSelected's own "nothing selected, do nothing."
export interface ClipboardPayload {
  chdClipboard: true
  version: 1
  nodes: Node[]
  edges: Edge[]
}

// Edges tag along only when *both* endpoints are also being copied — a
// dangling edge with a missing endpoint isn't representable once ids get
// regenerated on paste, and copying "just an edge" alone was never the
// ask ("copy/paste for nodes... edges between copied nodes").
export function buildClipboardPayload(selectedNodes: Node[], allEdges: Edge[]): ClipboardPayload {
  const selectedIds = new Set(selectedNodes.map((n) => n.id))
  const edges = allEdges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
  return { chdClipboard: true, version: 1, nodes: selectedNodes, edges }
}

export function parseClipboardPayload(text: string): ClipboardPayload | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { chdClipboard?: unknown }).chdClipboard === true &&
      Array.isArray((parsed as { nodes?: unknown }).nodes) &&
      Array.isArray((parsed as { edges?: unknown }).edges)
    ) {
      return parsed as ClipboardPayload
    }
    return null
  } catch {
    return null
  }
}

// Regenerates every node/edge id (old id -> new id map built first so
// edges can remap source/target consistently) and repositions the whole
// group as a unit, preserving each node's offset from the group's own
// centroid — so a multi-node copy pastes back in the same relative
// arrangement, just recentered on `center` rather than reusing the
// original absolute position (which could be far outside the current
// viewport, especially pasting into a different diagram entirely — see
// ADR 0049). Connection point ids are left untouched: they're only ever
// looked up in combination with their owning node's id, so two different
// nodes reusing the same point id (e.g. both having a "cp-3") is already
// normal, not a collision.
//
// `parentId` (container nesting, ADR 0012 / ADR 0075): if the node's parent
// container is also in the payload, the link is remapped through `idMap` and
// the child's parent-relative `position` is left untouched (still valid
// relative to the remapped parent). If it isn't — an orphaned child, or a
// cross-diagram paste — `parentId` is stripped and the node becomes a normal
// top-level paste. Only top-level nodes get the centroid recenter; a child's
// position stays relative to its parent.
export function remapForPaste(
  payload: ClipboardPayload,
  newId: (prefix: string) => string,
  center: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>()
  for (const n of payload.nodes) idMap.set(n.id, newId(n.type ?? 'shape'))

  const hasParentInPayload = (n: Node): boolean => n.parentId != null && idMap.has(n.parentId)

  // Centroid over top-level-within-payload nodes only — a contained child's
  // coordinates are parent-relative (small numbers), a different space than a
  // top-level node's, and averaging the two together skews where the group lands.
  const topLevel = payload.nodes.filter((n) => !hasParentInPayload(n))
  const count = topLevel.length || 1
  const centroid = {
    x: topLevel.reduce((sum, n) => sum + n.position.x, 0) / count,
    y: topLevel.reduce((sum, n) => sum + n.position.y, 0) / count
  }

  const nodes = payload.nodes.map((n) => {
    const base = { ...n, id: idMap.get(n.id)!, selected: true, data: { ...n.data } }
    if (hasParentInPayload(n)) {
      return { ...base, parentId: idMap.get(n.parentId!)! }
    }
    // Top-level (or a child whose parent wasn't copied): drop any dangling
    // parentId and recenter on the paste point.
    delete base.parentId
    return {
      ...base,
      position: {
        x: center.x + (n.position.x - centroid.x),
        y: center.y + (n.position.y - centroid.y)
      }
    }
  })

  const edges = payload.edges.map((e) => {
    // Drop any per-set direction records (ADR 0081) — their stored
    // source/target node ids point at the *original* nodes, not the
    // remapped copies. The pasted edge re-seeds every set from its own
    // (correctly remapped) live direction at the next save or set switch.
    const data: Record<string, unknown> = { ...e.data }
    delete data.directionSets
    return {
      ...e,
      id: newId('edge'),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: true,
      data
    }
  })

  return { nodes, edges }
}
