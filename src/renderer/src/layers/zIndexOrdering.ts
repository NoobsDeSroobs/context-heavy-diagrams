// Pure z-index math for the layer panel — see epic 0043/ADR 0035. No React
// Flow / Canvas.tsx state here on purpose, just plain data in, plain data
// out, so the reorder algorithm's three cases (average / cascade-shift /
// boundary-extrapolate) can be reasoned about and changed in isolation from
// the UI that drives it.

// Default spacing between siblings — both for the initial backfill and for
// a boundary insert (moving to the very front/back of the whole order).
// Deliberately not 1: a wide-ish default gap is what makes the common case
// (inserting between two existing neighbors) resolve to a plain average
// without ever needing the cascade fallback below.
export const LAYER_GAP = 10

// Deep enough that the initial backfill's two ranges can never accidentally
// cross on first load — not a hard boundary once the user starts dragging
// things around in the panel (see ADR 0035: containers-behind-shapes is a
// default arrangement, not a rule enforced afterward).
const CONTAINER_BASE = LAYER_GAP
const NON_CONTAINER_BASE = 100_000

export interface ZIndexed {
  id: string
  type?: string
  zIndex?: number
}

// Assigns a real zIndex to every node missing one, in array order —
// containers from a low range, everything else from a much higher one, so
// an old file's current visual stacking (today's implicit "containers
// always behind, later-in-array paints on top") comes out identical on
// first load under this code (ADR 0029). A no-op once every node already
// has a value.
export function backfillZIndex<T extends ZIndexed>(nodes: T[]): T[] {
  if (nodes.every((n) => n.zIndex != null)) return nodes
  let containerCount = 0
  let otherCount = 0
  return nodes.map((n) => {
    if (n.zIndex != null) return n
    if (n.type === 'container') {
      containerCount += 1
      return { ...n, zIndex: CONTAINER_BASE + containerCount * LAYER_GAP }
    }
    otherCount += 1
    return { ...n, zIndex: NON_CONTAINER_BASE + otherCount * LAYER_GAP }
  })
}

// zIndex for a freshly created node — always above everything that
// currently exists, matching the existing "a new shape appears on top"
// expectation.
export function nextZIndexAbove(nodes: ZIndexed[]): number {
  const max = nodes.reduce((m, n) => (n.zIndex != null && n.zIndex > m ? n.zIndex : m), 0)
  return max + LAYER_GAP
}

export interface ZIndexUpdate {
  id: string
  zIndex: number
}

// Computes the minimal set of zIndex updates needed to move `movedId` to
// `newIndex` within `orderedDescending` (already sorted highest-to-lowest —
// index 0 is the current frontmost, matching the panel's own display
// order). Three cases, in order:
//  1. Both new neighbors exist with room between them (gap >= 2): average.
//     Only the moved node changes.
//  2. Both exist with no room (gap <= 1 — e.g. neighbors at 10 and 11, the
//     user's own worked example: midpoint 11.5 would round into an
//     already-occupied slot): shift the contiguous saturated run starting
//     at the upper neighbor up by 1 until a gap opens, then take the freed
//     slot. Bounded to that run, never a full-diagram renumber.
//  3. Only one neighbor exists (moving to the very front or back of the
//     whole order): extrapolate a fresh LAYER_GAP from it, preserving
//     headroom for future inserts at that new boundary.
export function reorderZIndex(orderedDescending: ZIndexed[], movedId: string, newIndex: number): ZIndexUpdate[] {
  const rest = orderedDescending.filter((n) => n.id !== movedId)
  const high = newIndex > 0 ? rest[newIndex - 1] : undefined
  const low = newIndex < rest.length ? rest[newIndex] : undefined

  if (high?.zIndex != null && low?.zIndex != null) {
    const gap = high.zIndex - low.zIndex
    if (gap >= 2) {
      return [{ id: movedId, zIndex: low.zIndex + Math.floor(gap / 2) }]
    }
    const block: ZIndexed[] = [high]
    for (let i = newIndex - 2; i >= 0; i -= 1) {
      const candidate = rest[i]
      const prevInBlock = block[block.length - 1]
      if (candidate.zIndex != null && prevInBlock.zIndex != null && candidate.zIndex === prevInBlock.zIndex + 1) {
        block.push(candidate)
      } else {
        break
      }
    }
    return [
      ...block.map((n) => ({ id: n.id, zIndex: (n.zIndex as number) + 1 })),
      { id: movedId, zIndex: low.zIndex + 1 }
    ]
  }

  // Only the upper neighbor exists: moving to the very back (lowest z).
  if (high?.zIndex != null) return [{ id: movedId, zIndex: high.zIndex - LAYER_GAP }]
  // Only the lower neighbor exists: moving to the very front (highest z).
  if (low?.zIndex != null) return [{ id: movedId, zIndex: low.zIndex + LAYER_GAP }]
  // Nothing else in the list at all.
  return [{ id: movedId, zIndex: LAYER_GAP }]
}
