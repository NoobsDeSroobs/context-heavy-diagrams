import type { LineStyleKind } from './schema.ts'

// The dash pattern of an edge or a legend line: what a line style draws, with the author's own
// dash length and gap on top (ADR 0141). Pure and shared, so the canvas, the SVG export and the
// legend draw the same pattern.

export interface DashPattern {
  dash: number
  gap: number
}

// What the three line styles draw, in user units. Solid has none.
export const LINE_STYLE_DASH: Record<LineStyleKind, DashPattern | undefined> = {
  solid: undefined,
  dashed: { dash: 8, gap: 6 },
  dotted: { dash: 2, gap: 4 }
}

// A flowing line has to be dashed, so a solid one flows as the dashed pattern.
const FLOW_PATTERN: DashPattern = { dash: 8, gap: 6 }

// The range a stored length is drawn in; a hand-written 0 or 1e9 must not make the line vanish or
// fall into one huge dash. Anything that is not a finite number is the style's own value.
export const MIN_DASH_PART = 0.5
export const MAX_DASH_PART = 200

export function knownDashPart(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(MAX_DASH_PART, Math.max(MIN_DASH_PART, value))
}

export interface DashInput {
  lineStyle?: LineStyleKind
  dashLength?: number
  dashGap?: number
}

// The pattern to draw, or undefined for a plain line. `flowing` makes a solid line dashed. The
// stored length and gap change a dashed, dotted or flowing line and are ignored on a solid line
// that is not flowing, so a line switched back to solid draws solid.
export function dashPattern(input: DashInput, flowing = false): DashPattern | undefined {
  const base = LINE_STYLE_DASH[input.lineStyle ?? 'solid'] ?? (flowing ? FLOW_PATTERN : undefined)
  if (!base) return undefined
  return {
    dash: knownDashPart(input.dashLength) ?? base.dash,
    gap: knownDashPart(input.dashGap) ?? base.gap
  }
}

export function dasharrayOf(pattern: DashPattern | undefined): string | undefined {
  return pattern ? `${pattern.dash} ${pattern.gap}` : undefined
}

// How far one repeat of the pattern is: a dash offset of exactly this much is a seamless loop.
export function dashPeriod(pattern: DashPattern): number {
  return pattern.dash + pattern.gap
}
