import { useSyncExternalStore } from 'react'
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
