// Pure z-index math for the layer panel — see ADR 0035. No React
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

// Deep enough that the initial backfill's three ranges can't cross on first load, but not a hard
// boundary once the user drags things around in the panel (ADR 0035: containers-behind-shapes is a
// default arrangement, not an enforced rule). Text sits above shapes because annotations should
// stay readable over what they label.
export const CONTAINER_BASE = LAYER_GAP
export const ENTITY_BASE = 100_000
export const TEXT_BASE = 200_000

export interface ZIndexed {
  id: string
  type?: string
  zIndex?: number
}

function baseForType(type: string | undefined): number {
  if (type === 'container') return CONTAINER_BASE
  if (type === 'text') return TEXT_BASE
  return ENTITY_BASE
}

// Assigns a real zIndex to every node missing one, in array order —
// containers from the lowest range, shapes from a much higher one, text
// higher still, so an old file's current visual stacking (today's implicit
// "containers always behind, later-in-array paints on top") comes out
// identical on first load under this code (ADR 0029). A no-op once every
// node already has a value.
export function backfillZIndex<T extends ZIndexed>(nodes: T[]): T[] {
  if (nodes.every((n) => n.zIndex != null)) return nodes
  const counts: Record<string, number> = {}
  return nodes.map((n) => {
    if (n.zIndex != null) return n
    const base = baseForType(n.type)
    const count = (counts[base] ?? 0) + 1
    counts[base] = count
    return { ...n, zIndex: base + count * LAYER_GAP }
  })
}

// zIndex for a freshly created node — always above every *other node of
// the same tier* that currently exists (matching the existing "a new
// shape appears on top" expectation), but never below that tier's own
// base even when nothing of that tier exists yet. Without the `base`
// floor, a brand new node in a small or empty diagram fell back to
// "current max across whatever was passed in, plus one gap" — as low as
// 10 or 20 in a fresh diagram, nowhere near its intended tier (see docs/known-issues.md).
export function nextZIndexAbove(nodes: ZIndexed[], base: number = ENTITY_BASE): number {
  const max = nodes.reduce((m, n) => (n.zIndex != null && n.zIndex > m ? n.zIndex : m), base)
  return max + LAYER_GAP
}

export interface ZIndexUpdate {
  id: string
  zIndex: number
}

// Computes the minimal zIndex updates to move `movedId` to `newIndex` within `orderedDescending`
// (sorted highest to lowest, so index 0 is the frontmost, matching the panel's display order).
// Three cases, in order:
// 1. Both new neighbours exist with room between them (gap >= 2): average. Only the moved node
// changes.
// 2. Both exist with no room (gap <= 1, e.g. neighbours at 10 and 11: midpoint 11.5 would round
// into an occupied slot): shift the contiguous saturated run starting at the upper neighbour up by
// 1 until a gap opens, then take the freed slot. Bounded to that run, never a full-diagram
// renumber.
// 3. Only one neighbour exists (moving to the very front or back): extrapolate a fresh LAYER_GAP
// from it, leaving headroom for future inserts at that boundary.
export function reorderZIndex(
  orderedDescending: ZIndexed[],
  movedId: string,
  newIndex: number
): ZIndexUpdate[] {
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
      if (
        candidate.zIndex != null &&
        prevInBlock.zIndex != null &&
        candidate.zIndex === prevInBlock.zIndex + 1
      ) {
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
