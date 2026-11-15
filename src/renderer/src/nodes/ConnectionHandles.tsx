import type { MouseEvent } from 'react'
import { useEffect } from 'react'
import { Handle, useNodeId, useUpdateNodeInternals } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { SIDE_POSITION, connectionPointStyle, effectiveConnectionPoints } from './connectionPoints'
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
