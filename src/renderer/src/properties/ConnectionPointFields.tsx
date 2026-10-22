import { useRef } from 'react'
import type { Node } from '@xyflow/react'
import type { ConnectionPoint, ConnectionPointSide } from '@shared/diagram'
import { connectionPointCountForSide } from '../nodes/connectionPoints'
import { CollapsibleSection, NumberField } from '../ui/fields'

const CONNECTION_POINT_SIDES: ConnectionPointSide[] = ['top', 'right', 'bottom', 'left']

const CONNECTION_POINT_SIDE_LABELS: Record<ConnectionPointSide, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left'
}

// Single-node selection only: unlike the style fields above, a count reads from and structurally
// rewrites one node's own connectionPoints and edges, which doesn't generalize to "apply this patch
// to every selected node" the way a colour or opacity does.
//
// Applies on blur/Enter (onSessionEnd), not per keystroke like the panel's other NumberFields:
// commit regenerates points and can transfer edges between handles, so typing "12" must not run
// that as "1" then "12". A ref tracks the in-progress value between onChange and onSessionEnd.
export function ConnectionPointFields({
  node,
  maxPerSide,
  onSetCount
}: {
  node: Node
  maxPerSide: number
  onSetCount: (side: ConnectionPointSide, totalCount: number) => void
}): React.JSX.Element {
  const customPoints = (node.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
  const pending = useRef<Partial<Record<ConnectionPointSide, number>>>({})

  return (
    <CollapsibleSection title="Connection points">
      {CONNECTION_POINT_SIDES.map((side) => {
        const count = connectionPointCountForSide(customPoints, side)
        return (
          <NumberField
            key={side}
            label={CONNECTION_POINT_SIDE_LABELS[side]}
            value={count}
            mixed={false}
            min={1}
            max={maxPerSide}
            onChange={(v) => {
              pending.current[side] = v
            }}
            onSessionStart={() => {}}
            onSessionEnd={() => {
              const v = pending.current[side]
              pending.current[side] = undefined
              if (v != null && v !== count) onSetCount(side, Math.min(maxPerSide, Math.max(1, v)))
            }}
          />
        )
      })}
    </CollapsibleSection>
  )
}
