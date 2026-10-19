import type { MouseEvent } from 'react'
import { Handle } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { SIDE_POSITION, connectionPointStyle, effectiveConnectionPoints } from './connectionPoints'

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
  return (
    <>
      {effectiveConnectionPoints(storedPoints).map((point) => (
        <Handle
          key={point.id}
          type="source"
          position={SIDE_POSITION[point.side]}
          id={point.id}
          style={connectionPointStyle(point.side, point.offset)}
          onContextMenu={(event) => onPointContextMenu(event, point)}
        />
      ))}
    </>
  )
}
