import type { MouseEvent } from 'react'
import { Handle } from '@xyflow/react'
import type { ConnectionPoint } from '@shared/diagram'
import { SIDE_POSITION, connectionPointStyle, effectiveConnectionPoints } from './connectionPoints'

// Every point a node's sides currently have — shared between ShapeNode and
// ContainerNode. Split into its own file (kept out of connectionPoints.ts)
// so that file stays component-free — mixing a component export with
// hook/function exports in one file breaks React Fast Refresh.
//
// This originally special-cased 4 always-present, unmovable default
// points here (hardcoded, no style override, no context menu) plus
// whatever was in `storedPoints`. That split turned out to be the root
// cause of two real bugs the user found — every point a side has is now
// rendered uniformly from `effectiveConnectionPoints`, which synthesizes a
// side's implicit single centered point only where nothing's been stored
// for it yet (see that function's own comment).
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
