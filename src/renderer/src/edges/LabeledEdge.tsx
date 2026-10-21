import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import type { EdgeStyle, LinePoint, MetadataEntry } from '@shared/diagram'
import { buildEdgePath } from '@shared/geometry/edgePath'
import {
  orthogonalRouteVertices,
  orthogonalSegments,
  moveOrthogonalSegment,
  type OrthoSegment
} from '@shared/geometry/orthogonalPath'
import EditableLabel from '../components/EditableLabel'
import HighlightChips from '../components/HighlightChips'
import { useDiagramContext } from '../useDiagramContext'
import { HIGHLIGHT_BORDER_WIDTH } from '@shared/highlights'
import { EDGE_STYLE_DEFAULTS } from '@shared/styleDefaults'
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

// The default stroke width and colour (a little thicker than React Flow's stock
// 1px, and a concrete colour so a PNG export has something to copy) are data in
// styleDefaults.ts (ADR 0117), shared with the property panel. They are always
// applied inline (see computedStyle below), because a selected edge's width is
// "whatever it already is, plus a bit" and needs a real number to start from.
// base.css still carries the same colour for React Flow's own fallback edge; a
// test keeps the two equal.
const DEFAULT_STROKE_WIDTH = EDGE_STYLE_DEFAULTS.strokeWidth
// Additive, not a replacement value — composes with the highlight-override
// width (ADR 0025) instead of competing with it, so a highlighted *and*
// selected edge just gets both effects layered.
const SELECTED_STROKE_WIDTH_DELTA = 2
const BEND_POINT_HANDLE_SIZE = 10
// Draggable segment handle for step/smoothstep routing (ADR 0077) — a short
// bar laid along the segment, long side across the drag direction.
const SEGMENT_HANDLE_LONG = 20
const SEGMENT_HANDLE_SHORT = 6
// Width of the invisible hover hit-path (ADR 0073) — matches React Flow's
// own default edge interactionWidth (20) so hovering near the edge behaves
// the same as clicking near it. Rendered on top of BaseEdge so it, not
// BaseEdge's own interaction path, is the topmost element under the pointer
// and its pointerenter/leave actually fire; clicks/right-clicks bubble up
// to React Flow's own `.react-flow__edge` <g> handler unchanged.
const HOVER_HIT_WIDTH = 20

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

// One shared empty list, so an edge with no bend points has a stable `bendPoints`
// identity across renders and the hooks below that depend on it do not re-run.
const NO_POINTS: LinePoint[] = []

