// Drag-time alignment guides + snap-to-shape — see ADR 0019. Proximity-
// based, not edge-contact-based: shapes don't need to touch to snap, which
// is what lets e.g. two shapes with a gap between them still snap into a
// matching column. Deliberately does NOT include snap-to-grid (no grid
// concept at all) or connection-aware alignment (positioning relative to
// what a node is connected to) — both explicitly out of scope, decided
// with the user when this epic started; see the epic doc.

export const SNAP_THRESHOLD_PX = 5

export interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
}

export function boundsFrom(x: number, y: number, width: number, height: number): Bounds {
  return { left: x, right: x + width, top: y, bottom: y + height, centerX: x + width / 2, centerY: y + height / 2 }
}

export interface SnapResult {
  dx: number
  dy: number
  guideX: number[]
  guideY: number[]
}

// Checks the dragged node's left/center/right against every other node's
// left/center/right (and same for top/center/bottom), independently per
// axis — a drag can snap horizontally to one shape and vertically to a
// completely different one at the same time. Only the single closest match
// per axis actually moves the node; ties at that same closest distance are
// kept as additional guide lines (e.g. three shapes already sharing a left
// edge all light up, not just one).
export function computeSnap(dragged: Bounds, others: Bounds[], threshold: number): SnapResult {
  const xCandidates = [dragged.left, dragged.centerX, dragged.right]
  const yCandidates = [dragged.top, dragged.centerY, dragged.bottom]

  let bestXDist = Infinity
  let bestDx = 0
  let guideX: number[] = []

  let bestYDist = Infinity
  let bestDy = 0
  let guideY: number[] = []

  for (const other of others) {
    const otherX = [other.left, other.centerX, other.right]
    const otherY = [other.top, other.centerY, other.bottom]

    for (const dx of xCandidates) {
      for (const ox of otherX) {
        const dist = Math.abs(dx - ox)
        if (dist > threshold) continue
        if (dist < bestXDist) {
          bestXDist = dist
          bestDx = ox - dx
          guideX = [ox]
        } else if (dist === bestXDist && !guideX.includes(ox)) {
          guideX.push(ox)
        }
      }
    }

    for (const dy of yCandidates) {
      for (const oy of otherY) {
        const dist = Math.abs(dy - oy)
        if (dist > threshold) continue
        if (dist < bestYDist) {
          bestYDist = dist
          bestDy = oy - dy
          guideY = [oy]
        } else if (dist === bestYDist && !guideY.includes(oy)) {
          guideY.push(oy)
        }
      }
    }
  }

  return {
    dx: bestXDist === Infinity ? 0 : bestDx,
    dy: bestYDist === Infinity ? 0 : bestDy,
    guideX,
    guideY
  }
}
