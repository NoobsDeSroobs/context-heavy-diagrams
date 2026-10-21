import {
  memo,
  useCallback,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useReactFlow, type NodeProps, type ReactFlowInstance } from '@xyflow/react'
import type { LinePoint, LineStyleKind, NodeStyle } from '@shared/diagram'
import LockBadge from '../tagging/LockBadge'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { withOpacity } from '../styling/colorOpacity'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import { LINE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import { markerUrl } from '../edges/markerIds'
import {
  buildBendablePath,
  nearestSegmentIndex,
  pointsBoundingBox
} from '@shared/geometry/bendablePath'

// Padding around the raw point bounding box, in flow units — room for the
// point handles/stroke to render without clipping against the node's own
// wrapper. Exported so Canvas.tsx's addLineNode can size a freshly spawned
// line consistently with what dragging/editing later settles into.
export const LINE_BOUNDS_PADDING = 10
const LINE_POINT_HANDLE_SIZE = 10
// A line's default colour and width are data in styleDefaults.ts (ADR 0117), shared
// with the property panel.
const DEFAULT_STROKE = LINE_STYLE_DEFAULTS.stroke
const DEFAULT_STROKE_WIDTH = LINE_STYLE_DEFAULTS.strokeWidth
const SELECTED_STROKE_WIDTH_DELTA = 1

// Small local copy, not imported from LabeledEdge.tsx — that file already
// can't export a second named value alongside its default component export
// (react-refresh/only-export-components), and this table is 3 lines.
const DASH_ARRAY: Record<Exclude<LineStyleKind, undefined>, string | undefined> = {
  solid: undefined,
  dashed: '8 6',
  dotted: '2 4'
}

// Recomputes the padded bounding box from an explicit (node, points) pair
// and commits position/width/height/data.points in one updateNode call —
// deliberately not a read-modify-write against the live store (see ADR
// 0050's implementation notes): every caller already has
// both the node and the points it wants applied in hand.
function normalizeLineBounds(
  rf: ReactFlowInstance,
  id: string,
  node: { position: { x: number; y: number }; data?: Record<string, unknown> },
  points: LinePoint[]
): void {
  const absolute = points.map((p) => ({
    x: node.position.x + p.x,
    y: node.position.y + p.y,
    gravity: p.gravity
  }))
  const { minX, minY, maxX, maxY } = pointsBoundingBox(absolute)
  const newPosition = { x: minX - LINE_BOUNDS_PADDING, y: minY - LINE_BOUNDS_PADDING }
  const width = maxX - minX + LINE_BOUNDS_PADDING * 2
  const height = maxY - minY + LINE_BOUNDS_PADDING * 2
  const localPoints = absolute.map((p) => ({
    x: p.x - newPosition.x,
    y: p.y - newPosition.y,
    gravity: p.gravity
  }))
  rf.updateNode(id, {
    position: newPosition,
    width,
    height,
    data: { ...node.data, points: localPoints }
  })
}

// One shared empty list, so a line with no points has a stable `points` identity
// across renders and the callbacks below that depend on it are not re-created.
const NO_POINTS: LinePoint[] = []

// A freeform curved line (see ADR 0050) — an ordered list of points,
// each with an optional "gravity" (Catmull-Rom tension) controlling how
// much the curve bends there. Deliberately its own node type rather than
// reusing/extending edges — see the ADR for why. Never connectable, never
// rotated, never carries metadata (same treatment as text/anchor nodes).
function LineNode({ id, data, selected }: NodeProps): React.JSX.Element {
  const {
    openContextMenu,
    pushSnapshot,
    theme,
    gravityPresets,
    entityHighlightNodeId,
    selectAllOfType
  } = useDiagramContext()
  const rf = useReactFlow()
  const { getNode, updateNodeData, screenToFlowPosition } = rf

  const locked = data?.locked === true
  const points = (data?.points as LinePoint[] | undefined) ?? NO_POINTS
  const style = (data?.style ?? {}) as NodeStyle
  const path = buildBendablePath(points)

  const baseStrokeWidth = style.strokeWidth ?? DEFAULT_STROKE_WIDTH
  const computedStyle: CSSProperties = {
    stroke: withOpacity(
      themeAdaptiveColor(style.stroke ?? DEFAULT_STROKE, theme),
      style.strokeOpacity
    ),
    strokeWidth: selected ? baseStrokeWidth + SELECTED_STROKE_WIDTH_DELTA : baseStrokeWidth,
    strokeDasharray: DASH_ARRAY[style.lineStyle ?? 'solid'],
    fill: 'none'
  }

  const onPointPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
      if (locked) return
      event.stopPropagation()
      pushSnapshot()
      const node = getNode(id)
      if (!node) return
      const nodePosition = node.position
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)

      const onMove = (moveEvent: PointerEvent): void => {
        const flowPoint = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        updateNodeData(id, {
          points: points.map((p, i) =>
            i === index
              ? { ...p, x: flowPoint.x - nodePosition.x, y: flowPoint.y - nodePosition.y }
              : p
          )
        })
      }
      const onUp = (): void => {
        target.releasePointerCapture(event.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        const latest = getNode(id)
        if (latest) {
          normalizeLineBounds(
            rf,
            id,
            latest,
            (latest.data?.points as LinePoint[] | undefined) ?? points
          )
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [locked, points, id, pushSnapshot, getNode, screenToFlowPosition, updateNodeData, rf]
  )

  const onPointContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>, index: number) => {
      if (locked) return
      event.preventDefault()
      event.stopPropagation()
      const isEndpoint = index === 0 || index === points.length - 1
      const setGravity = (gravity: number): void => {
        pushSnapshot()
        updateNodeData(id, { points: points.map((p, i) => (i === index ? { ...p, gravity } : p)) })
      }
      openContextMenu(event.clientX, event.clientY, [
        ...gravityPresets.map((preset) => ({
          label: preset.label,
          onSelect: () => setGravity(preset.value)
        })),
        ...(isEndpoint
          ? []
          : [
              {
                label: 'Remove point',
                separatorBefore: true,
                onSelect: () => {
                  const node = getNode(id)
                  if (!node) return
                  pushSnapshot()
                  normalizeLineBounds(
                    rf,
                    id,
                    node,
                    points.filter((_, i) => i !== index)
                  )
                }
              }
            ]),
        // Reachable via any point since right-clicking the line's own body
        // (not a point) skips a menu entirely — it adds a point immediately
        // instead (onPathContextMenu below). See ADR 0065.
        {
          label: 'Select all lines',
          separatorBefore: isEndpoint,
          onSelect: () => selectAllOfType('line')
        }
      ])
    },
    [
      locked,
      points,
      id,
      openContextMenu,
      pushSnapshot,
      updateNodeData,
      getNode,
      rf,
      gravityPresets,
      selectAllOfType
    ]
  )

  const onPathContextMenu = useCallback(
    (event: MouseEvent<SVGPathElement>) => {
      if (locked) return
      event.preventDefault()
      event.stopPropagation()
      const node = getNode(id)
      if (!node) return
      const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const local = { x: flowPoint.x - node.position.x, y: flowPoint.y - node.position.y }
      const segmentIndex = nearestSegmentIndex(points, local)
      const newPoints = [...points]
      // No explicit gravity — falls back to bendablePath's own default
      // (0.5), same "absent means the standard value" convention as the
      // rest of this schema, rather than redundantly stamping it here.
      newPoints.splice(segmentIndex + 1, 0, { x: local.x, y: local.y })
      pushSnapshot()
      normalizeLineBounds(rf, id, node, newPoints)
    },
    [locked, points, id, getNode, screenToFlowPosition, pushSnapshot, rf]
  )

  return (
    <div
      className="line-node"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Wide invisible stroke purely as a comfortable right-click hit
            target — the visible path's own stroke is often too thin to
            reliably right-click at typical zoom levels. */}
        <path
          d={path}
          stroke="transparent"
          strokeWidth={Math.max(baseStrokeWidth, 14)}
          fill="none"
          style={{ pointerEvents: 'stroke' }}
          onContextMenu={onPathContextMenu}
        />
        {/* Layer panel's "point at" indicator (ADR 0035) — EntityNode/
            ContainerNode/TextNode do this with a CSS outline on their own
            (filled, roughly-rectangular) box, but that reads wrong on a
            sparse/concave curve where the bounding box is mostly empty
            space (the same reason the hit-testing fix exists) — a halo
            traced along the curve itself instead, painted under the real
            stroke so it peeks out on either side. */}
        {entityHighlightNodeId === id && (
          <path
            d={path}
            stroke="var(--ev-c-text-1)"
            strokeWidth={baseStrokeWidth + 6}
            strokeDasharray="4 3"
            fill="none"
            style={{ pointerEvents: 'none' }}
          />
        )}
        <path
          d={path}
          style={{ ...computedStyle, pointerEvents: 'none' }}
          markerStart={markerUrl(style.startMarker)}
          markerEnd={markerUrl(style.endMarker)}
        />
      </svg>
      {locked && <LockBadge />}
      {!locked &&
        points.map((point, index) => (
          <div
            key={index}
            className="line-node-point nodrag nopan"
            style={{
              position: 'absolute',
              left: point.x,
              top: point.y,
              width: LINE_POINT_HANDLE_SIZE,
              height: LINE_POINT_HANDLE_SIZE,
              transform: 'translate(-50%, -50%)'
            }}
            onPointerDown={(event) => onPointPointerDown(event, index)}
            onContextMenu={(event) => onPointContextMenu(event, index)}
          />
        ))}
    </div>
  )
}

export default memo(LineNode)
