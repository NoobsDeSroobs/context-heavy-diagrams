import type { Node } from '@xyflow/react'
import {
  CONTAINER_LABEL_SIDES,
  CONTAINER_LABEL_SIDE_NAMES,
  containerLabelSideOf,
  type ContainerLabelSide
} from '@shared/nodes/containerLabel'
import { SelectField } from '../ui/fields'

// The side of its container a label sits on: the top of the text points at that side. The
// container's look, size and place use the same fields as any other node.
export function ContainerFields({
  nodes,
  onSetLabelSide
}: {
  nodes: Node[]
  onSetLabelSide: (side: ContainerLabelSide) => void
}): React.JSX.Element {
  const sides = new Set(nodes.map((n) => containerLabelSideOf(n.data?.labelPosition)))
  return (
    <SelectField
      label="Label side"
      value={sides.size === 1 ? [...sides][0] : undefined}
      mixed={sides.size > 1}
      options={CONTAINER_LABEL_SIDES.map((s) => ({
        value: s,
        label: CONTAINER_LABEL_SIDE_NAMES[s]
      }))}
      // The change takes its own undo snapshot.
      pushSnapshot={() => undefined}
      onChange={onSetLabelSide}
    />
  )
}
