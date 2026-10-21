// Multi-select resize: when several nodes are selected and one is resized,
// the others scale by the same percentage, each in place (ADR 0098).

export interface GroupResizeBox {
  x: number
  y: number
  width: number
  height: number
}

export interface GroupResizeMember {
  id: string
  start: GroupResizeBox
  minWidth: number
  minHeight: number
}

/**
 * New box for each member after the dragged node went from `primaryStart` to
 * `primaryNow` (React Flow's onResize box). Scale is always taken against the
 * gesture-start sizes (never incrementally), so a member clamped at its
 * minimum recovers when the pointer comes back, and rounding can't drift.
 *
 * Which edge stays fixed is read off the dragged node itself: if its `x`/`y`
 * moved, a left/top handle is being dragged and its right/bottom edge is the
 * fixed one, so every member keeps *its* right/bottom edge fixed too;
 * otherwise the left/top edge is. (Not React Flow's `direction` param — that
 * says grow vs shrink, not which handle.)
 */
export function scaleGroupMembers(
  members: GroupResizeMember[],
  primaryStart: GroupResizeBox,
  primaryNow: GroupResizeBox
): Map<string, GroupResizeBox> {
  const sx = primaryStart.width > 0 ? primaryNow.width / primaryStart.width : 1
  const sy = primaryStart.height > 0 ? primaryNow.height / primaryStart.height : 1
  const anchorRight = Math.abs(primaryNow.x - primaryStart.x) > 0.5
  const anchorBottom = Math.abs(primaryNow.y - primaryStart.y) > 0.5
  const out = new Map<string, GroupResizeBox>()
  for (const m of members) {
    const width = Math.max(m.minWidth, Math.round(m.start.width * sx))
    const height = Math.max(m.minHeight, Math.round(m.start.height * sy))
    out.set(m.id, {
      width,
      height,
      x: anchorRight ? m.start.x + m.start.width - width : m.start.x,
      y: anchorBottom ? m.start.y + m.start.height - height : m.start.y
    })
  }
  return out
}
