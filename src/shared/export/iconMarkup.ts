// An icon's cleaned SVG (ADR 0188) taken apart for an export: the exports draw it as a nested <svg>
// (or a picture) of their own, so each icon keeps its own viewBox and the colours it sets, instead
// of every icon being taken for a 24-unit line drawing as the Tabler ones are.

export interface IconParts {
  viewBox: string
  // The root's own drawing attributes, ready to write into a tag (leading space, values escaped).
  attrs: string
  inner: string
}

// What a root may pass on: how the icon paints. Its size, position, class and ids stay behind.
const ROOT_ATTRIBUTES = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'style'
])

const DEFAULT_VIEW_BOX = '0 0 24 24'

function numbers(text: string): number[] {
  return text
    .trim()
    .split(/[\s,]+/)
    .map(Number)
}

// The view box the icon states, or one made from its width and height, or the Tabler 24 by 24.
function viewBoxOf(attributes: Map<string, string>): string {
  const stated = numbers(attributes.get('viewbox') ?? '')
  if (stated.length === 4 && stated.every(Number.isFinite) && stated[2] > 0 && stated[3] > 0) {
    return stated.join(' ')
  }
  const width = parseFloat(attributes.get('width') ?? '')
  const height = parseFloat(attributes.get('height') ?? '')
  return width > 0 && height > 0 ? `0 0 ${width} ${height}` : DEFAULT_VIEW_BOX
}

export function iconParts(markup: string, ink: string): IconParts | null {
  const root = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i.exec(markup)
  if (!root) return null
  const attributes = new Map<string, string>()
  for (const match of root[1].matchAll(/([A-Za-z_:][-\w:.]*)\s*=\s*"([^"]*)"/g)) {
    attributes.set(match[1].toLowerCase(), match[2])
  }
  const attrs = [...attributes]
    .filter(([name]) => ROOT_ATTRIBUTES.has(name))
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('')
  const paint = (text: string): string => text.replace(/currentColor/gi, ink)
  return { viewBox: viewBoxOf(attributes), attrs: paint(attrs), inner: paint(root[2]) }
}
