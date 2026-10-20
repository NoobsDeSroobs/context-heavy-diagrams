import type { EdgeStyle, LegendEntry } from '@shared/diagram'
import type { Theme } from './theme'
import type { EdgeStyleDefaults } from './styles/styleDefaults'

// Picking a legend line from an edge on the canvas (ADR 0123). Pure so it can be unit-tested; the
// theme flip and the built-in defaults are passed in, like displayColor in styleDefaults.ts.

export type LegendLineLook = Pick<LegendEntry, 'color' | 'lineStyle' | 'startMarker' | 'endMarker'>

// What the edge looks like, as a legend entry. Line style and markers are written out in full
// (an unset field means the built-in default, which the legend cannot know about); the colour is
// the one shown for the current theme, because a legend colour is a plain value that is never
// flipped for the theme. An edge with no colour of its own leaves it unset, so the entry keeps
// following the default edge colour in both themes. Width and opacity have no legend field.
export function legendLineFromEdgeStyle(
  style: EdgeStyle | undefined,
  theme: Theme,
  flip: (color: string, theme: Theme) => string,
  defaults: Pick<EdgeStyleDefaults, 'lineStyle' | 'startMarker' | 'endMarker'>
): LegendLineLook {
  return {
    ...(style?.stroke !== undefined ? { color: flip(style.stroke, theme) } : {}),
    lineStyle: style?.lineStyle ?? defaults.lineStyle,
    startMarker: style?.startMarker ?? defaults.startMarker,
    endMarker: style?.endMarker ?? defaults.endMarker
  }
}
