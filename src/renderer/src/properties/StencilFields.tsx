import type { Node } from '@xyflow/react'
import { STENCIL_KINDS, stencilKind } from '@shared/stencils/kinds'
import { SelectField } from '../ui/fields'

// The kind of the selected steps and events (ADR 0180), the one thing a stencil has that an entity
// does not. Its look, size and place use the same fields as any other node.
export function StencilFields({
  nodes,
  onSetKind
}: {
  nodes: Node[]
  onSetKind: (kindId: string) => void
}): React.JSX.Element {
  const kinds = new Set(
    nodes.map((n) => stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined).id)
  )
  const only = kinds.size === 1 ? [...kinds][0] : undefined
  return (
    <SelectField
      label="Kind"
      value={only}
      mixed={kinds.size > 1}
      options={STENCIL_KINDS.map((k) => ({
        value: k.id,
        label: k.name,
        group: k.group,
        terms: k.terms.join(' ')
      }))}
      // Changing the kind takes its own undo snapshot (it also changes the label and the size).
      pushSnapshot={() => undefined}
      onChange={onSetKind}
    />
  )
}
