import { HEAVY_BORDER_FACTOR, stencilKind } from './kinds.ts'

// A kind's shape and mark as a small SVG, for the legend (ADR 0180): the same drawing as on the
// diagram at the size of a legend row. The colours are CSS colours already resolved for the theme.
export function stencilSwatchSvg(
  kindId: string,
  colors: { fill: string; stroke: string; mark: string }
): string {
  const kind = stencilKind(kindId)
  const width = kind.shape === 'rounded' ? 22 : 14
  const x = (28 - width) / 2
  const y = 1
  const height = 14
  const sw = kind.heavyBorder ? 1.5 * HEAVY_BORDER_FACTOR * 0.6 : 1.5
  const paint = `fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${sw}"`
  const inset = sw / 2
  const shape =
    kind.shape === 'circle'
      ? `<circle cx="14" cy="8" r="${7 - inset}" ${paint}/>`
      : `<rect x="${x + inset}" y="${y + inset}" width="${width - sw}" height="${height - sw}" rx="${kind.shape === 'rounded' ? 5 : 2}" ${paint}/>`
  const s = 3
  const mark =
    kind.mark === 'cross'
      ? `<path d="M${14 - s} ${8 - s}L${14 + s} ${8 + s}M${14 - s} ${8 + s}L${14 + s} ${8 - s}" fill="none" stroke="${colors.mark}" stroke-width="1.5" stroke-linecap="round"/>`
      : kind.mark === 'plus'
        ? `<path d="M${14 - s} 8L${14 + s} 8M14 ${8 - s}L14 ${8 + s}" fill="none" stroke="${colors.mark}" stroke-width="1.5" stroke-linecap="round"/>`
        : ''
  return `<svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">${shape}${mark}</svg>`
}
