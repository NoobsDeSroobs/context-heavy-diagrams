import type { EdgeStyle, NodeStyle } from '@shared/diagram'

// Copy-style ("format painter") core — pure, so it can be unit-tested. See
// ADR 0095. A brush is a snapshot of one element's *stored* style taken when
// the mode is entered (never the theme-flipped display values, ADR 0034, and
// never a reference to the selection — clicking a target changes the
// selection, so the source must not depend on it).

// Node types that carry a `data.style`.
const BRUSH_NODE_TYPES = ['entity', 'container', 'text', 'line'] as const

export type StyleBrush =
  { kind: 'node'; nodeType: string; style: NodeStyle } | { kind: 'edge'; style: EdgeStyle }

// Edge style fields that are positional/structural, not look: where the label
// sits along the path, and how the path is routed (a 'catmullRom' route only
// means something together with the edge's own bend points, which are never
// copied). A target keeps its own values for these.
const EDGE_KEPT_KEYS = ['labelPosition', 'routingStyle'] as const

interface NodeLike {
  type?: string
  data?: Record<string, unknown>
}
interface EdgeLike {
  data?: Record<string, unknown>
}

export function canBrushNodeType(type: string | undefined): boolean {
  return (BRUSH_NODE_TYPES as readonly string[]).includes(type ?? 'entity')
}

export function captureNodeBrush(node: NodeLike): StyleBrush | null {
  const nodeType = node.type ?? 'entity'
  if (!canBrushNodeType(nodeType)) return null
  return { kind: 'node', nodeType, style: { ...(node.data?.style as NodeStyle | undefined) } }
}

export function captureEdgeBrush(edge: EdgeLike): StyleBrush {
  const style = { ...(edge.data?.style as EdgeStyle | undefined) }
  for (const key of EDGE_KEPT_KEYS) delete style[key]
  return { kind: 'edge', style }
}

// Only the same type accepts a brush: entity -> entity, container -> container,
// text -> text, line -> line.
export function brushAppliesToNode(brush: StyleBrush, node: NodeLike): boolean {
  return brush.kind === 'node' && brush.nodeType === (node.type ?? 'entity')
}

// A node's whole `style` bag is visual, so the target takes the source's bag
// wholesale — fields the source doesn't set fall back to defaults on the
// target, so it ends up looking the same, not a blend of the two.
export function applyBrushToNodeData(
  brush: StyleBrush,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (brush.kind !== 'node') return data
  return { ...data, style: { ...brush.style } }
}

export function applyBrushToEdgeData(
  brush: StyleBrush,
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (brush.kind !== 'edge') return data ?? {}
  const current = (data?.style as EdgeStyle | undefined) ?? {}
  const style: EdgeStyle = { ...brush.style }
  for (const key of EDGE_KEPT_KEYS) {
    if (current[key] !== undefined) (style as Record<string, unknown>)[key] = current[key]
  }
  return { ...data, style }
}
