import type { Edge, Node } from '@xyflow/react'
import type { EdgeStyle, NodeStyle } from '@shared/diagram'
import {
  NODE_STYLE_DEFAULTS,
  styledNodeType,
  type NodeStyleDefaults
} from '@shared/styling/styleDefaults'

export function nodeStyleOf(n: Node): NodeStyle {
  return (n.data?.style as NodeStyle | undefined) ?? {}
}

// What an element is drawn with when its own style leaves a field unset (ADR 0117).
// The property panel shows these instead of an empty field, so it reads the
// element's data and the built-in defaults as data, never the rendered pixels.
export function nodeDefaultsOf(n: Node): NodeStyleDefaults {
  return NODE_STYLE_DEFAULTS[styledNodeType(n.type)]
}

export function edgeStyleOf(e: Edge): EdgeStyle {
  return (e.data?.style as EdgeStyle | undefined) ?? {}
}
