import type { Node } from '@xyflow/react'
import type { NodeStyle } from '@shared/diagram'
import type { TransformPatch } from './transformPatch'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import { displayColor } from '@shared/styling/styleDefaults'
import {
  CollapsibleSection,
  ColorField,
  FieldRow,
  NumberField,
  SliderField,
  SelectField
} from '../ui/fields'
import { computeFieldValue } from './fieldValue'
import { GROUP_PALETTE, withStoredFonts } from '../styling/fontOptions'
import { nodeStyleOf, nodeDefaultsOf } from './styleAccess'
import { FONT_FAMILY_OPTIONS } from './fontFamilyOptions'

// Fill/Border/Font/Transform — shared between entity and container nodes per
// ADR 0014's grouping (container fill is customizable now, deliberately no
// longer hardcoded-transparent). `includeTextAlign` distinguishes the one
// field difference from TextFields below (font-only, no fill/border).
export function NodeStyleFields({
  nodes,
  minWidth,
  minHeight,
  includeRotation,
  updateStyle,
  updateTransform,
  updateLocked,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot
}: {
  nodes: Node[]
  minWidth: number
  minHeight: number
  includeRotation: boolean
  updateStyle: (patch: Partial<NodeStyle>) => void
  updateTransform: (patch: TransformPatch) => void
  updateLocked: (locked: boolean) => void
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
}): React.JSX.Element {
  const { theme, paletteColors, paletteFonts } = useDiagramContext()
  const fontFamilyOptions = withStoredFonts(
    [
      ...FONT_FAMILY_OPTIONS,
      ...paletteFonts.map((f) => ({ value: f, label: f, group: GROUP_PALETTE }))
    ],
    nodes.map((n) => nodeStyleOf(n).fontFamily)
  )
  const shownColor = (n: Node, field: 'fill' | 'stroke' | 'fontColor'): string =>
    displayColor(nodeStyleOf(n)[field], nodeDefaultsOf(n)[field], theme, themeAdaptiveColor)
  const fill = computeFieldValue(nodes, (n) => shownColor(n, 'fill'))
  const fillOpacity = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).fillOpacity ?? nodeDefaultsOf(n).fillOpacity
  )
  const stroke = computeFieldValue(nodes, (n) => shownColor(n, 'stroke'))
  const strokeOpacity = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).strokeOpacity ?? nodeDefaultsOf(n).strokeOpacity
  )
  const strokeWidth = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).strokeWidth ?? nodeDefaultsOf(n).strokeWidth
  )
  const fontSize = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).fontSize ?? nodeDefaultsOf(n).fontSize
  )
  const fontColor = computeFieldValue(nodes, (n) => shownColor(n, 'fontColor'))
  const fontOpacity = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).fontOpacity ?? nodeDefaultsOf(n).fontOpacity
  )
  const fontWeight = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).fontWeight ?? nodeDefaultsOf(n).fontWeight
  )
  const fontFamily = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontFamily)
  const textAlign = computeFieldValue(
    nodes,
    (n) => nodeStyleOf(n).textAlign ?? nodeDefaultsOf(n).textAlign
  )
  const x = computeFieldValue(nodes, (n) => n.position.x)
  const y = computeFieldValue(nodes, (n) => n.position.y)
  const width = computeFieldValue(nodes, (n) => n.width ?? undefined)
  const height = computeFieldValue(nodes, (n) => n.height ?? undefined)
  const rotation = computeFieldValue(nodes, (n) =>
    typeof n.data?.rotation === 'number' ? (n.data.rotation as number) : 0
  )
  const locked = computeFieldValue(nodes, (n) => n.data?.locked === true)

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
          title="Blocks drag/resize/rotate and accidental delete via the canvas — every other edit (this panel, tags, connection points) stays allowed"
        />
      </FieldRow>
      <CollapsibleSection title="Fill">
        <ColorField
          label="Fill"
          value={fill.value}
          mixed={fill.mixed}
          onChange={(v) => updateStyle({ fill: themeAdaptiveColor(v, theme) })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
          paletteColors={paletteColors}
        />
        <SliderField
          label="Opacity"
          value={fillOpacity.value}
          mixed={fillOpacity.mixed}
          onChange={(v) => updateStyle({ fillOpacity: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Border">
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
      </CollapsibleSection>
      <CollapsibleSection title="Font">
        <SelectField
          label="Name"
          value={fontFamily.value ?? ''}
          mixed={fontFamily.mixed}
          options={fontFamilyOptions}
          onChange={(v) => updateStyle({ fontFamily: v === '' ? undefined : v })}
          pushSnapshot={pushSnapshot}
        />
        <NumberField
          label="Size"
          value={fontSize.value}
          mixed={fontSize.mixed}
          min={1}
          onChange={(v) => updateStyle({ fontSize: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <ColorField
          label="Color"
          value={fontColor.value}
          mixed={fontColor.mixed}
          onChange={(v) => updateStyle({ fontColor: themeAdaptiveColor(v, theme) })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
          paletteColors={paletteColors}
        />
        <SliderField
          label="Opacity"
          value={fontOpacity.value}
          mixed={fontOpacity.mixed}
          onChange={(v) => updateStyle({ fontOpacity: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <SelectField
          label="Weight"
          value={fontWeight.value}
          mixed={fontWeight.mixed}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'bold', label: 'Bold' }
          ]}
          onChange={(v) => updateStyle({ fontWeight: v })}
          pushSnapshot={pushSnapshot}
        />
        <SelectField
          label="Align"
          value={textAlign.value}
          mixed={textAlign.mixed}
          options={[
            { value: 'start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'end', label: 'End' }
          ]}
          onChange={(v) => updateStyle({ textAlign: v })}
          pushSnapshot={pushSnapshot}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Transform">
        <NumberField
          label="X"
          value={x.value}
          mixed={x.mixed}
          onChange={(v) => updateTransform({ x: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <NumberField
          label="Y"
          value={y.value}
          mixed={y.mixed}
          onChange={(v) => updateTransform({ y: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <NumberField
          label="Width"
          value={width.value}
          mixed={width.mixed}
          min={minWidth}
          onChange={(v) => updateTransform({ width: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <NumberField
          label="Height"
          value={height.value}
          mixed={height.mixed}
          min={minHeight}
          onChange={(v) => updateTransform({ height: v })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        {includeRotation && (
          <NumberField
            label="Rotation"
            value={rotation.value}
            mixed={rotation.mixed}
            onChange={(v) => updateTransform({ rotation: v })}
            onSessionStart={beginContinuousEdit}
            onSessionEnd={endContinuousEdit}
          />
        )}
      </CollapsibleSection>
    </>
  )
}
