import { kindIsOffered, type FeatureFlags } from '@shared/features/features'
import type { Node } from '@xyflow/react'
import {
  END_OUTCOMES,
  END_REACHES,
  FLOW_POSITIONS,
  flowPositionOf,
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

// The kind of the selected behaviour (ADR 0080), the one thing a stencil has that an entity does
// not, and where the label of the small shapes sits. Its look, size and place use the same
// fields as any other node.
export function StencilFields({
  nodes,
  features,
  onSetKind,
  onSetLabelPosition,
  onSetState
}: {
  nodes: Node[]
  features: FeatureFlags
  onSetKind: (kindId: string) => void
  onSetLabelPosition: (position: LabelPosition) => void
  onSetState: (change: { outcome?: string; reach?: string; flowPosition?: string }) => void
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
  // Only an event can start a flow or sit in one.
  const events = nodes.filter(
    (n) => stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined).positioned
  )
  const flowPositions = new Set(events.map((n) => flowPositionOf(n.data?.flowPosition)))
  const outcomes = new Set(ends.map((n) => endOutcomeOf(n.data?.outcome)))
  const reaches = new Set(ends.map((n) => endReachOf(n.data?.reach)))
  return (
    <>
      <SelectField
        label="Kind"
        value={only}
        mixed={kinds.size > 1}
        // A beta's kinds are offered while it is on; one already used stays, so it still shows.
        options={STENCIL_KINDS.filter((k) => kinds.has(k.id) || kindIsOffered(k.id, features)).map(
          (k) => ({
            value: k.id,
            label: k.name,
            group: k.group,
            terms: k.terms.join(' ')
          })
        )}
        // Changing the kind takes its own undo snapshot (it also changes the label and the size).
        pushSnapshot={() => undefined}
        onChange={onSetKind}
      />
      {events.length > 0 && (
        <SelectField
          label="Position"
          value={flowPositions.size === 1 ? [...flowPositions][0] : undefined}
          mixed={flowPositions.size > 1}
          options={FLOW_POSITIONS.map((p) => ({ value: p.id, label: p.name }))}
          pushSnapshot={() => undefined}
          onChange={(flowPosition) => onSetState({ flowPosition })}
        />
      )}
      {ends.length > 0 && (
        <>
          <SelectField
            label="Outcome"
            value={outcomes.size === 1 ? [...outcomes][0] : undefined}
            mixed={outcomes.size > 1}
            options={END_OUTCOMES.map((o) => ({ value: o.id, label: o.name }))}
            pushSnapshot={() => undefined}
            onChange={(outcome) => onSetState({ outcome })}
          />
          <SelectField
            label="Reach"
            value={reaches.size === 1 ? [...reaches][0] : undefined}
            mixed={reaches.size > 1}
            options={END_REACHES.map((r) => ({ value: r.id, label: r.name }))}
            pushSnapshot={() => undefined}
            onChange={(reach) => onSetState({ reach })}
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
