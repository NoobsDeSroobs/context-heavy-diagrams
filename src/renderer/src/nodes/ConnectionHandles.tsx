import type { MouseEvent } from 'react'
import { useEffect } from 'react'
import { Handle, Position, useConnection, useNodeId, useUpdateNodeInternals } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import {
  AUTO_HANDLE,
  SIDE_POSITION,
  connectionPointStyle,
  effectiveConnectionPoints
} from './connectionPoints'
import { usePointSlide } from './pointSlideStore'

// One handle, placed on its slot plus the slide the canvas worked out. React Flow reads the handle's
// place from the page, so it is told whenever the place moves.
function SlidingHandle({
  nodeId,
  point,
  onContextMenu
}: {
  nodeId: string | null
  point: ConnectionPoint
  onContextMenu: (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => void
}): React.JSX.Element {
  const slide = usePointSlide(nodeId ?? '', point.id)
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    if (nodeId) updateNodeInternals(nodeId)
  }, [nodeId, slide, updateNodeInternals])
  return (
    <Handle
      type="source"
      position={SIDE_POSITION[point.side]}
      id={point.id}
      style={connectionPointStyle(point.side, point.offset, slide)}
      onContextMenu={(event) => onContextMenu(event, point)}
    />
  )
}

// Every point a node's sides currently have, shared by EntityNode and ContainerNode. A separate
// file from connectionPoints.ts so that one stays component-free (a component export mixed with
// hook/function exports breaks React Fast Refresh). Every point a side has is rendered uniformly
// from `effectiveConnectionPoints`, which synthesizes a side's implicit single centred point only
// where nothing is stored. (Special-casing four always-present, unmovable defaults here, with no
// style override or context menu, was the root cause of two real bugs.)
// The target an edge is dropped on to attach to the element by itself, in the middle of it, shown
// only while a connection is being dragged (ADR 0178).
function AutoTarget(): React.JSX.Element {
  const connecting = useConnection((c) => c.inProgress)
  return (
    <Handle
      type="source"
      position={Position.Top}
      id={AUTO_HANDLE}
      className={connecting ? 'chd-auto-target chd-auto-target--live' : 'chd-auto-target'}
      style={{ top: '50%', left: '50%' }}
    />
  )
}

export function ConnectionHandles({
  storedPoints,
  onPointContextMenu
}: {
  storedPoints: ConnectionPoint[]
  onPointContextMenu: (event: MouseEvent<HTMLDivElement>, point: ConnectionPoint) => void
}): React.JSX.Element {
  const nodeId = useNodeId()
  return (
    <>
      <AutoTarget />
      {effectiveConnectionPoints(storedPoints).map((point) => (
        <SlidingHandle
          key={point.id}
          nodeId={nodeId}
          point={point}
          onContextMenu={onPointContextMenu}
        />
      ))}
    </>
  )
}
