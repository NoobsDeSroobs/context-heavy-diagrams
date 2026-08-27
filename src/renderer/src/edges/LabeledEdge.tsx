import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  Position,
  type EdgeProps
} from '@xyflow/react'
import type { EdgeStyle, LinePoint, MetadataEntry } from '@shared/diagram'
import { buildConnectorPath, type PathPoint } from '../geometry/bendablePath'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../components/HighlightChips'
import { useDiagramContext } from '../useDiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '../highlights'
import { isolateStyle } from '../search'
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
// width (ADR 0025) instead of competing with it, so a highlighted *and*
// selected edge just gets both effects layered.
const SELECTED_STROKE_WIDTH_DELTA = 2
const BEND_POINT_HANDLE_SIZE = 10

// Point at an arbitrary fraction of the path's arc length (ADR 0045),
// also used for the plain midpoint (ratio 0.5), so a label
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
// travels leaving/entering a handle. Used both to place the bezier
// routing's straight lead-in/out (below) and as every point's fixed
// tangent direction under catmull-rom routing (see bendablePath.ts's PathPoint).
const OUTWARD_DIRECTION: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 }
}

// Straight lead-in/out before curving — the global edgeStraightSegmentLength
// setting (settings.ts/PreferencesPanel, ADR 0032). Only meaningful
// for the two "curvy" routing styles (bezier, catmull-rom); straight/step/
// smoothstep already leave each side perpendicular by construction, with no
// ambiguity to disambiguate. getBezierPath has no concept of a lead-in
// itself, so the curve is instead run between two points offset straight
// outward from the real endpoints, and a straight `L` segment splices each
// real endpoint onto that curve's own path string. Relies on getBezierPath's
// returned path always starting "M<x>,<y> C..." (its actual, stable
// implementation, not just documented behavior) — the same assumption
// pointAtRatio above already makes by treating the returned string as valid
// path data either way. Clamped to half the straight-line distance between
// the real endpoints so two short segments can never overlap or fold a
// short edge's path back on itself.
function buildBezierPath(
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
  const offsetSourceX = sourceX + sourceDir.x * length
  const offsetSourceY = sourceY + sourceDir.y * length
  const offsetTargetX = targetX + targetDir.x * length
  const offsetTargetY = targetY + targetDir.y * length
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
  const { updateEdgeData, screenToFlowPosition } = useReactFlow()
  const {
    matchHighlights,
    edgeStraightSegmentLength,
    theme,
    pushSnapshot,
    openContextMenu,
    gravityPresets,
    searchMatchIds,
    isolateActive,
    isolateOpacity
  } = useDiagramContext()
  const edgeStyle = data?.style as EdgeStyle | undefined
  const routingStyle = edgeStyle?.routingStyle
  const highlightMatches = matchHighlights(
    data?.metadata as Record<string, MetadataEntry> | undefined
  )
  // Bend-point visibility: hovered (Canvas.tsx's onEdgeMouseEnter/Leave,
  // see data.hovered's own comment there) or selected or a point is
  // actively being dragged right now — the last case so a fast drag that
  // strays off the path mid-gesture doesn't hide the very point being
  // dragged.
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null)
  const bendPointsVisible = Boolean(data?.hovered) || selected || draggingPointIndex !== null
  const bendPoints = (data?.points as LinePoint[] | undefined) ?? []

  // Routing (ADR 0057): 'straight'/'step'/'smoothstep' are React Flow's
  // own built-in path shapes, wired straight through with no math of our
  // own. 'catmullRom' reuses bendablePath.ts (originally the freeform-line
  // curve, ADR 0050) with this edge's own manual bend points.
  // Absent means today's only historical behavior, a plain bezier.
  const edgePath = useMemo(() => {
    switch (routingStyle) {
      case 'straight':
        return getStraightPath({ sourceX, sourceY, targetX, targetY })[0]
      case 'step':
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 0
        })[0]
      case 'smoothstep':
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition
        })[0]
      case 'catmullRom': {
        const pathPoints: PathPoint[] = [
          { x: sourceX, y: sourceY, direction: OUTWARD_DIRECTION[sourcePosition] },
          ...bendPoints,
          { x: targetX, y: targetY, direction: OUTWARD_DIRECTION[targetPosition] }
        ]
        return buildConnectorPath(pathPoints, edgeStraightSegmentLength)
      }
      default:
        return buildBezierPath(
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          edgeStraightSegmentLength
        )
    }
  }, [
    routingStyle,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    bendPoints,
    edgeStraightSegmentLength
  ])

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
    highlightMatches.length === 1
      ? HIGHLIGHT_BORDER_WIDTH
      : (edgeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH)
  const computedStyle: CSSProperties = {
    ...style,
    ...(edgeStyle?.stroke
      ? {
          stroke: withOpacity(themeAdaptiveColor(edgeStyle.stroke, theme), edgeStyle.strokeOpacity)
        }
      : {}),
    strokeWidth: selected ? baseStrokeWidth + SELECTED_STROKE_WIDTH_DELTA : baseStrokeWidth,
    ...(edgeStyle?.lineStyle ? { strokeDasharray: DASH_ARRAY[edgeStyle.lineStyle] } : {}),
    // A single matching highlight overrides the stroke color, same
    // treatment as ShapeNode/ContainerNode's border override — see
    // ADR 0025. Width is handled by baseStrokeWidth above instead of
    // here, so it can still be added to when also selected.
    ...(highlightMatches.length === 1 ? { stroke: highlightMatches[0].color } : {}),
    // Search-result indicator (ADR 0062) — a glow via filter
    // rather than a stroke/outline override, specifically so it coexists
    // with whatever highlightMatches already did above instead of fighting
    // it for the same `stroke` property. Edges have no CSS `outline`
    // equivalent that follows a path shape (it'd just box the bounding
    // rect), unlike the node components' plain outline treatment.
    ...(searchMatchIds.has(id)
      ? {
          filter:
            'drop-shadow(0 0 3px var(--search-match-color)) drop-shadow(0 0 3px var(--search-match-color))'
        }
      : {}),
    // Selection wins over both the edge's own explicit color and any
    // highlight-match color — the whole point is staying findable in a
    // busy diagram regardless of the edge's own look. Raised after live-
    // testing the edge z-index fix (docs/known-issues.md) made it obvious
    // how easy a selected edge still was to lose track of visually, even
    // once its handle-priority worked correctly.
    //
    // A CSS var (set once on the <ReactFlow> wrapper in Canvas.tsx), not a
    // DiagramContext field (ADR 0056): this value only ever matters to
    // whichever edge is currently selected, so reading it via Context would
    // re-render every edge whenever it changes, selected or not. The
    // browser resolves the var directly; no re-render needed even for the
    // selected edge itself.
    ...(selected ? { stroke: 'var(--selected-edge-highlight-color)' } : {}),
    // "Isolate" (ADR 0063) — layered last, same as every other
    // override here; opacity doesn't conflict with anything above it so
    // ordering only matters for readability, not correctness.
    ...isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)
  }
  const computedMarkerEnd =
    edgeStyle?.endMarker !== undefined ? markerUrl(edgeStyle.endMarker) : markerEnd
  const computedMarkerStart =
    edgeStyle?.startMarker !== undefined ? markerUrl(edgeStyle.startMarker) : markerStart

  const labelStyle: CSSProperties = {
    ...(edgeStyle?.fontSize != null ? { fontSize: edgeStyle.fontSize } : {}),
    ...(edgeStyle?.fontColor
      ? {
          color: withOpacity(themeAdaptiveColor(edgeStyle.fontColor, theme), edgeStyle.fontOpacity)
        }
      : {}),
    ...(edgeStyle?.fontWeight ? { fontWeight: edgeStyle.fontWeight } : {}),
    ...(edgeStyle?.fontFamily ? { fontFamily: edgeStyle.fontFamily } : {})
  }

  // Manual bend points — only meaningful under catmull-rom routing (a
  // straight/step/smoothstep path is fully determined by React Flow's own
  // algorithm, no interior points to place). Dragging repositions
  // data.points[index] directly, in the same absolute canvas coordinates
  // the schema already stores them in.
  const onBendPointPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
      event.stopPropagation()
      pushSnapshot()
      setDraggingPointIndex(index)
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      const onMove = (moveEvent: PointerEvent): void => {
        const flowPoint = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        updateEdgeData(id, {
          points: bendPoints.map((p, i) =>
            i === index ? { ...p, x: flowPoint.x, y: flowPoint.y } : p
          )
        })
      }
      const onUp = (): void => {
        target.releasePointerCapture(event.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setDraggingPointIndex(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [pushSnapshot, screenToFlowPosition, updateEdgeData, id, bendPoints]
  )

  const onBendPointContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault()
      event.stopPropagation()
      const setGravity = (gravity: number): void => {
        pushSnapshot()
        updateEdgeData(id, {
          points: bendPoints.map((p, i) => (i === index ? { ...p, gravity } : p))
        })
      }
      openContextMenu(event.clientX, event.clientY, [
        ...gravityPresets.map((preset) => ({
          label: preset.label,
          onSelect: () => setGravity(preset.value)
        })),
        {
          label: 'Remove point',
          separatorBefore: true,
          onSelect: () => {
            pushSnapshot()
            updateEdgeData(id, { points: bendPoints.filter((_, i) => i !== index) })
          }
        }
      ])
    },
    [pushSnapshot, openContextMenu, gravityPresets, updateEdgeData, id, bendPoints]
  )

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
          // placement (ADR 0025).
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
        {routingStyle === 'catmullRom' &&
          bendPoints.map((point, index) => (
            <div
              key={index}
              className={`edge-bend-point nodrag nopan${bendPointsVisible ? '' : ' edge-bend-point-hidden'}`}
              style={{
                position: 'absolute',
                width: BEND_POINT_HANDLE_SIZE,
                height: BEND_POINT_HANDLE_SIZE,
                transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`
              }}
              onPointerDown={(event) => onBendPointPointerDown(event, index)}
              onContextMenu={(event) => onBendPointContextMenu(event, index)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(LabeledEdge)
