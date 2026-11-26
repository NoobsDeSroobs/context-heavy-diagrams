// Where the label of a small shape (a start, an end, an event, a choice) sits. The canvas
// and the exports place it from the same rules, so a diagram reads the same everywhere.

export const LABEL_POSITIONS = ['below', 'above', 'left', 'right', 'free'] as const
export type LabelPosition = (typeof LABEL_POSITIONS)[number]
export const DEFAULT_LABEL_POSITION: LabelPosition = 'below'

// What a person sees in the picker.
export const LABEL_POSITION_NAMES: Record<LabelPosition, string> = {
  below: 'Below',
  above: 'Above',
  left: 'Left',
  right: 'Right',
  free: 'Free'
}

// The space between a shape and a label that sits beside it, and the shortest dotted line worth
// drawing: a free label this close to its shape needs no line.
export const LABEL_GAP = 4
export const LEADER_MIN = 6

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

// An unknown or absent position (a file from a newer version) is read as below.
export function labelPositionOf(value: unknown): LabelPosition {
  return (LABEL_POSITIONS as readonly string[]).includes(value as string)
    ? (value as LabelPosition)
    : DEFAULT_LABEL_POSITION
}

// A free label's place: the offset of its centre from the centre of the shape, in diagram units.
export function offsetOf(value: unknown): { x: number; y: number } | undefined {
  const o = value as { x?: unknown; y?: unknown } | undefined
  return typeof o?.x === 'number' && typeof o?.y === 'number' && isFinite(o.x) && isFinite(o.y)
    ? { x: o.x, y: o.y }
    : undefined
}

// The box of a label of `block` size for a shape's box. `gap` is the space between them (more than
// LABEL_GAP where the shape has a wide border). A free label without an offset sits below.
export function labelBox(
  position: LabelPosition,
  offset: { x: number; y: number } | undefined,
  shape: Box,
  block: { width: number; height: number },
  gap = LABEL_GAP
): Box {
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const { width, height } = block
  const effective = position === 'free' && !offset ? 'below' : position
  switch (effective) {
    case 'above':
      return { x: cx - width / 2, y: shape.y - gap - height, width, height }
    case 'left':
      return { x: shape.x - gap - width, y: cy - height / 2, width, height }
    case 'right':
      return { x: shape.x + shape.width + gap, y: cy - height / 2, width, height }
    case 'free': {
      const o = offset as { x: number; y: number }
      return { x: cx + o.x - width / 2, y: cy + o.y - height / 2, width, height }
    }
    default:
      return { x: cx - width / 2, y: shape.y + shape.height + gap, width, height }
  }
}

// How the text lines up inside its box: toward the shape for a label beside it.
export function labelAlign(position: LabelPosition): 'start' | 'center' | 'end' {
  return position === 'left' ? 'end' : position === 'right' ? 'start' : 'center'
}

// Where a ray from a box's centre toward (dx, dy) leaves the box.
function leaveBox(box: Box, dx: number, dy: number): { x: number; y: number } {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const t = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy)
  )
  return { x: cx + dx * t, y: cy + dy * t }
}

// The dotted line that ties a free label to its shape, from the shape's outline to the label's box,
// or none when they are about as close as a label beside the shape.
export function leaderLine(
  shapeKind: 'circle' | 'square',
  shape: Box,
  label: Box
): { x1: number; y1: number; x2: number; y2: number } | null {
  const sx = shape.x + shape.width / 2
  const sy = shape.y + shape.height / 2
  const lx = label.x + label.width / 2
  const ly = label.y + label.height / 2
  const dx = lx - sx
  const dy = ly - sy
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null
  const from =
    shapeKind === 'circle'
      ? (() => {
          const r = Math.min(shape.width, shape.height) / 2
          return { x: sx + (dx / distance) * r, y: sy + (dy / distance) * r }
        })()
      : leaveBox(shape, dx, dy)
  const to = leaveBox(label, -dx, -dy)
  // The line runs along the direction between the centres; it has a length only when the label's
  // edge is further out than the shape's.
  const reach = (p: { x: number; y: number }): number =>
    ((p.x - sx) * dx + (p.y - sy) * dy) / distance
  if (reach(to) - reach(from) < LEADER_MIN) return null
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
}

// Where a label that is left of its place below, above, left or right goes when it is made free, so
// it does not jump: the offset of that label's centre. `block` is its size, estimated where it is not
// measured.
export function offsetFrom(
  position: LabelPosition,
  shape: Box,
  block: { width: number; height: number }
): { x: number; y: number } {
  const box = labelBox(position, undefined, shape, block)
  return {
    x: Math.round(box.x + box.width / 2 - (shape.x + shape.width / 2)),
    y: Math.round(box.y + box.height / 2 - (shape.y + shape.height / 2))
  }
}
