import { memo, useMemo, type CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  Position,
  type EdgeProps
} from '@xyflow/react'
import type { EdgeStyle, MetadataEntry } from '@shared/diagram'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../components/HighlightChips'
import { useDiagramContext } from '../DiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '../highlights'
import { withOpacity } from '../styles/colorOpacity'
import { themeAdaptiveColor } from '../styles/themeAdaptiveColor'
import { markerUrl } from './markerIds'

// solid has no dasharray at all (undefined, not '0'), matching a plain
// BaseEdge — the other two are chosen to look distinct at typical zoom
// levels without being so fine they alias into a blur when zoomed out.
const DASH_ARRAY: Record<Exclude<EdgeStyle['lineStyle'], undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

// React Flow's own CSS default (--xy-edge-stroke-width-default) — needed
// explicitly here since a selected edge's width is computed as "whatever
// it already is, plus a bit," and that base has to be a real number even
// when nothing overrides it.
const DEFAULT_STROKE_WIDTH = 1
// Additive, not a replacement value — composes with the highlight-override
// width (epic 0026/ADR 0025) instead of competing with it, so a
// highlighted *and* selected edge just gets both effects layered. Epic
// 0046.
const SELECTED_STROKE_WIDTH_DELTA = 2

// Point at an arbitrary fraction of the path's arc length — epic 0045,
// also used for the plain midpoint (ratio 0.5) since epic 0047, so a label
// stays centered on the *whole* rendered path, straight lead-in segments
// included, not just its curved middle portion. SVG path geometry doesn't
// depend on DOM attachment or layout, so a throwaway, never-inserted
// <path> is enough; no ref/measurement pass needed.
function pointAtRatio(pathD: string, ratio: number): { x: number; y: number } {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', pathD)
  const length = path.getTotalLength()
  const point = path.getPointAtLength(length * ratio)
  return { x: point.x, y: point.y }
}

// Outward from the node at each side — the direction an edge already
// travels leaving/entering a handle, used below to place the straight
// lead-in's other end.
const OUTWARD_DIRECTION: Record<Position, { dx: number; dy: number }> = {
  [Position.Top]: { dx: 0, dy: -1 },
  [Position.Right]: { dx: 1, dy: 0 },
  [Position.Bottom]: { dx: 0, dy: 1 },
  [Position.Left]: { dx: -1, dy: 0 }
}

// Straight lead-in/out before curving — the global edgeStraightSegmentLength
// setting (settings.ts/SettingsPanel, ADR 0032), epic 0047. getBezierPath
// has no concept of this, so the curve itself is instead run between two
// points offset straight outward from the real endpoints, and a straight
// `L` segment splices each real endpoint onto that curve's own path
// string. Relies on getBezierPath's returned path always starting
// "M<x>,<y> C..." (its actual, stable implementation, not just documented
// behavior) — the same assumption pointAtRatio above already makes by
// treating the returned string as valid path data either way. Clamped to
// half the straight-line distance between the real endpoints so two short
// segments can never overlap or fold a short edge's path back on itself.
function buildEdgePath(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
  straightSegmentLength: number
): string {
  if (straightSegmentLength <= 0) {
    return getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0]
  }
  const distance = Math.hypot(targetX - sourceX, targetY - sourceY)
  const length = Math.min(straightSegmentLength, distance / 2)
  const sourceDir = OUTWARD_DIRECTION[sourcePosition]
  const targetDir = OUTWARD_DIRECTION[targetPosition]
  const offsetSourceX = sourceX + sourceDir.dx * length
  const offsetSourceY = sourceY + sourceDir.dy * length
  const offsetTargetX = targetX + targetDir.dx * length
  const offsetTargetY = targetY + targetDir.dy * length
  const [curve] = getBezierPath({
    sourceX: offsetSourceX,
    sourceY: offsetSourceY,
    sourcePosition,
    targetX: offsetTargetX,
    targetY: offsetTargetY,
    targetPosition
  })
  return `M${sourceX},${sourceY} L${offsetSourceX},${offsetSourceY} ${curve.slice(curve.indexOf('C'))} L${targetX},${targetY}`
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
  selected,
  data
}: EdgeProps): React.JSX.Element {
  const { updateEdgeData } = useReactFlow()
  const { matchHighlights, edgeStraightSegmentLength, theme } = useDiagramContext()
  const edgeStyle = data?.style as EdgeStyle | undefined
  const highlightMatches = matchHighlights(data?.metadata as Record<string, MetadataEntry> | undefined)
  const edgePath = useMemo(
    () =>
      buildEdgePath(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, edgeStraightSegmentLength),
    [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, edgeStraightSegmentLength]
  )
  const labelRatio = edgeStyle?.labelPosition
  const { x: labelX, y: labelY } = useMemo(
    () => pointAtRatio(edgePath, labelRatio ?? 0.5),
    [edgePath, labelRatio]
  )

  // Opacity is per-channel (strokeOpacity/fontOpacity), not one whole-
  // element value — see FontStyle.fontOpacity's comment for why. Each is
  // baked into its own color via color-mix() (withOpacity), applied
  // separately to the path and the label since EdgeLabelRenderer portals
  // the label into its own DOM container outside the SVG — it isn't a
  // descendant of the path and wouldn't inherit anything from it.
  // Width is always resolved to a concrete number (not left to CSS's own
  // default) since a selected edge needs a real base to add the selection
  // delta on top of — see SELECTED_STROKE_WIDTH_DELTA above.
  const baseStrokeWidth =
    highlightMatches.length === 1 ? HIGHLIGHT_BORDER_WIDTH : (edgeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH)
  const computedStyle: CSSProperties = {
    ...style,
    ...(edgeStyle?.stroke
      ? { stroke: withOpacity(themeAdaptiveColor(edgeStyle.stroke, theme), edgeStyle.strokeOpacity) }
      : {}),
    strokeWidth: selected ? baseStrokeWidth + SELECTED_STROKE_WIDTH_DELTA : baseStrokeWidth,
    ...(edgeStyle?.lineStyle ? { strokeDasharray: DASH_ARRAY[edgeStyle.lineStyle] } : {}),
    // A single matching highlight overrides the stroke color, same
    // treatment as ShapeNode/ContainerNode's border override — epic
    // 0026/ADR 0025. Width is handled by baseStrokeWidth above instead of
    // here, so it can still be added to when also selected.
    ...(highlightMatches.length === 1 ? { stroke: highlightMatches[0].color } : {})
  }
  const computedMarkerEnd = edgeStyle?.endMarker !== undefined ? markerUrl(edgeStyle.endMarker) : markerEnd
  const computedMarkerStart =
    edgeStyle?.startMarker !== undefined ? markerUrl(edgeStyle.startMarker) : markerStart

  const labelStyle: CSSProperties = {
    ...(edgeStyle?.fontSize != null ? { fontSize: edgeStyle.fontSize } : {}),
    ...(edgeStyle?.fontColor
      ? { color: withOpacity(themeAdaptiveColor(edgeStyle.fontColor, theme), edgeStyle.fontOpacity) }
      : {}),
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