// Fixed midpoint only, no drag-along-path: deliberately simple for v1 (ADR 0020). The label is
// always rendered, even empty, so there is something to double-click to add one.
//
// Style (ADR 0014): `style`/`markerEnd` arriving as props are React Flow's resolution of
// defaultEdgeOptions (Canvas.tsx) for an edge with no style override, used as-is when data.style
// leaves a field unset, so an unstyled edge keeps today's look. `markerStart` has no such default
// (RF only auto-generates markerEnd), so it is only set through an explicit style override.
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
  // Bend-point visibility: hovered or selected or a point is actively being
  // dragged right now — the last case so a fast drag that strays off the
  // path mid-gesture doesn't hide the very point being dragged. Hover is
  // per-edge local state (ADR 0073), set from the invisible hit-path
  // rendered below — it used to be a single hoveredEdgeId in Canvas.tsx
  // materialized onto edge.data, which rewrote the whole edges array on
  // every hover.
  const [hovered, setHovered] = useState(false)
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null)
  const [draggingSegmentIndex, setDraggingSegmentIndex] = useState<number | null>(null)
  const bendPointsVisible = hovered || selected || draggingPointIndex !== null
  const segmentHandlesVisible = hovered || selected || draggingSegmentIndex !== null
  const bendPoints = (data?.points as LinePoint[] | undefined) ?? NO_POINTS
  const isOrthogonal = routingStyle === 'step' || routingStyle === 'smoothstep'

  // Expanded orthogonal vertex list (source, synthetic corners, waypoints,
  // target) for step/smoothstep routing — the single source both the rendered
  // path and the segment drag handles derive from. Null for every other
  // routing style, so catmull-rom / bezier / straight are wholly untouched.
  const orthoVertices = useMemo(
    () =>
      isOrthogonal
        ? orthogonalRouteVertices(
            { x: sourceX, y: sourceY },
            sourcePosition,
            bendPoints,
            { x: targetX, y: targetY },
            targetPosition
          )
        : null,
    [isOrthogonal, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, bendPoints]
  )

  // Routing (ADR 0057) lives in the shared buildEdgePath, which the SVG export calls too (ADR
  // 0124), so the exported file draws the same geometry.
  const edgePath = useMemo(
    () =>
      buildEdgePath(
        routingStyle,
        { x: sourceX, y: sourceY, side: sourcePosition },
        { x: targetX, y: targetY, side: targetPosition },
        bendPoints,
        edgeStraightSegmentLength
      ),
    [
      routingStyle,
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      bendPoints,
      edgeStraightSegmentLength
    ]
  )

  const labelRatio = edgeStyle?.labelPosition
  const { x: labelX, y: labelY } = useMemo(
    () => pointAtRatio(edgePath, labelRatio ?? 0.5),
    [edgePath, labelRatio]
  )

  // Opacity is per channel (strokeOpacity/fontOpacity), not one whole-element value (see
  // FontStyle.fontOpacity for why). Each is baked into its own colour with color-mix()
  // (withOpacity) and applied separately to the path and the label, because EdgeLabelRenderer
  // portals the label into a DOM container outside the SVG, so it isn't a descendant of the path
  // and inherits nothing from it. Width is always a concrete number, not CSS's default, since a
  // selected edge needs a real base to add the selection delta to (SELECTED_STROKE_WIDTH_DELTA
  // above).
  const baseStrokeWidth =
    highlightMatches.length === 1
      ? HIGHLIGHT_BORDER_WIDTH
      : (edgeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH)
  const computedStyle: CSSProperties = {
    ...style,
    // Always a concrete value, same as strokeWidth below — falls back to
    // EDGE_STYLE_DEFAULTS.stroke rather than leaving `stroke` unset for CSS to
    // fill in (see that constant's own comment). strokeOpacity now applies
    // to the default color too, not just an explicit one — previously a
    // strokeOpacity set with no explicit stroke was silently a no-op,
    // since this whole key was omitted in that case.
    stroke: withOpacity(
      edgeStyle?.stroke
        ? themeAdaptiveColor(edgeStyle.stroke, theme)
        : EDGE_STYLE_DEFAULTS.stroke[theme],
      edgeStyle?.strokeOpacity
    ),
    strokeWidth: selected ? baseStrokeWidth + SELECTED_STROKE_WIDTH_DELTA : baseStrokeWidth,
    ...(edgeStyle?.lineStyle ? { strokeDasharray: DASH_ARRAY[edgeStyle.lineStyle] } : {}),
    // A single matching highlight overrides the stroke color, same
    // treatment as EntityNode/ContainerNode's border override — see
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
    // Selection wins over both the edge's explicit colour and any highlight-match colour, so a
    // selected edge stays findable in a busy diagram whatever its own look; otherwise it is easy to
    // lose track of even with correct handle priority (docs/known-issues.md).
    //
    // A CSS variable (set once on the <ReactFlow> wrapper in Canvas.tsx), not a DiagramContext
    // field (ADR 0056): it matters only to the selected edge, so reading it through Context would
    // re-render every edge when it changes. The browser resolves the variable directly, with no
    // re-render even for the selected edge.
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

  // Manual bend points — catmull-rom routing only. Dragging repositions
  // data.points[index] directly, in the same absolute canvas coordinates
  // the schema already stores them in. (step/smoothstep get draggable
  // *segments* instead — see onSegmentPointerDown below.)
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

  // Draggable segments for step/smoothstep routing (ADR 0077). Each handle
  // sits at a segment midpoint; dragging moves that whole segment along its
  // normal, keeping every corner at 90°. The vertex list is frozen at
  // pointer-down so the segment index the gesture holds stays valid even as
  // moveOrthogonalSegment adds/removes waypoints under it; the result is only
  // simplified (redundant corners dropped) on release.
  const segmentHandles = useMemo<OrthoSegment[]>(
    () => (orthoVertices ? orthogonalSegments(orthoVertices) : []),
    [orthoVertices]
  )

  const onSegmentPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, segment: OrthoSegment): void => {
      event.stopPropagation()
      if (!orthoVertices) return
      const frozen = orthoVertices
      pushSnapshot()
      setDraggingSegmentIndex(segment.index)
      const el = event.currentTarget
      el.setPointerCapture(event.pointerId)
      const apply = (moveEvent: PointerEvent, simplifyResult: boolean): void => {
        const flowPoint = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        const value = segment.axis === 'h' ? flowPoint.y : flowPoint.x
        updateEdgeData(id, {
          points: moveOrthogonalSegment(frozen, segment.index, segment.axis, value, simplifyResult)
        })
      }
      const onMove = (moveEvent: PointerEvent): void => apply(moveEvent, false)
      const onUp = (upEvent: PointerEvent): void => {
        apply(upEvent, true)
        el.releasePointerCapture(event.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setDraggingSegmentIndex(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [orthoVertices, pushSnapshot, screenToFlowPosition, updateEdgeData, id]
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
      {/* Invisible hover surface — see HOVER_HIT_WIDTH. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={HOVER_HIT_WIDTH}
        style={{ pointerEvents: 'stroke' }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
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
            multiline
            style={labelStyle}
            value={String(data?.label ?? '')}
            onCommit={(label) => updateEdgeData(id, { label })}
          />
        </div>
        {highlightMatches.length >= 2 && (
          // Offset above the label point, same anchor coordinates — an
          // edge has no "corner" the way a node does, so this is the
          // closest equivalent to EntityNode/ContainerNode's chip
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
        {/* Unlike the catmull-rom bend points (always mounted, opacity-hidden),
            segment handles mount only while visible — an invisible handle
            still captures pointer events, and a busy diagram of step edges
            would otherwise scatter click-eating hotspots at every crossbar.
            `segmentHandlesVisible` stays true for the whole drag gesture
            (draggingSegmentIndex !== null), so pointer capture is never
            interrupted by an unmount. */}
        {isOrthogonal &&
          segmentHandlesVisible &&
          segmentHandles.map((segment) => (
            <div
              key={segment.index}
              className={`edge-segment-handle edge-segment-handle-${segment.axis} nodrag nopan`}
              style={{
                position: 'absolute',
                width: segment.axis === 'h' ? SEGMENT_HANDLE_LONG : SEGMENT_HANDLE_SHORT,
                height: segment.axis === 'h' ? SEGMENT_HANDLE_SHORT : SEGMENT_HANDLE_LONG,
                transform: `translate(-50%, -50%) translate(${segment.mid.x}px, ${segment.mid.y}px)`
              }}
              onPointerDown={(event) => onSegmentPointerDown(event, segment)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(LabeledEdge)
