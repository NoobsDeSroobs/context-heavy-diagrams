import type { CSSProperties } from 'react'
import type { NodeStyle } from '@shared/diagram'
import type { Theme } from '../theme'
import { withOpacity } from './colorOpacity'
import { themeAdaptiveColor } from './themeAdaptiveColor'

// Turns a NodeStyle bag into the two style objects a node component actually
// needs — see ADR 0014. Only sets properties the style actually specifies,
// so an absent field falls through to the component's own CSS class
// (border-style: dashed on containers, etc.) rather than clobbering it with
// an inline default.
//
// Opacity is per-channel (fillOpacity/strokeOpacity/fontOpacity), not one
// whole-element value — see FontStyle.fontOpacity's comment for why. Each
// is baked into its own color via color-mix() (withOpacity), not the CSS
// `opacity` property, which can't isolate fill from border from text.
//
// `fill`/`stroke`/`fontColor` pass through themeAdaptiveColor first — the
// stored value is always the dark-theme-baseline color, this is where it
// becomes what actually gets painted for the current theme (epic 0040/ADR
// 0034).
export function nodeContainerCss(style: NodeStyle | undefined, theme: Theme): CSSProperties {
  if (!style) return {}
  const css: CSSProperties = {}
  if (style.fill) css.background = withOpacity(themeAdaptiveColor(style.fill, theme), style.fillOpacity)
  if (style.stroke) css.borderColor = withOpacity(themeAdaptiveColor(style.stroke, theme), style.strokeOpacity)
  if (style.strokeWidth != null) css.borderWidth = style.strokeWidth
  return css
}

export function nodeLabelCss(style: NodeStyle | undefined, theme: Theme): CSSProperties {
  if (!style) return {}
  const css: CSSProperties = {}
  if (style.fontSize != null) css.fontSize = style.fontSize
  if (style.fontColor) css.color = withOpacity(themeAdaptiveColor(style.fontColor, theme), style.fontOpacity)
  if (style.fontWeight) css.fontWeight = style.fontWeight
  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (style.textAlign) css.textAlign = style.textAlign
  return css
}
