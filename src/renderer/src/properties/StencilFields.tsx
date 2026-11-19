import type { Node } from '@xyflow/react'
import {
  END_OUTCOMES,
  END_REACHES,
  endOutcomeOf,
  endReachOf,
  STENCIL_KINDS,
  stencilKind,
  stencilLabelOutside
} from '@shared/stencils/kinds'
import {
  LABEL_POSITIONS,
  LABEL_POSITION_NAMES,
  labelPositionOf,
  type LabelPosition
} from '@shared/stencils/labelPlacement'
import { SelectField } from '../ui/fields'

// The kind of the selected behaviour (ADR 0180), the one thing a stencil has that an entity does
// not, and where the label of the small shapes sits (ADR 0183). Its look, size and place use the same
// fields as any other node.
export function StencilFields({
  nodes,
  onSetKind,
  onSetLabelPosition,
  onSetEnding
}: {
  nodes: Node[]
  onSetKind: (kindId: string) => void
  onSetLabelPosition: (position: LabelPosition) => void
  onSetEnding: (change: { outcome?: string; reach?: string }) => void
}): React.JSX.Element {
  const kindOf = (n: Node): string =>
    stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined).id
  const kinds = new Set(nodes.map(kindOf))
  const only = kinds.size === 1 ? [...kinds][0] : undefined
  // Only the small shapes carry their label outside; a step's label is inside it.
  const outside = nodes.filter((n) => stencilLabelOutside(kindOf(n)))
  const positions = new Set(outside.map((n) => labelPositionOf(n.data?.labelPosition)))
  const position = positions.size === 1 ? [...positions][0] : undefined
  // Only an end has an outcome and a reach: how it finishes and how far it reaches.
  const ends = nodes.filter(
    (n) => stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined).endsFlow
  )
  const outcomes = new Set(ends.map((n) => endOutcomeOf(n.data?.outcome)))
  const reaches = new Set(ends.map((n) => endReachOf(n.data?.reach)))
  return (
    <>
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
      {ends.length > 0 && (
        <>
          <SelectField
            label="Outcome"
            value={outcomes.size === 1 ? [...outcomes][0] : undefined}
            mixed={outcomes.size > 1}
            options={END_OUTCOMES.map((o) => ({ value: o.id, label: o.name }))}
            pushSnapshot={() => undefined}
            onChange={(outcome) => onSetEnding({ outcome })}
          />
          <SelectField
            label="Reach"
            value={reaches.size === 1 ? [...reaches][0] : undefined}
            mixed={reaches.size > 1}
            options={END_REACHES.map((r) => ({ value: r.id, label: r.name }))}
            pushSnapshot={() => undefined}
            onChange={(reach) => onSetEnding({ reach })}
          />
        </>
      )}
      {outside.length > 0 && (
        <SelectField
          label="Label position"
          value={position}
          mixed={positions.size > 1}
          options={LABEL_POSITIONS.map((p) => ({ value: p, label: LABEL_POSITION_NAMES[p] }))}
          // The change takes its own undo snapshot, as the kind does.
          pushSnapshot={() => undefined}
          onChange={onSetLabelPosition}
        />
      )}
    </>
  )
}
