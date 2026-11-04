import type { EdgeAnimation, EdgeAnimationDirection } from './schema.ts'
import { dashPeriod, type DashPattern } from './edgeDash.ts'

// The numbers behind an animated edge (ADR 0141), kept pure so they can be tested.

export const EDGE_ANIMATIONS: readonly EdgeAnimation[] = ['flow', 'pulse']

// A stored value this build does not know is treated as no animation, so a file written by a
// newer version still opens and draws.
export function knownAnimation(value: unknown): EdgeAnimation | undefined {
  return (EDGE_ANIMATIONS as readonly unknown[]).includes(value)
    ? (value as EdgeAnimation)
    : undefined
}

export function knownDirection(value: unknown): EdgeAnimationDirection {
  return value === 'reverse' ? 'reverse' : 'forward'
}

// The range a speed is drawn in. A hand-written 0 or 1e9 must not freeze the edge or strobe it.
export const MIN_ANIMATION_SPEED = 0.1
export const MAX_ANIMATION_SPEED = 10

export function knownSpeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(MAX_ANIMATION_SPEED, Math.max(MIN_ANIMATION_SPEED, value))
}

// Dashes cover the same ground per second whatever the pattern: one loop takes this long per unit
// at speed 1.
export const FLOW_MS_PER_UNIT = 35

// The dashes of a flowing line move by one repeat of the pattern per loop, so the loop is seamless.
export function flowLoop(
  pattern: DashPattern,
  speed: number
): { period: number; durationMs: number } {
  const period = dashPeriod(pattern)
  return { period, durationMs: (period * FLOW_MS_PER_UNIT) / knownSpeed(speed) }
}

// A pulse is a round dot riding the edge. It is drawn as a stroke of zero-length dashes with round
// caps, laid over the line, so a stream of pulses is the same dash animation as a flow and the dots
// are evenly spaced.

// The dot is a little thicker than the line it rides on.
export function pulseRadius(strokeWidth: number): number {
  return Math.max(3, strokeWidth * 1.75)
}

// 0 and a negative value are one pulse at a time; a positive value is the distance between pulses,
// never closer than the dots are wide, or they would run together into a line.
export function knownPulseDistance(value: unknown, radius: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.max(value, radius * 2 + 2)
}

// How fast a pulse travels, in user units per second at speed 1.
const PULSE_UNITS_PER_SECOND = 120

// The dash pattern, the length of one repeat and the time of one loop of a pulse stroke. One pulse
// at a time: the repeat is the whole path plus a dot's width, so the dot is out of sight before it
// starts again, and a short or a long edge still takes between 1.5 and 8 seconds, so it neither
// strobes nor crawls. A stream: the repeat is the distance, and the speed is the same on every edge.
export function pulseLoop(
  pathLength: number,
  distance: number,
  radius: number,
  speed: number
): { dasharray: string; period: number; durationMs: number } {
  const factor = knownSpeed(speed)
  if (distance > 0) {
    return {
      dasharray: `0 ${distance}`,
      period: distance,
      durationMs: (distance / PULSE_UNITS_PER_SECOND / factor) * 1000
    }
  }
  const period = Math.max(1, pathLength) + radius * 2
  const seconds = Math.min(8, Math.max(1.5, pathLength / PULSE_UNITS_PER_SECOND))
  return { dasharray: `0 ${period}`, period, durationMs: (seconds / factor) * 1000 }
}
