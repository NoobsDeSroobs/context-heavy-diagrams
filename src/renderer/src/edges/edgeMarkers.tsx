import { memo } from 'react'
import { MARKER_SHAPES, MARKER_STROKE_WIDTH } from '@shared/svg/markerShapes'

// <marker> defs for the full MarkerKind set (ADR 0014), drawn from the shared shape data
// (markerShapes.ts), which the SVG export (ADR 0124) draws from too. See that file for the geometry
// conventions.
//
// fill/stroke use the CSS context-fill/context-stroke keywords (Chromium 121+; this project ships
// Electron 43) to inherit the referencing path's stroke colour, so there is no marker per colour.

const STROKE = {
  fill: 'none',
  stroke: 'context-stroke',
  strokeWidth: MARKER_STROKE_WIDTH,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}
const FILLED = { fill: 'context-stroke', stroke: 'none' }

// Rendered once, globally (Canvas.tsx). Zero-size and non-interactive; it exists so <marker> ids
// resolve from any edge's marker-end/marker-start (SVG marker references resolve document-wide, not
// just within the same <svg>).
//
// data-export-role: this <svg> is a sibling of <ReactFlow>, not inside .react-flow__viewport, and
// PNG export (exportPng.ts) clones only that viewport subtree, so without these defs in the cloned
// content every marker-end="url(#...)" dangles and arrowheads don't render in the exported image.
// exportPng.ts finds this element by that attribute and temporarily clones it into the capture.
// memo()'d: static markup with no props, but a sibling of <ReactFlow> under CanvasInner that would
// otherwise reconcile on every render of that component (ADR 0073).
function EdgeMarkerDefs(): React.JSX.Element {
  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0 }}
      aria-hidden="true"
      data-export-role="edge-marker-defs"
    >
      <defs>
        {Object.values(MARKER_SHAPES).map((shape) => (
          <marker
            key={shape.id}
            id={shape.id}
            viewBox={shape.viewBox}
            refX={shape.refX}
            refY={shape.refY}
            markerWidth={shape.markerWidth}
            markerHeight={shape.markerHeight}
            orient="auto-start-reverse"
          >
            {shape.elements.map((element, index) =>
              element.tag === 'path' ? (
                <path key={index} d={element.d} {...(element.filled ? FILLED : STROKE)} />
              ) : (
                <circle
                  key={index}
                  cx={element.cx}
                  cy={element.cy}
                  r={element.r}
                  {...(element.filled ? FILLED : STROKE)}
                />
              )
            )}
          </marker>
        ))}
      </defs>
    </svg>
  )
}

export default memo(EdgeMarkerDefs)
