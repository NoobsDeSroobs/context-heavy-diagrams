import type { EdgeStyle, MarkerKind, NodeStyle } from '@shared/diagram'
import type { Theme } from '../theme'

// The built-in look of an element that has no style of its own, as DATA (ADR 0117).
//
// A stored style holds only what the author changed; everything else is "the default". Defaults are
// defined once, here, and everything reads them: the CSS gets its values from
// defaultStyleCssVars(), edges and lines import them directly, and the property panel shows them
// for any field the element doesn't set (they used to be spread over CSS rules and constants in
// LabeledEdge.tsx/LineNode.tsx that had to agree by hand, and the panel showed blank fields for a
// visibly coloured element).
//
// Colours are listed per theme because the built-in light look was hand-picked, not computed from
// the dark one; making a default purely derived (ADR 0034's flip) means dropping its `light` entry.
// Opacity is 0-100, like the stored fields.

export interface ThemedValue {
  dark: string
  light: string
}

const SURFACE: ThemedValue = { dark: '#222222', light: '#f8f8f8' }
const BORDER: ThemedValue = { dark: '#515c67', light: '#c7ccd1' }
const TEXT: ThemedValue = { dark: '#fffff5', light: '#1b1b1f' }
const TEXT_OPACITY = 86

export type StyledNodeType = 'entity' | 'container' | 'text'

export interface NodeStyleDefaults {
  fill: ThemedValue
  fillOpacity: number
  stroke: ThemedValue
  strokeOpacity: number
  strokeWidth: number
  fontColor: ThemedValue
  fontOpacity: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
  textAlign: 'start' | 'center' | 'end'
}

export const NODE_STYLE_DEFAULTS: Record<StyledNodeType, NodeStyleDefaults> = {
  entity: {
    fill: SURFACE,
    fillOpacity: 100,
    stroke: BORDER,
    strokeOpacity: 100,
    strokeWidth: 1.5,
    fontColor: TEXT,
    fontOpacity: TEXT_OPACITY,
    fontSize: 13,
    fontWeight: 'normal',
    textAlign: 'center'
  },
  // A container is see-through: its fill is the surface colour at 0% opacity.
  container: {
    fill: SURFACE,
    fillOpacity: 0,
    stroke: BORDER,
    strokeOpacity: 100,
    strokeWidth: 1.5,
    fontColor: TEXT,
    fontOpacity: TEXT_OPACITY,
    fontSize: 12,
    fontWeight: 'normal',
    textAlign: 'start'
  },
  // A text node has no box: no fill, and a border of width 0 and 0% opacity.
  text: {
    fill: SURFACE,
    fillOpacity: 0,
    stroke: BORDER,
    strokeOpacity: 0,
    strokeWidth: 0,
    fontColor: TEXT,
    fontOpacity: TEXT_OPACITY,
    fontSize: 13,
    fontWeight: 'normal',
    textAlign: 'center'
  }
}

export interface EdgeStyleDefaults {
  stroke: ThemedValue
  strokeOpacity: number
  strokeWidth: number
  lineStyle: NonNullable<EdgeStyle['lineStyle']>
  startMarker: MarkerKind
  endMarker: MarkerKind
  // 0-1, like the stored field.
  labelPosition: number
  fontColor: ThemedValue
  fontOpacity: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
}

export const EDGE_STYLE_DEFAULTS: EdgeStyleDefaults = {
  stroke: { dark: '#6b7684', light: '#8a8a92' },
  strokeOpacity: 100,
  strokeWidth: 1.5,
  lineStyle: 'solid',
  startMarker: 'none',
  endMarker: 'arrowClosed',
  labelPosition: 0.5,
  fontColor: TEXT,
  fontOpacity: TEXT_OPACITY,
  fontSize: 12,
  fontWeight: 'normal'
}

// A freeform line has one stored-form default that the usual theme flip turns
// into its light colour, unlike the paired values above.
export const LINE_STYLE_DEFAULTS = {
  stroke: '#4a5568',
  strokeOpacity: 100,
  strokeWidth: 2,
  lineStyle: 'solid' as NonNullable<NodeStyle['lineStyle']>,
  startMarker: 'none' as MarkerKind,
  endMarker: 'none' as MarkerKind
}

export function styledNodeType(type: string | undefined): StyledNodeType {
  return type === 'container' || type === 'text' ? type : 'entity'
}

// The colour to SHOW for a stored-or-default colour field. A stored colour is
// the dark-theme baseline and is flipped for the current theme (ADR 0034,
// `flip` is themeAdaptiveColor, passed in so this stays testable without a
// DOM); an unset one is the built-in default for that theme.
export function displayColor(
  stored: string | undefined,
  fallback: ThemedValue,
  theme: Theme,
  flip: (color: string, theme: Theme) => string
): string {
  return stored !== undefined ? flip(stored, theme) : fallback[theme]
}

// The CSS custom properties the stylesheet reads for the default look of
// each node type (main.css: `.entity-node` etc.), so the CSS has no second
// copy of any of these values. Re-applied whenever the theme changes.
export function defaultStyleCssVars(
  theme: Theme,
  withOpacity: (color: string, opacityPercent: number | undefined) => string
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [type, d] of Object.entries(NODE_STYLE_DEFAULTS)) {
    const prefix = `--default-${type}`
    vars[`${prefix}-fill`] = withOpacity(d.fill[theme], d.fillOpacity)
    vars[`${prefix}-stroke`] = withOpacity(d.stroke[theme], d.strokeOpacity)
    vars[`${prefix}-stroke-width`] = `${d.strokeWidth}px`
    vars[`${prefix}-font-size`] = `${d.fontSize}px`
    vars[`${prefix}-font-color`] = withOpacity(d.fontColor[theme], d.fontOpacity)
    vars[`${prefix}-font-weight`] = d.fontWeight
    vars[`${prefix}-text-align`] = d.textAlign
  }
  const e = EDGE_STYLE_DEFAULTS
  vars['--default-edge-label-font-size'] = `${e.fontSize}px`
  vars['--default-edge-label-font-color'] = withOpacity(e.fontColor[theme], e.fontOpacity)
  return vars
}
