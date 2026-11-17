// Where the kind list goes: left of the palette (it sits in the dock on the right), as wide as its
// names need, from the top of the button down to the bottom of the window; on the right of the button
// when there is no room on the left.
export interface ListPlace {
  left: number
  top: number
  width: number
  maxHeight: number
}
export const LIST_WIDTH = 270
export function listPlace(anchor: DOMRect): ListPlace {
  const gap = 8
  const room = anchor.left - gap
  const left = room >= LIST_WIDTH + gap ? anchor.left - gap - LIST_WIDTH : anchor.right + gap
  const maxHeight = Math.max(200, window.innerHeight - anchor.top - 16)
  return { left, top: anchor.top, width: LIST_WIDTH, maxHeight }
}
