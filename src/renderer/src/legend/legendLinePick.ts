import type { EdgeStyle, LegendEntry } from '@shared/diagram'
import type { Theme } from '../styling/theme'
import type { EdgeStyleDefaults } from '@shared/styling/styleDefaults'
import { lineMotionOf, type LineMotion } from '../../../shared/styling/edgeAnimation.ts'

// Picking a legend line from an edge on the canvas (ADR 0123). Pure so it can be unit-tested; the
// theme flip and the built-in defaults are passed in, like displayColor in styleDefaults.ts.

export type LegendLineLook = Pick<
  LegendEntry,
  'color' | 'strokeWidth' | 'lineStyle' | 'startMarker' | 'endMarker' | 'routingStyle'
> &
  LineMotion

// What the edge looks like, as a legend entry. Line style and markers are written out in full
// (an unset field means the built-in default, which the legend cannot know about); the colour is
// the one shown for the current theme, because a legend colour is a plain value that is never
// flipped for the theme. An edge with no colour of its own leaves it unset, so the entry keeps
// following the default edge colour in both themes. The thickness is copied only when the edge sets
// one, and so is the routing; opacity has no legend field.
export function legendLineFromEdgeStyle(
  style: EdgeStyle | undefined,
  theme: Theme,
  flip: (color: string, theme: Theme) => string,
  defaults: Pick<EdgeStyleDefaults, 'lineStyle' | 'startMarker' | 'endMarker'>
): LegendLineLook {
  return {
    ...(style?.stroke !== undefined ? { color: flip(style.stroke, theme) } : {}),
    ...(style?.strokeWidth !== undefined ? { strokeWidth: style.strokeWidth } : {}),
    lineStyle: style?.lineStyle ?? defaults.lineStyle,
    startMarker: style?.startMarker ?? defaults.startMarker,
    endMarker: style?.endMarker ?? defaults.endMarker,
    ...(style?.routingStyle !== undefined ? { routingStyle: style.routingStyle } : {}),
    // The animation and the dash settings only when the edge sets them.
    ...lineMotionOf(style)
  }
}
