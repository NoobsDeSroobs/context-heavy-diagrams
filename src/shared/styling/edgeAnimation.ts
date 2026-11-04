import type { EdgeAnimation, LineStyleKind } from './schema.ts'

// The numbers behind an animated edge (ADR 0141), kept pure so they can be tested.

export const EDGE_ANIMATIONS: readonly EdgeAnimation[] = ['flow', 'pulse']

// A stored value this build does not know is treated as no animation, so a file written by a
// newer version still opens and draws.
export function knownAnimation(value: unknown): EdgeAnimation | undefined {
  return (EDGE_ANIMATIONS as readonly unknown[]).includes(value)
    ? (value as EdgeAnimation)
    : undefined
}

// The dash patterns of the three line styles, in user units. A flowing line has to be dashed, so
// a solid one flows as the dashed pattern.
const FLOW_DASH: Record<LineStyleKind, string> = { solid: '8 6', dashed: '8 6', dotted: '2 4' }

// The dash pattern a flowing edge uses, and how far one pattern repeat is: the dash offset moves by
// exactly that much per loop, so the loop is seamless whatever the line style.
export function flowDash(lineStyle: LineStyleKind | undefined): {
  dasharray: string
  period: number
} {
  const dasharray = FLOW_DASH[lineStyle ?? 'solid']
  const period = dasharray.split(' ').reduce((sum, n) => sum + Number(n), 0)
  return { dasharray, period }
}

// Dashes cover the same ground per second whatever the pattern: one loop takes this long per unit.
export const FLOW_MS_PER_UNIT = 35

// A dot covers the same ground per second on a short edge and a long one; clamped so a very short
// edge does not strobe and a very long one still arrives.
const PULSE_UNITS_PER_SECOND = 120
export function pulseSeconds(pathLength: number): number {
  return Math.min(8, Math.max(1.5, pathLength / PULSE_UNITS_PER_SECOND))
}

// The dot is a little thicker than the line it rides on.
export function pulseRadius(strokeWidth: number): number {
  return Math.max(3, strokeWidth * 1.75)
}
