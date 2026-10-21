import type {
  ConnectionPoint,
  DiagramEdge,
  DiagramFile,
  DiagramNode,
  EdgeDirection,
  EdgeStyle
} from '../diagram.ts'
import { effectiveConnectionPoints, pointCoordinates } from '../geometry/connectionPoints.ts'
import type { EdgeEnd } from '../geometry/edgePath.ts'
import { pointsBoundingBox } from '../geometry/bendablePath.ts'
import { NODE_STYLE_DEFAULTS, styledNodeType } from '../styleDefaults.ts'
import { backfillZIndex } from '../zIndexOrdering.ts'
import { resolveLabelLook } from './appearance.ts'
import { DEFAULT_FONT_FAMILY } from './appearance.ts'
import { LINE_HEIGHT_EM, measureText, wrapText } from './textLayout.ts'

// A diagram turned into what the export draws: every node with an absolute position, a size and a
// stacking order, and every edge with its two endpoints on real connection points. The canvas gets
// the same things from React Flow; this is the equivalent for output that has no canvas (ADR 0124).

export type LaidOutKind = 'entity' | 'container' | 'text' | 'line'

export interface LaidOutNode {
  node: DiagramNode
  kind: LaidOutKind
  // Absolute position of the border box, with the parent chain applied.
  x: number
  y: number
  width: number
  height: number
  // Effective stacking order: a node never paints below its parent.
  z: number
  // Array position, the tie-breaker among equal z (later paints on top).
  order: number
}

export interface LaidOutEdge {
  edge: DiagramEdge
  from: EdgeEnd
  to: EdgeEnd
  z: number
  order: number
}

// The padded bounding box of a line node's own points (LineNode.tsx's LINE_BOUNDS_PADDING).
const LINE_BOUNDS_PADDING = 10
const ENTITY_MIN = { width: 60, height: 40 }
const CONTAINER_MIN = { width: 160, height: 120 }
const TEXT_MIN = { width: 40, height: 24 }

function kindOf(type: string | undefined): LaidOutKind {
  return type === 'container' || type === 'text' || type === 'line' ? type : 'entity'
}

// A node without a stored size is "sized to content" by the canvas. There is no layout engine
// here, so the content is measured with the same estimate the wrapping uses (textLayout.ts); a
// diagram written by this app always carries sizes, so this only serves hand-written files.
function estimateSize(node: DiagramNode, kind: LaidOutKind): { width: number; height: number } {
  if (kind === 'line') {
    const points = node.data.points ?? []
    if (points.length === 0)
      return { width: LINE_BOUNDS_PADDING * 2, height: LINE_BOUNDS_PADDING * 2 }
    const box = pointsBoundingBox(points)
    return {
      width: box.maxX - box.minX + LINE_BOUNDS_PADDING * 2,
      height: box.maxY - box.minY + LINE_BOUNDS_PADDING * 2
    }
  }
  const type = styledNodeType(node.type)
  const look = resolveLabelLook(type, node.style, 'light', DEFAULT_FONT_FAMILY)
  const lines = wrapText(node.data.label ?? '', 0, look.font)
  const textWidth = Math.max(0, ...lines.map((line) => measureText(line, look.font)))
  const textHeight = lines.length * look.font.size * LINE_HEIGHT_EM
  const border = (node.style?.strokeWidth ?? NODE_STYLE_DEFAULTS[type].strokeWidth) * 2
  const min = kind === 'container' ? CONTAINER_MIN : kind === 'text' ? TEXT_MIN : ENTITY_MIN
  const padX = kind === 'text' ? 16 : 16
  const padY = kind === 'text' ? 16 : 8
  return {
    width: Math.max(min.width, Math.ceil(textWidth + padX + border)),
    height: Math.max(min.height, Math.ceil(textHeight + padY + border))
  }
}

