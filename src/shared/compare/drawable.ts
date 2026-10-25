// A diagram can name a connection point that its node does not have (an edge written by hand or by
// an assistant, or left behind when the node's points changed). The canvas then cannot draw the
// edge. A comparison must show every edge, or the overview is lost, so the copy it draws has such
// an end moved to a point the node does have. The comparison itself runs on the files as they are.

import type { DiagramEdge, DiagramFile, DiagramNode } from '../diagram'
import { effectiveConnectionPoints } from '../geometry/connectionPoints.ts'

type Side = 'top' | 'right' | 'bottom' | 'left'
const SIDES: readonly string[] = ['top', 'right', 'bottom', 'left']
// Only these node types have connection points.
const CONNECTABLE = new Set(['entity', 'container'])
const FALLBACK_SIZE = { width: 150, height: 60 }
const MAX_DEPTH = 50

export interface DrawableResult {
  diagram: DiagramFile
  // Edges that had an end moved.
  repaired: Set<string>
  // Edges with an end node that does not exist, which cannot be drawn at all.
  dangling: string[]
}

function centre(node: DiagramNode, byId: Map<string, DiagramNode>): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parent = node.parentId ? byId.get(node.parentId) : undefined
  for (let depth = 0; parent && depth < MAX_DEPTH; depth += 1) {
    x += parent.position.x
    y += parent.position.y
    parent = parent.parentId ? byId.get(parent.parentId) : undefined
  }
  const size = node.size ?? FALLBACK_SIZE
  return { x: x + size.width / 2, y: y + size.height / 2 }
}

function facing(from: { x: number; y: number }, to: { x: number; y: number }): Side {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

// The id of a point the node has: the wanted handle when it exists, else the point nearest the
// middle of the side the handle names, or of the side facing the other node.
function resolveHandle(
  node: DiagramNode,
  handle: string | undefined,
  other: DiagramNode,
  byId: Map<string, DiagramNode>
): string | undefined {
  if (!CONNECTABLE.has(node.type ?? 'entity')) return handle
  const points = effectiveConnectionPoints(node.connectionPoints ?? [])
  if (handle && points.some((p) => p.id === handle)) return handle
  const side = (
    SIDES.includes(handle ?? '') ? handle : facing(centre(node, byId), centre(other, byId))
  ) as Side
  const onSide = points.filter((p) => p.side === side)
  const nearest = [...onSide].sort((a, b) => Math.abs(a.offset - 0.5) - Math.abs(b.offset - 0.5))[0]
  return nearest?.id ?? handle
}

export function makeEdgesDrawable(diagram: DiagramFile): DrawableResult {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  const repaired = new Set<string>()
  const dangling: string[] = []

  const edges = diagram.edges.map((edge): DiagramEdge => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) {
      dangling.push(edge.id)
      return edge
    }
    let touched = false
    const fix = (
      handle: string | undefined,
      node: DiagramNode,
      other: DiagramNode
    ): string | undefined => {
      const resolved = resolveHandle(node, handle, other, byId)
      if (resolved !== handle) touched = true
      return resolved
    }
    const next: DiagramEdge = {
      ...edge,
      sourceHandle: fix(edge.sourceHandle, source, target),
      targetHandle: fix(edge.targetHandle, target, source)
    }
    // Each reading of the edge names its own points, and the one shown is rebuilt from them.
    if (edge.directionSets) {
      next.directionSets = Object.fromEntries(
        Object.entries(edge.directionSets).map(([id, d]) => {
          const from = byId.get(d.source)
          const to = byId.get(d.target)
          if (!from || !to) return [id, d]
          return [
            id,
            {
              ...d,
              sourceHandle: fix(d.sourceHandle, from, to),
              targetHandle: fix(d.targetHandle, to, from)
            }
          ]
        })
      )
    }
    if (!touched) return edge
    repaired.add(edge.id)
    return next
  })
  return { diagram: { ...diagram, edges }, repaired, dangling }
}
