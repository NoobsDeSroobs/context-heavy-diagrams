import type { Theme } from '../styling/theme.ts'
import { paintColor } from '../export/color.ts'
import {
  arrowBandPath,
  HEAVY_BORDER_FACTOR,
  STENCIL_MARK_PATHS,
  STENCIL_MARK_SOLID,
  stencilDoubleBorder,
  stencilKind,
  stencilLightColors,
  stencilMarkBox,
  stencilMarkOf,
  stencilSolid,
  stencilStyle,
  type StencilState
} from './kinds.ts'

// A kind's swatch is drawn on a 28 by 16 box and shown this much larger in the legend, on screen and in
// the exports, so the mark inside a small shape can be told apart.
export const STENCIL_SWATCH_ZOOM = 1.6
export const STENCIL_SWATCH_SIZE = {
  width: 28 * STENCIL_SWATCH_ZOOM,
  height: 16 * STENCIL_SWATCH_ZOOM
}

// The swatch of a kind in the colours it is drawn in for the theme; what a kind does not colour takes
// the text colour of the legend.
export function stencilSwatchSvgFor(kindId: string, theme: Theme, state?: StencilState): string {
  const style = stencilStyle(kindId, undefined)
  const light = theme === 'light' ? stencilLightColors(kindId, undefined) : {}
  const painted = (stored: string | undefined, fallback: string): string =>
    stored ? paintColor(stored, theme).color : fallback
  return stencilSwatchSvg(
    kindId,
    {
      fill: light.fill ?? painted(style?.fill, 'transparent'),
      stroke: light.stroke ?? painted(style?.stroke, 'currentColor'),
      mark: 'currentColor'
    },
    state
  )
}

// A kind's shape and mark as a small SVG, for the legend (ADR 0180): the same drawing as on the
// diagram at the size of a legend row. The colours are CSS colours already resolved for the theme. An
// end is drawn with the outcome and reach in `state` (ADR 0193).
export function stencilSwatchSvg(
  kindId: string,
  colors: { fill: string; stroke: string; mark: string },
  state?: StencilState
): string {
  const kind = stencilKind(kindId)
  const mark = stencilMarkOf(kind, state)
  const solid = stencilSolid(kind, state)
  const doubled = stencilDoubleBorder(kind, state)
  const width = kind.shape === 'arrow' ? 22 : 14
  const x = (28 - width) / 2
  const y = 1
  const height = 14
  const sw = kind.heavyBorder ? 1.5 * HEAVY_BORDER_FACTOR * 0.6 : 1.5
  // A whole-flow end is a solid disc in the border colour, with its mark cut out in the fill colour.
  const markPaint = solid ? colors.fill : colors.mark
  const paint = `fill="${solid ? colors.stroke : colors.fill}" stroke="${colors.stroke}" stroke-width="${sw}"`
  const inset = sw / 2
  let body =
    kind.shape === 'circle'
      ? `<circle cx="14" cy="8" r="${7 - inset}" ${paint}/>`
      : `<rect x="${x + inset}" y="${y + inset}" width="${width - sw}" height="${height - sw}" rx="2" ${paint}/>`
  if (doubled) {
    body += `<circle cx="14" cy="8" r="${Math.max(0, 7 - inset - sw - 1.2)}" fill="none" stroke="${colors.stroke}" stroke-width="${sw}"/>`
  }
  if (kind.shape === 'arrow') {
    const band = arrowBandPath(x + inset, y + inset, y + height - inset, 2, 0.35)
    body += `<path d="${band}" fill="${colors.stroke}"/>`
  }
  if (mark) {
    const at = stencilMarkBox(kind, width, height, true, mark, doubled)
    const scale = Math.round((at.size / 24) * 10000) / 10000
    body +=
      `<g transform="translate(${x + at.x} ${y + at.y}) scale(${scale})">` +
      `<path d="${STENCIL_MARK_PATHS[mark]}" fill="${STENCIL_MARK_SOLID.has(mark) ? markPaint : 'none'}" stroke="${markPaint}" stroke-width="${Math.round((1.2 / scale) * 100) / 100}" stroke-linecap="round" stroke-linejoin="round"/></g>`
  }
  return `<svg viewBox="0 0 28 16" width="28" height="16" aria-hidden="true">${body}</svg>`
}
