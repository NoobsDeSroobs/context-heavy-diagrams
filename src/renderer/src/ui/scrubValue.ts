// The maths behind dragging a number field's label to change its value. Pure, so it is tested
// without a DOM; the gesture itself lives in useScrub.ts.

// Pointer movement under this many pixels is a click (which focuses the box for typing), not a drag.
export const DRAG_THRESHOLD_PX = 3

export type ScrubSpeed = 'normal' | 'fine' | 'coarse'

const SPEED_FACTOR: Record<ScrubSpeed, number> = { normal: 1, fine: 0.1, coarse: 10 }

// Shift is fine, Ctrl (or Cmd on a Mac) is coarse; Shift wins if both are held.
export function scrubSpeed(keys: {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): ScrubSpeed {
  if (keys.shiftKey) return 'fine'
  if (keys.ctrlKey || keys.metaKey) return 'coarse'
  return 'normal'
}

function decimalsOf(n: number): number {
  const text = String(n)
  const exponent = /e-(\d+)$/.exec(text)
  if (exponent) return Number(exponent[1])
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

// `start` plus one `step` per pixel (a tenth or ten times that for fine and coarse), rounded to the
// step's own decimals so 0.1 + 0.2 never shows as 0.30000000000000004, and kept inside min and max.
export function scrubValue(options: {
  start: number
  pixels: number
  step?: number
  min?: number
  max?: number
  speed?: ScrubSpeed
}): number {
  const { start, pixels, step = 1, min, max, speed = 'normal' } = options
  const perPixel = step * SPEED_FACTOR[speed]
  const decimals = Math.max(decimalsOf(step), decimalsOf(perPixel), decimalsOf(start))
  let value = Number((start + pixels * perPixel).toFixed(decimals))
  if (min != null && value < min) value = min
  if (max != null && value > max) value = max
  return value
}
