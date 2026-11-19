import type { Theme } from '../styling/theme.ts'
import { paintColor } from '../export/color.ts'
import {
  arrowBandPath,
  HEAVY_BORDER_FACTOR,
  STENCIL_MARK_PATHS,
  STENCIL_MARK_SOLID,
  stencilKind,
  stencilLightColors,
  stencilMarkBox,
  stencilStyle
} from './kinds.ts'

// The swatch of a kind in the colours it is drawn in for the theme; what a kind does not colour takes
// the text colour of the legend.
export function stencilSwatchSvgFor(kindId: string, theme: Theme): string {
  const style = stencilStyle(kindId, undefined)
  const light = theme === 'light' ? stencilLightColors(kindId, undefined) : {}
  const painted = (stored: string | undefined, fallback: string): string =>
    stored ? paintColor(stored, theme).color : fallback
  return stencilSwatchSvg(kindId, {
    fill: light.fill ?? painted(style?.fill, 'transparent'),
    stroke: light.stroke ?? painted(style?.stroke, 'currentColor'),
    mark: 'currentColor'
  })
}

// A kind's shape and mark as a small SVG, for the legend (ADR 0180): the same drawing as on the
// diagram at the size of a legend row. The colours are CSS colours already resolved for the theme.
export function stencilSwatchSvg(
  kindId: string,
  colors: { fill: string; stroke: string; mark: string }
): string {
  const kind = stencilKind(kindId)
  const width = kind.shape === 'arrow' ? 22 : 14
  const x = (28 - width) / 2
  const y = 1
  const height = 14
  const sw = kind.heavyBorder ? 1.5 * HEAVY_BORDER_FACTOR * 0.6 : 1.5
  const paint = `fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${sw}"`
  const inset = sw / 2
  let body =
    kind.shape === 'circle'
      ? `<circle cx="14" cy="8" r="${7 - inset}" ${paint}/>`
      : `<rect x="${x + inset}" y="${y + inset}" width="${width - sw}" height="${height - sw}" rx="2" ${paint}/>`
  if (kind.doubleBorder) {
    body += `<circle cx="14" cy="8" r="${Math.max(0, 7 - inset - sw - 1.2)}" fill="none" stroke="${colors.stroke}" stroke-width="${sw}"/>`
  }
  if (kind.shape === 'arrow') {
    const band = arrowBandPath(x + inset, y + inset, y + height - inset, 2, 0.35)
    body += `<path d="${band}" fill="${colors.stroke}"/>`
  }
  if (kind.mark) {
    const at = stencilMarkBox(kind, width, height, true)
    const scale = Math.round((at.size / 24) * 10000) / 10000
    body +=
      `<g transform="translate(${x + at.x} ${y + at.y}) scale(${scale})">` +
      `<path d="${STENCIL_MARK_PATHS[kind.mark]}" fill="${STENCIL_MARK_SOLID.has(kind.mark) ? colors.mark : 'none'}" stroke="${colors.mark}" stroke-width="${Math.round((1.2 / scale) * 100) / 100}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  }
  return `<svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">${body}</svg>`
}
