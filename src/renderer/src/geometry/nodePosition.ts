import type { Node } from '@xyflow/react'

// Containers (ADR 0012) — a child node's `position` is relative
// to its immediate parent's own position, cascading up through any nesting
// depth. These helpers convert between that relative space and true
// absolute canvas coordinates, and keep the invariant React Flow requires:
// a parent node must appear earlier in the `nodes` array than its children.
//
// Split out of Canvas.tsx (epic "multi-connection-line") so MultiConnection
// Line.tsx can use the same conversion without importing Canvas.tsx itself
// — that would be a real circular import (Canvas.tsx renders
// MultiConnectionLine as its connectionLineComponent), not just an
// awkward one.

export function absolutePosition(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const seen = new Set<string>([node.id])
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    seen.add(parentId)
    parentId = parent.parentId
  }
  return { x, y }
}

export function subtractPosition(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  return { x: a.x - b.x, y: a.y - b.y }
}
