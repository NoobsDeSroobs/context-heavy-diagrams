// What a Delete really removes when containers are involved.
//
// React Flow's delete always cascades: every descendant of a deleted container
// is added to the removal, and so is every edge touching any of them. This app
// wants something different (ADR 0012): deleting a container *promotes* its
// children instead of deleting them. But if the children were selected too
// (select everything, or drag a box around the lot), they were asked to be
// deleted and should go with it.
//
// So a node is deleted when it was explicitly asked for, meaning it is selected
// or it is the top of the removal (nothing above it is also being removed).
// Anything React Flow merely cascaded to survives. Edges follow: an edge goes
// when it is selected or touches a node that is really being deleted, so a
// promoted child keeps its connections.
//
// Pure and free of React Flow so it can be tested with plain node:test.

export interface DeletableNode {
  id: string
  parentId?: string
  selected?: boolean
}

export interface DeletableEdge {
  id: string
  source: string
  target: string
  selected?: boolean
}

export function resolveDeletion<N extends DeletableNode, E extends DeletableEdge>(
  cascadedNodes: readonly N[],
  cascadedEdges: readonly E[]
): { nodes: N[]; edges: E[] } {
  const inRemoval = new Map(cascadedNodes.map((n) => [n.id, n]))
  // The cascade is closed downward, so a node whose direct parent is not in the
  // removal has nothing above it in the removal either: it is the top of it.
  const cascadedFromParent = (node: N): boolean =>
    node.parentId !== undefined && inRemoval.has(node.parentId)
  const nodes = cascadedNodes.filter((n) => n.selected === true || !cascadedFromParent(n))
  const deleted = new Set(nodes.map((n) => n.id))
  const edges = cascadedEdges.filter(
    (e) => e.selected === true || deleted.has(e.source) || deleted.has(e.target)
  )
  return { nodes, edges }
}
