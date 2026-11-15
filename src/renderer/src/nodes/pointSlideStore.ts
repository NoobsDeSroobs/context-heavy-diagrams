import { useSyncExternalStore } from 'react'
import {
  automaticHandles,
  type AttachEdge,
  type AttachNode,
  type AutoAxis,
  type AutoEnds
} from '@shared/geometry/autoAttach'
import { slideKey } from '@shared/geometry/springPoints'

// How far each connection point currently slides off its slot (springPoints.ts), worked out by the
// canvas from every node and edge and read by the handles. An external store, so the canvas does not
// have to wrap React Flow in a provider.
let current = new Map<string, number>()
const listeners = new Set<() => void>()

const same = (a: Map<string, number>, b: Map<string, number>): boolean => {
  if (a.size !== b.size) return false
  for (const [key, value] of a) if (b.get(key) !== value) return false
  return true
}

// For code that runs on an event rather than in a render (the context menu).
export const currentPointSlides = (): Map<string, number> => current

// The connection points edge ends with no point named attach to (autoAttach.ts), by edge id. The
// answer keeps its identity while it does not change, so React Flow's edges are not replaced every
// time an element is selected or typed in; the axis each edge last used is remembered between calls.
let attached = new Map<string, AutoEnds>()
const axes = new Map<string, AutoAxis>()

const sameEnds = (a: Map<string, AutoEnds>, b: Map<string, AutoEnds>): boolean => {
  if (a.size !== b.size) return false
  for (const [id, ends] of a) {
    const other = b.get(id)
    if (
      !other ||
      other.sourceHandle !== ends.sourceHandle ||
      other.targetHandle !== ends.targetHandle
    ) {
      return false
    }
  }
  return true
}

export function resolveAutoHandles(
  nodes: AttachNode[],
  edges: AttachEdge[]
): Map<string, AutoEnds> {
  const next = automaticHandles(nodes, edges, axes)
  if (!sameEnds(attached, next)) attached = next
  return attached
}

export const currentAutoHandles = (): Map<string, AutoEnds> => attached

export function publishPointSlides(next: Map<string, number>): void {
  if (same(current, next)) return
  current = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePointSlide(nodeId: string, pointId: string): number {
  return useSyncExternalStore(subscribe, () => current.get(slideKey(nodeId, pointId)) ?? 0)
}
