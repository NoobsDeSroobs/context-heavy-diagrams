import type { EdgeStyle, HighlightDefinition, MarkerKind, NodeStyle } from '../diagram/index.ts'
import { HIGHLIGHT_BORDER_WIDTH } from '../tagging/highlights.ts'
import {
  EDGE_STYLE_DEFAULTS,
  LINE_STYLE_DEFAULTS,
  NODE_STYLE_DEFAULTS,
  type StyledNodeType
} from '../styling/styleDefaults.ts'
import type { Theme } from '../styling/theme.ts'
import { paintColor, plainColor } from './color.ts'
import type { FontSpec } from './textLayout.ts'

// What an element looks like once its stored style, the built-in defaults, the theme and any single
// matching highlight (ADR 0025) have been combined into concrete values. The canvas expresses the
// same rules as CSS (renderer/styles/nodeStyleCss.ts and the node/edge components); this is the
// resolved form of those rules, for output that has no stylesheet to fall back on (ADR 0124). The
// precedence is the canvas's: an explicit stored value, else the built-in default for the theme, and
// a single matching highlight overrides the border or stroke colour and width.

export interface Paint {
  color: string
  // 0-1
  opacity: number
}

export interface BoxLook {
  fill: Paint | null
  stroke: Paint | null
  strokeWidth: number
  dashed: boolean
}

export interface LabelLook {
  font: FontSpec
  fill: Paint
  align: 'start' | 'center' | 'end'
}

export interface LineLook {
  stroke: Paint
  strokeWidth: number
  dasharray: string | undefined
  startMarker: MarkerKind
  endMarker: MarkerKind
}

// The page font (base.css), which every label inherits unless the element sets its own.
export const DEFAULT_FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"

// solid has no dasharray at all, matching a plain stroke.
export const DASH_ARRAY: Record<NonNullable<EdgeStyle['lineStyle']>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

// Light and dark values of the page tokens the exported chrome (edge-label chips, the legend box)
// uses: --color-background, --color-background-soft, --ev-c-gray-2 and the text colour (base.css).
export const PAGE_TOKENS: Record<
  Theme,
  { background: string; soft: string; border: string; text: Paint }
> = {
  dark: {
    background: '#1b1b1f',
    soft: '#222222',
    border: '#414853',
    text: { color: '#fffff5', opacity: 0.86 }
  },
  light: {
    background: '#ffffff',
    soft: '#f8f8f8',
    border: '#dfe2e6',
    text: { color: '#1b1b1f', opacity: 0.86 }
  }
}

function visible(paint: Paint): Paint | null {
  return paint.opacity > 0 ? paint : null
}

// Opacity (fillOpacity/strokeOpacity/fontOpacity) only applies to an explicit colour on a node, as in
// nodeContainerCss; the default colour carries its own default opacity.
export function resolveBoxLook(
  type: StyledNodeType,
  style: NodeStyle | undefined,
  theme: Theme,
  highlight: HighlightDefinition | undefined
): BoxLook {
  const d = NODE_STYLE_DEFAULTS[type]
  const fill = style?.fill
    ? paintColor(style.fill, theme, style.fillOpacity)
    : plainColor(d.fill[theme], d.fillOpacity)
  let stroke = style?.stroke
    ? paintColor(style.stroke, theme, style.strokeOpacity)
    : plainColor(d.stroke[theme], d.strokeOpacity)
  let strokeWidth = style?.strokeWidth ?? d.strokeWidth
  if (highlight) {
    stroke = plainColor(highlight.color)
    strokeWidth = HIGHLIGHT_BORDER_WIDTH
  }
  return {
    fill: visible(fill),
    stroke: strokeWidth > 0 ? visible(stroke) : null,
    strokeWidth,
    dashed: type === 'container'
  }
}

export function resolveLabelLook(
  type: StyledNodeType,
  style: NodeStyle | undefined,
  theme: Theme,
  defaultFontFamily: string
): LabelLook {
  const d = NODE_STYLE_DEFAULTS[type]
  return {
    font: {
      size: style?.fontSize ?? d.fontSize,
      weight: style?.fontWeight ?? d.fontWeight,
      family: style?.fontFamily ?? defaultFontFamily
    },
    fill: style?.fontColor
      ? paintColor(style.fontColor, theme, style.fontOpacity)
      : plainColor(d.fontColor[theme], d.fontOpacity),
    align: style?.textAlign ?? d.textAlign
  }
}

// An edge's strokeOpacity applies to the default colour too (LabeledEdge.tsx); a single matching
// highlight overrides colour and width.
export function resolveEdgeLook(
  style: EdgeStyle | undefined,
  theme: Theme,
  highlight: HighlightDefinition | undefined
): LineLook {
  const stroke = highlight
    ? plainColor(highlight.color)
    : style?.stroke
      ? paintColor(style.stroke, theme, style.strokeOpacity)
      : plainColor(EDGE_STYLE_DEFAULTS.stroke[theme], style?.strokeOpacity)
  return {
    stroke,
    strokeWidth: highlight
      ? HIGHLIGHT_BORDER_WIDTH
      : (style?.strokeWidth ?? EDGE_STYLE_DEFAULTS.strokeWidth),
    dasharray: style?.lineStyle ? DASH_ARRAY[style.lineStyle] : undefined,
    startMarker: style?.startMarker ?? 'none',
    // An edge with no style of its own ends in the default arrow (the canvas's defaultEdgeOptions).
    endMarker: style?.endMarker ?? EDGE_STYLE_DEFAULTS.endMarker
  }
}

export function resolveEdgeLabelLook(
  style: EdgeStyle | undefined,
  theme: Theme,
  defaultFontFamily: string
): LabelLook {
  const d = EDGE_STYLE_DEFAULTS
  return {
    font: {
      size: style?.fontSize ?? d.fontSize,
      weight: style?.fontWeight ?? d.fontWeight,
      family: style?.fontFamily ?? defaultFontFamily
    },
    fill: style?.fontColor
      ? paintColor(style.fontColor, theme, style.fontOpacity)
      : plainColor(d.fontColor[theme], d.fontOpacity),
    align: 'center'
  }
}

// A freeform line node (ADR 0050): the same fields as an edge's, with its own defaults, and no
// highlight (lines carry no metadata).
export function resolveLineNodeLook(style: NodeStyle | undefined, theme: Theme): LineLook {
  return {
    stroke: paintColor(style?.stroke ?? LINE_STYLE_DEFAULTS.stroke, theme, style?.strokeOpacity),
    strokeWidth: style?.strokeWidth ?? LINE_STYLE_DEFAULTS.strokeWidth,
    dasharray: DASH_ARRAY[style?.lineStyle ?? 'solid'],
    startMarker: style?.startMarker ?? 'none',
    endMarker: style?.endMarker ?? 'none'
  }
}
