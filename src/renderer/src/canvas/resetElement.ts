import type { Edge, Node } from '@xyflow/react'
import { absolutePosition } from '../nodes/nodePosition'
import { removeContainerReparenting, sortNodesForHierarchy } from './hierarchy'

// "Reset to saved" for one element of the changes panel: put a node or an edge back to how the
// saved file has it, whatever happened to it since, and leave everything else as it is. Whole
// element only, so the caller does it as one ordinary edit (undoable). Pure: the saved graph is
// the saved file converted the way a load converts it.

export interface Graph {
  nodes: Node[]
  edges: Edge[]
}

export type ResetResult = ({ ok: true } & Graph) | { ok: false; message: string }

export type ResetChange = 'added' | 'removed' | 'modified'

function labelOf(nodes: Node[], id: string): string {
  const label = String(nodes.find((n) => n.id === id)?.data?.label ?? '')
    .split('\n')[0]
    .trim()
  return label || id
}

// Would giving `nodeId` the parent `parentId` make the node its own ancestor?
function makesCycle(nodes: Node[], nodeId: string, parentId: string): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let current: string | undefined = parentId
  for (let steps = 0; current !== undefined && steps <= nodes.length; steps += 1) {
    if (current === nodeId) return true
    current = byId.get(current)?.parentId
  }
  return false
}

// The saved node, as it can stand in the live graph: its saved container when that one is still
// there (and would not enclose it in a loop), else top level at the place it was drawn.
function placeNode(savedNode: Node, saved: Graph, live: Node[], selected?: boolean): Node {
  const placed: Node = { ...savedNode, selected }
  const parentId = savedNode.parentId
  if (parentId === undefined) return placed
  const parentIsLive = live.some((n) => n.id === parentId && n.id !== savedNode.id)
  if (parentIsLive && !makesCycle(live, savedNode.id, parentId)) return placed
  const savedById = new Map(saved.nodes.map((n) => [n.id, n]))
  delete placed.parentId
  placed.position = absolutePosition(savedNode, savedById)
  return placed
}

function resetNode(live: Graph, saved: Graph, id: string, change: ResetChange): ResetResult {
  const liveNode = live.nodes.find((n) => n.id === id)
  const savedNode = saved.nodes.find((n) => n.id === id)

  if (change === 'added') {
    if (!liveNode) return { ok: true, ...live }
    return {
      ok: true,
      // Its connections go with it, but anything it contained stays (ADR 0012).
      nodes: removeContainerReparenting(live.nodes, id),
      edges: live.edges.filter((e) => e.source !== id && e.target !== id)
    }
  }
  if (!savedNode) return { ok: false, message: 'This element is not in the saved file any more.' }

  if (change === 'modified') {
    if (!liveNode) return { ok: false, message: 'This element is no longer in the diagram.' }
    const placed = {
      ...placeNode(savedNode, saved, live.nodes, liveNode.selected),
      measured: liveNode.measured
    }
    return {
      ok: true,
      nodes: sortNodesForHierarchy(live.nodes.map((n) => (n.id === id ? placed : n))),
      edges: live.edges
    }
  }

  // Removed: bring it back, with the connections it lost that can be drawn again.
  if (liveNode) return { ok: false, message: 'This element is already in the diagram.' }
  const nodes = sortNodesForHierarchy([...live.nodes, placeNode(savedNode, saved, live.nodes)])
  const liveIds = new Set(nodes.map((n) => n.id))
  const edgeIds = new Set(live.edges.map((e) => e.id))
  const restored = saved.edges.filter(
    (e) =>
      (e.source === id || e.target === id) &&
      !edgeIds.has(e.id) &&
      liveIds.has(e.source) &&
      liveIds.has(e.target)
  )
  return { ok: true, nodes, edges: [...live.edges, ...restored] }
}

function resetEdge(live: Graph, saved: Graph, id: string, change: ResetChange): ResetResult {
  const liveEdge = live.edges.find((e) => e.id === id)
  const savedEdge = saved.edges.find((e) => e.id === id)

  if (change === 'added') {
    return { ok: true, nodes: live.nodes, edges: live.edges.filter((e) => e.id !== id) }
  }
  if (!savedEdge)
    return { ok: false, message: 'This connection is not in the saved file any more.' }
  const liveIds = new Set(live.nodes.map((n) => n.id))
  for (const end of [savedEdge.source, savedEdge.target]) {
    if (!liveIds.has(end)) {
      return {
        ok: false,
        message: `Restore "${labelOf(saved.nodes, end)}" first: this connection leads to it.`
      }
    }
  }
  if (change === 'modified') {
    if (!liveEdge) return { ok: false, message: 'This connection is no longer in the diagram.' }
    return {
      ok: true,
      nodes: live.nodes,
      edges: live.edges.map((e) =>
        e.id === id ? { ...savedEdge, selected: liveEdge.selected } : e
      )
    }
  }
  if (liveEdge) return { ok: false, message: 'This connection is already in the diagram.' }
  return { ok: true, nodes: live.nodes, edges: [...live.edges, savedEdge] }
}

export function resetElement(
  live: Graph,
  saved: Graph,
  kind: 'node' | 'edge',
  id: string,
  change: ResetChange
): ResetResult {
  return kind === 'node' ? resetNode(live, saved, id, change) : resetEdge(live, saved, id, change)
}
