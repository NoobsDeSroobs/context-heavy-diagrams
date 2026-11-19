import type { Node } from '@xyflow/react'
import { stencilKind } from '@shared/stencils/kinds'

// Changing a stencil's kind keeps its place, its edges, its link and its style (ADR 0180). The label
// and the size follow the new kind only while they are still the old kind's own defaults, so a label
// the person typed or a box they resized is left alone; a resized one keeps its centre.
export function swapStencilKind(node: Node, kindId: string): Node {
  const from = stencilKind(typeof node.data?.kind === 'string' ? node.data.kind : undefined)
  const to = stencilKind(kindId)
  if (node.data?.kind === to.id) return node
  const label = node.data?.label === from.defaultLabel ? to.defaultLabel : node.data?.label
  const resize =
    node.width === from.size.width &&
    node.height === from.size.height &&
    (from.size.width !== to.size.width || from.size.height !== to.size.height)
  return {
    ...node,
    ...(resize
      ? {
          width: to.size.width,
          height: to.size.height,
          position: {
            x: node.position.x + (from.size.width - to.size.width) / 2,
            y: node.position.y + (from.size.height - to.size.height) / 2
          }
        }
      : {}),
    // Only an end has an outcome and a reach.
    data: {
      ...node.data,
      kind: to.id,
      label,
      ...(to.endsFlow ? {} : { outcome: undefined, reach: undefined })
    }
  }
}
