// Which side of a container its label sits on, and how the text is turned there. The canvas
// and the exports place the label from the same rules.

export const CONTAINER_LABEL_SIDES = ['top', 'left', 'right', 'bottom'] as const
export type ContainerLabelSide = (typeof CONTAINER_LABEL_SIDES)[number]
export const DEFAULT_CONTAINER_LABEL_SIDE: ContainerLabelSide = 'top'

// What a person sees in the picker.
export const CONTAINER_LABEL_SIDE_NAMES: Record<ContainerLabelSide, string> = {
  top: 'Top',
  left: 'Left',
  right: 'Right',
  bottom: 'Bottom'
}

// An unknown or absent side (a file from a newer version) is read as the top.
export function containerLabelSideOf(value: unknown): ContainerLabelSide {
  return (CONTAINER_LABEL_SIDES as readonly string[]).includes(value as string)
    ? (value as ContainerLabelSide)
    : DEFAULT_CONTAINER_LABEL_SIDE
}

// The top of the text points at the side the label is on, so a label on the left is turned a quarter
// turn left (it reads from the bottom up) and one on the right a quarter turn right (from the top
// down). The bottom is the exception: upside-down text cannot be read, so it stays upright.
export function containerLabelTurn(side: ContainerLabelSide): 0 | -90 | 90 {
  return side === 'left' ? -90 : side === 'right' ? 90 : 0
}

export type LabelAlign = 'start' | 'center' | 'end'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

// The room along the side that the text may use, from the box's border and the usual padding.
export function containerLabelRoom(
  side: ContainerLabelSide,
  box: Box,
  borderWidth: number
): number {
  const along = side === 'left' || side === 'right' ? box.height : box.width
  return Math.max(0, along - borderWidth * 2 - 16)
}

// Where to draw a label block of `block` size (its lines laid out upright, as for a label at the top):
// the top left of that block, and the centre to turn it about by `containerLabelTurn`. `align` is the
// text alignment, applied along the side: for a turned label, start is where the text begins reading,
// the bottom on the left and the top on the right.
export function containerLabelPlace(
  side: ContainerLabelSide,
  box: Box,
  borderWidth: number,
  block: { width: number; height: number },
  align: LabelAlign
): { left: number; top: number; cx: number; cy: number } {
  const { width: w, height: h } = block
  const pad = 8
  // The position of the block's start along a run that goes from `from` to `to`.
  const along = (from: number, to: number, reversed: boolean): number => {
    const atStart = reversed ? 'end' : 'start'
    if (align === 'center') return from + (to - from - w) / 2
    return align === atStart ? from : to - w
  }
  if (side === 'top' || side === 'bottom') {
    const left = along(box.x + borderWidth + pad, box.x + box.width - borderWidth - pad, false)
    const top = side === 'top' ? box.y + borderWidth + 4 : box.y + box.height - borderWidth - 4 - h
    return { left, top, cx: left + w / 2, cy: top + h / 2 }
  }
  // Turned: the block's length runs along the side, its height across it.
  const runFrom = box.y + borderWidth + pad
  const runTo = box.y + box.height - borderWidth - pad
  // On the left the text starts at the bottom of the run, on the right at the top.
  const runTop = along(runFrom, runTo, side === 'left')
  const cy = runTop + w / 2
  const cx =
    side === 'left' ? box.x + borderWidth + 4 + h / 2 : box.x + box.width - borderWidth - 4 - h / 2
  return { left: cx - w / 2, top: cy - h / 2, cx, cy }
}
