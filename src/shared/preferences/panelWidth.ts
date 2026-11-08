// The width of the right-hand dock that holds the notes, diagnostics, changes, layers and other
// side panels (ADR 0158). One width for all of them, so the edge stays where the person put it.
// The dock also never takes more than the window leaves for the canvas (a CSS max-width).

export const UTILITY_DOCK_WIDTH = { default: 360, min: 280, max: 900 }

export function clampDockWidth(value: unknown): number {
  const { default: fallback, min, max } = UTILITY_DOCK_WIDTH
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
