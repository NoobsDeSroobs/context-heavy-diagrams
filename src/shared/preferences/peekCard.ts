// The size of the card shown while Ctrl (Cmd on a Mac) is held over an element (ADR 0093, 0156).
// A person sets the width and the greatest height; the card is as short as its content allows.

export const PEEK_CARD_WIDTH = { default: 340, min: 240, max: 800 }
export const PEEK_CARD_MAX_HEIGHT = { default: 260, min: 120, max: 800 }

export function clampPeekSize(
  value: unknown,
  range: { default: number; min: number; max: number }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return range.default
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

// How much of a note is rendered, before the card's height trims it: 1200 characters at the
// default size, in proportion to the card's area. Rendering is the cost the cap keeps down.
export function peekNoteCharCap(width: number, maxHeight: number): number {
  const area = width * maxHeight
  const base = PEEK_CARD_WIDTH.default * PEEK_CARD_MAX_HEIGHT.default
  return Math.round((1200 * area) / base)
}
