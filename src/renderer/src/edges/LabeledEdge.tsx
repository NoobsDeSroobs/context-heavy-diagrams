import { memo, useMemo, type CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps
} from '@xyflow/react'
import type { EdgeStyle, MetadataEntry } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../components/HighlightChips'
import { useDiagramContext } from '../DiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '../highlights'
import { withOpacity } from '../styles/colorOpacity'
import { markerUrl } from './markerIds'

// solid has no dasharray at all (undefined, not '0'), matching a plain
// BaseEdge — the other two are chosen to look distinct at typical zoom
// levels without being so fine they alias into a blur when zoomed out.
const DASH_ARRAY: Record<Exclude<EdgeStyle['lineStyle'], undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

// Point at an arbitrary fraction of the path's arc length — epic 0045.
// SVG path geometry doesn't depend on DOM attachment or layout, so a
// throwaway, never-inserted <path> is enough; no ref/measurement pass
// needed. Kept separate from getBezierPath's own labelX/labelY (used
// untouched when labelPosition is unset) so every edge predating this
// epic renders its label at exactly the same pixel it always has.
function pointAtRatio(pathD: string, ratio: number): { x: number; y: number } {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', pathD)
  const length = path.getTotalLength()
  const point = path.getPointAtLength(length * ratio)
  return { x: point.x, y: point.y }
}

// Fixed midpoint only, no drag-along-path — deliberately simple for v1, see
// docs/planning/epics/0012-editable-anchored-labels.md. The label is always
// rendered (even empty) so there's something to double-click on to add one.
//
// Style (ADR 0014): `style`/`markerEnd` arriving as props are React Flow's
// own resolution of defaultEdgeOptions (Canvas.tsx) for an edge with no
// explicit style override — used as-is when data.style leaves a field
// unset, so an edge with no style keeps today's look exactly. `markerStart`
// has no such default (RF only auto-generates markerEnd), so it's only
// ever set via an explicit style override.
function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  data
}: EdgeProps): React.JSX.Element {
  const { updateEdgeData } = useReactFlow()
  const { matchHighlights } = useDiagramContext()
  const edgeStyle = data?.style as EdgeStyle | undefined
  const highlightMatches = matchHighlights(data?.metadata as Record<string, MetadataEntry> | undefined)
  const [edgePath, midX, midY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  })
  const labelRatio = edgeStyle?.labelPosition
  const { x: labelX, y: labelY } = useMemo(
    () => (labelRatio != null ? pointAtRatio(edgePath, labelRatio) : { x: midX, y: midY }),
    [edgePath, labelRatio, midX, midY]
  )

  // Opacity is per-channel (strokeOpacity/fontOpacity), not one whole-
  // element value — see FontStyle.fontOpacity's comment for why. Each is
  // baked into its own color via color-mix() (withOpacity), applied
  // separately to the path and the label since EdgeLabelRenderer portals
  // the label into its own DOM container outside the SVG — it isn't a
  // descendant of the path and wouldn't inherit anything from it.
  const computedStyle: CSSProperties = {
    ...style,
    ...(edgeStyle?.stroke ? { stroke: withOpacity(edgeStyle.stroke, edgeStyle.strokeOpacity) } : {}),
    ...(edgeStyle?.strokeWidth != null ? { strokeWidth: edgeStyle.strokeWidth } : {}),
    ...(edgeStyle?.lineStyle ? { strokeDasharray: DASH_ARRAY[edgeStyle.lineStyle] } : {}),
    // A single matching highlight overrides the stroke, same treatment as
    // ShapeNode/ContainerNode's border override — epic 0026/ADR 0025.
    ...(highlightMatches.length === 1
      ? { stroke: highlightMatches[0].color, strokeWidth: HIGHLIGHT_BORDER_WIDTH }
      : {})
  }
  const computedMarkerEnd = edgeStyle?.endMarker !== undefined ? markerUrl(edgeStyle.endMarker) : markerEnd
  const computedMarkerStart =
    edgeStyle?.startMarker !== undefined ? markerUrl(edgeStyle.startMarker) : markerStart

  const labelStyle: CSSProperties = {
    ...(edgeStyle?.fontSize != null ? { fontSize: edgeStyle.fontSize } : {}),
    ...(edgeStyle?.fontColor ? { color: withOpacity(edgeStyle.fontColor, edgeStyle.fontOpacity) } : {}),
    ...(edgeStyle?.fontWeight ? { fontWeight: edgeStyle.fontWeight } : {}),
    ...(edgeStyle?.fontFamily ? { fontFamily: edgeStyle.fontFamily } : {})
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={computedStyle}
        markerEnd={computedMarkerEnd}
        markerStart={computedMarkerStart}
      />
      <EdgeLabelRenderer>
        <div
          className="edge-label"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all'
          }}
        >
          <EditableLabel
            className="edge-label-text"
            inputClassName="edge-label-input"
            style={labelStyle}
            value={String(data?.label ?? '')}
            onCommit={(label) => updateEdgeData(id, { label })}
          />
        </div>
        {highlightMatches.length >= 2 && (
          // Offset above the label point, same anchor coordinates — an
          // edge has no "corner" the way a node does, so this is the
          // closest equivalent to ShapeNode/ContainerNode's chip
          // placement (epic 0026/ADR 0025).
          <div
            className="edge-highlight-chips"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              pointerEvents: 'none'
            }}
          >
            <HighlightChips highlights={highlightMatches} />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(LabeledEdge)
