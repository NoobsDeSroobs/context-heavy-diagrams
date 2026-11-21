import type { EdgeStyle } from '@shared/diagram'
import { EDGE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import { dasharrayOf, dashPattern } from '@shared/styling/edgeDash'
import { markerTrim } from '@shared/export/markerShapes'
import { markerUrl } from '../edges/markerIds'

// What a line looks like, drawn as the line itself: its colour, thickness, dashes and both ends, with
// the same markers the canvas uses. Used where a line is picked from a list or shown on a button, so
// the choice is judged on what it will look like and not on a name.
export type EdgeLineLook = Pick<
  EdgeStyle,
  | 'stroke'
  | 'strokeWidth'
  | 'strokeOpacity'
  | 'lineStyle'
  | 'startMarker'
  | 'endMarker'
  | 'dashLength'
  | 'dashGap'
>

// The thickest a preview is drawn: the ends scale with the thickness, and past this they would not
// fit a row of a list. The real thickness is in the tooltip of the row.
const MAX_PREVIEW_WIDTH = 3
const MARGIN = 3

export default function EdgeLinePreview({
  look,
  width = 44,
  height = 24
}: {
  look: EdgeLineLook
  width?: number
  height?: number
}): React.JSX.Element {
  const strokeWidth = Math.min(
    MAX_PREVIEW_WIDTH,
    Math.max(1, look.strokeWidth ?? EDGE_STYLE_DEFAULTS.strokeWidth)
  )
  const startMarker = look.startMarker ?? EDGE_STYLE_DEFAULTS.startMarker
  const endMarker = look.endMarker ?? EDGE_STYLE_DEFAULTS.endMarker
  const y = height / 2
  return (
    <svg
      className="edge-line-preview"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible', flex: '0 0 auto' }}
      aria-hidden="true"
    >
      <line
        x1={MARGIN + markerTrim(startMarker, strokeWidth)}
        y1={y}
        x2={width - MARGIN - markerTrim(endMarker, strokeWidth)}
        y2={y}
        // No colour of its own is the default edge colour, as for an edge with none.
        stroke={look.stroke ?? 'var(--xy-edge-stroke-default)'}
        strokeWidth={strokeWidth}
        strokeOpacity={look.strokeOpacity !== undefined ? look.strokeOpacity / 100 : undefined}
        strokeDasharray={dasharrayOf(dashPattern(look))}
        markerStart={markerUrl(startMarker)}
        markerEnd={markerUrl(endMarker)}
      />
    </svg>
  )
}
