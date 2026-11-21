import type { Edge, Node } from '@xyflow/react'

// The visibility set ids of a node or an edge as the canvas holds them, in its data (ADR 0194).
export function setIdsOf(element: { data?: Record<string, unknown> }): string[] | undefined {
  const ids = element.data?.visibilitySetIds
  return Array.isArray(ids) ? (ids as string[]) : undefined
}

// The elements as React Flow should draw them: the ones the rule hides get `hidden`, so they are
// not drawn and cannot be selected, while staying in the canvas state, where they keep their place
// and everything attached to them follows. The same array comes back when nothing changes, so
// nothing re-renders for a set that was never hidden.
export function applyHidden<T extends Node | Edge>(
  elements: T[],
  shown: (setIds: readonly string[] | undefined) => boolean
): T[] {
  let changed = false
  const next = elements.map((element) => {
    const hide = !shown(setIdsOf(element))
    if (hide === (element.hidden === true)) return element
    changed = true
    return { ...element, hidden: hide }
  })
  return changed ? next : elements
}