export function layoutNodes(diagram: DiagramFile): Map<string, LaidOutNode> {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  const zIndexed = backfillZIndex(
    diagram.nodes.map((n) => ({ id: n.id, type: n.type, zIndex: n.zIndex }))
  )
  const ownZ = new Map(zIndexed.map((n) => [n.id, n.zIndex ?? 0]))

  // Absolute position and effective z, walking up the parent chain (a missing parent or a cycle
  // simply ends the walk, as the canvas heals them on load).
  const resolve = (node: DiagramNode): { x: number; y: number; z: number } => {
    const chain: DiagramNode[] = [node]
    const seen = new Set<string>([node.id])
    let parentId = node.parentId
    while (parentId && !seen.has(parentId) && byId.has(parentId)) {
      const parent = byId.get(parentId) as DiagramNode
      chain.push(parent)
      seen.add(parentId)
      parentId = parent.parentId
    }
    let x = 0
    let y = 0
    let z = Number.NEGATIVE_INFINITY
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      x += chain[i].position.x
      y += chain[i].position.y
      const own = ownZ.get(chain[i].id) ?? 0
      z = i === chain.length - 1 ? own : own > z ? own : z + 1
    }
    return { x, y, z }
  }

  const laid = new Map<string, LaidOutNode>()
  diagram.nodes.forEach((node, order) => {
    const kind = kindOf(node.type)
    const { x, y, z } = resolve(node)
    const size = node.size ?? estimateSize(node, kind)
    laid.set(node.id, { node, kind, x, y, width: size.width, height: size.height, z, order })
  })
  return laid
}

function reverseEdge(edge: DiagramEdge): DiagramEdge {
  const style: EdgeStyle | undefined =
    edge.style?.labelPosition !== undefined
      ? { ...edge.style, labelPosition: 1 - edge.style.labelPosition }
      : edge.style
  return {
    ...edge,
    source: edge.target,
    target: edge.source,
    sourceHandle: edge.targetHandle,
    targetHandle: edge.sourceHandle,
    points: edge.points ? [...edge.points].reverse() : edge.points,
    ...(style ? { style } : {})
  }
}

// A saved handle id that no longer names a connection point falls back to "pick one", the meaning
// an absent handle has (renderer/edges/edgeDirectionSets.ts's repairDirection).
function repairedHandle(
  node: DiagramNode | undefined,
  handle: string | undefined
): string | undefined {
  if (!handle || !node) return undefined
  const ids = effectiveConnectionPoints(node.connectionPoints ?? []).map((p) => p.id)
  return ids.includes(handle) ? handle : undefined
}

// The file stores every edge in the first direction set's orientation (ADR 0081) and the app shows
// the saved active set on open; this re-expresses the edges the way the app shows them. Mirrors
// renderer/edges/edgeDirectionSets.ts (reverseEdgeDirection, applyDirectionToEdge).
export function orientEdges(diagram: DiagramFile): DiagramEdge[] {
  const sets = diagram.edgeDirectionSets ?? []
  if (sets.length < 2) return diagram.edges
  const baseId = sets[0].id
  const active =
    diagram.activeEdgeDirectionSetId && sets.some((s) => s.id === diagram.activeEdgeDirectionSetId)
      ? diagram.activeEdgeDirectionSetId
      : baseId
  if (active === baseId) return diagram.edges
  const nodes = new Map(diagram.nodes.map((n) => [n.id, n]))
  return diagram.edges.map((edge) => {
    const stored: EdgeDirection | undefined = edge.directionSets?.[active]
    if (!stored) return edge
    const oriented = stored.source !== edge.source ? reverseEdge(edge) : edge
    return {
      ...oriented,
      source: stored.source,
      target: stored.target,
      sourceHandle: repairedHandle(nodes.get(stored.source), stored.sourceHandle),
      targetHandle: repairedHandle(nodes.get(stored.target), stored.targetHandle)
    }
  })
}

// Where an edge meets a node, the way React Flow resolves a handle: a node with one handle, or an
// edge naming none, uses the first handle (the top one); an edge naming a handle the node does not
// have is not drawn at all. Only entities and containers have handles.
function endpoint(node: LaidOutNode | undefined, handle: string | undefined): EdgeEnd | null {
  if (!node || (node.kind !== 'entity' && node.kind !== 'container')) return null
  const points: ConnectionPoint[] = effectiveConnectionPoints(node.node.connectionPoints ?? [])
  const point = points.length === 1 || !handle ? points[0] : points.find((p) => p.id === handle)
  if (!point) return null
  const { x, y } = pointCoordinates(
    { left: node.x, top: node.y, width: node.width, height: node.height },
    point
  )
  return { x, y, side: point.side }
}

export function layoutEdges(edges: DiagramEdge[], nodes: Map<string, LaidOutNode>): LaidOutEdge[] {
  const out: LaidOutEdge[] = []
  edges.forEach((edge, order) => {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    const from = endpoint(source, edge.sourceHandle)
    const to = endpoint(target, edge.targetHandle)
    if (!source || !target || !from || !to) return
    // An edge has no stacking order of its own: it sits at the midpoint of its endpoints'.
    out.push({ edge, from, to, z: (source.z + target.z) / 2, order })
  })
  return out
}
