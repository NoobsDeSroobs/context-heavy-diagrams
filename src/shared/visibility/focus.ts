// What a `focus` action frames (ADR 0194): the visible elements of its set. Pure, so the rule can be
// tested without a canvas; the presenter turns the ids into a rectangle and moves the view to it.
import type { VisibilitySet } from './schema.ts'
import { ALL_SETS } from './story.ts'
import { visibleFilter } from './visibility.ts'

export interface FocusNode {
  id: string
  setIds?: readonly string[]
}

export interface FocusEdge {
  source: string
  target: string
  setIds?: readonly string[]
}

// The nodes to frame for a focus on `target` (a set id, or ALL_SETS for everything visible), given
// which sets are hidden at that point of the story. A node counts when it is visible and in the set; a
// visible edge of the set counts through its end nodes, when those are visible. An edge has no box of
// its own that is worth framing. Nothing for a set the diagram does not have, so the view stays put.
export function focusedNodeIds(
  target: string,
  nodes: readonly FocusNode[],
  edges: readonly FocusEdge[],
  catalogue: readonly VisibilitySet[],
  hidden: ReadonlySet<string>
): string[] {
  if (target !== ALL_SETS && !catalogue.some((s) => s.id === target)) return []
  const visible = visibleFilter(catalogue, hidden)
  const wanted = (setIds: readonly string[] | undefined): boolean =>
    visible(setIds) && (target === ALL_SETS || (setIds?.includes(target) ?? false))
  const visibleNodes = new Set(nodes.filter((n) => visible(n.setIds)).map((n) => n.id))
  const ids = new Set(
    nodes.filter((n) => visibleNodes.has(n.id) && wanted(n.setIds)).map((n) => n.id)
  )
  if (target !== ALL_SETS) {
    for (const edge of edges) {
      if (!wanted(edge.setIds)) continue
      if (visibleNodes.has(edge.source)) ids.add(edge.source)
      if (visibleNodes.has(edge.target)) ids.add(edge.target)
    }
  }
  return [...ids]
}
