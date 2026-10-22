import type { Node } from '@xyflow/react'
import type { NodeStyle } from '@shared/diagram'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import { LINE_STYLE_DEFAULTS } from '@shared/styling/styleDefaults'
import {
  CollapsibleSection,
  ColorField,
  FieldRow,
  NumberField,
  SliderField,
  SelectField
} from '../ui/fields'
import { computeFieldValue } from './fieldValue'
import { MARKER_OPTIONS } from '../edges/edgeStyleOptions'
import { nodeStyleOf } from './styleAccess'

// 'line' nodes (see ADR 0050) — same Start/Line/End shape as
// EdgeFields above, reading/writing NodeStyle instead of EdgeStyle (they
// share the same lineStyle/startMarker/endMarker fields), plus Locked
// since a line has a real position/bounding box unlike an edge. No Fill/
// Font/Transform — a line has no fill and no label in this pass, and its
// shape is edited by dragging its own points on the canvas, not numeric
// fields here.
export function LineStyleFields({
  nodes,
  updateStyle,
  updateLocked,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot
}: {
  nodes: Node[]
  updateStyle: (patch: Partial<NodeStyle>) => void
  updateLocked: (locked: boolean) => void
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
}): React.JSX.Element {
  const { theme, paletteColors } = useDiagramContext()
  const locked = computeFieldValue(nodes, (n) => n.data?.locked === true)
  const startMarker = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).startMarker ?? LINE_STYLE_DEFAULTS.startMarker
  )
  const endMarker = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).endMarker ?? LINE_STYLE_DEFAULTS.endMarker
  )
  // A line's default colour is a stored-form (dark baseline) value, flipped for the theme like any stored one.
  const stroke = computeFieldValue(nodes, (n) =>
    themeAdaptiveColor(nodeStyleOf(n).stroke ?? LINE_STYLE_DEFAULTS.stroke, theme)
  )
  const strokeOpacity = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).strokeOpacity ?? LINE_STYLE_DEFAULTS.strokeOpacity
  )
  const strokeWidth = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).strokeWidth ?? LINE_STYLE_DEFAULTS.strokeWidth
  )
  const lineStyle = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).lineStyle ?? LINE_STYLE_DEFAULTS.lineStyle
  )

  return (
    <>
      <FieldRow label="Locked">
        <input
          type="checkbox"
          checked={locked.value ?? false}
          ref={(el) => {
            if (el) el.indeterminate = locked.mixed
          }}
          onChange={(e) => {
            pushSnapshot()
            updateLocked(e.target.checked)
          }}
          title="Blocks moving/editing the line's own points via the canvas — this panel stays allowed"
        />
      </FieldRow>
      <CollapsibleSection title="Start">
        <SelectField
          label="Marker"
          value={startMarker.value}
          mixed={startMarker.mixed}
          options={MARKER_OPTIONS}
          onChange={(v) => updateStyle({ startMarker: v })}
          pushSnapshot={pushSnapshot}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Line">
        <ColorField
          label="Color"
          value={stroke.value}
          mixed={stroke.mixed}
          onChange={(v) => updateStyle({ stroke: themeAdaptiveColor(v, theme) })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
          paletteColors={paletteColors}
        />
        <SliderField
          label="Opacity"
          value={strokeOpacity.value}
          mixed={strokeOpacity.mixed}
          onChange={(v) => updateStyle({ strokeOpacity: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <NumberField
          label="Width"
          value={strokeWidth.value}
          mixed={strokeWidth.mixed}
          min={0}
          onChange={(v) => updateStyle({ strokeWidth: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <SelectField
          label="Style"
          value={lineStyle.value}
          mixed={lineStyle.mixed}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'dotted', label: 'Dotted' }
          ]}
          onChange={(v) => updateStyle({ lineStyle: v })}
          pushSnapshot={pushSnapshot}
        />
      </CollapsibleSection>
      <CollapsibleSection title="End">
        <SelectField
          label="Marker"
          value={endMarker.value}
          mixed={endMarker.mixed}
          options={MARKER_OPTIONS}
          onChange={(v) => updateStyle({ endMarker: v })}
          pushSnapshot={pushSnapshot}
        />
      </CollapsibleSection>
    </>
  )
}
