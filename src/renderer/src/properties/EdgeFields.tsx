import type { Edge } from '@xyflow/react'
import type { EdgeStyle } from '@shared/diagram'
import { useDiagramContext } from '../canvas/useDiagramContext'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import { EDGE_STYLE_DEFAULTS, displayColor } from '@shared/styling/styleDefaults'
import { MAX_ANIMATION_SPEED, MIN_ANIMATION_SPEED, knownSpeed } from '@shared/styling/edgeAnimation'
import { MAX_DASH_PART, MIN_DASH_PART, dashPattern, knownDashPart } from '@shared/styling/edgeDash'
import { CollapsibleSection, ColorField, NumberField, SliderField, SelectField } from '../ui/fields'
import { computeFieldValue } from './fieldValue'
import { MARKER_OPTIONS } from '../edges/edgeStyleOptions'
import { defaultFontLabel, useFontOptions } from '../styling/useFontOptions'
import { edgeStyleOf } from './styleAccess'

// '' means the field is absent: a real style.routingStyle value, not a placeholder (the same '' ===
// "no override" pattern as fontFamily below). 'straight'/'step'/'smoothstep' are React Flow's
// built-in path shapes; 'catmullRom' reuses the freeform-line curve math (ADR 0050,
// bendablePath.ts) with this edge's manual bend points (ADR 0057). A local copy, not shared with
// PreferencesPanel.tsx's identical default-routing-style picker, because this file can't export a
// second named value next to its default component export (react-refresh/only-export-components).
const ROUTING_STYLE_OPTIONS: {
  value: Exclude<EdgeStyle['routingStyle'], undefined> | ''
  label: string
}[] = [
  { value: '', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
  { value: 'catmullRom', label: 'Catmull-Rom (gravity)' }
]

// '' is no animation: the field is absent in the file (ADR 0141).
const ANIMATION_OPTIONS: {
  value: Exclude<EdgeStyle['animation'], undefined> | ''
  label: string
}[] = [
  { value: '', label: 'None' },
  { value: 'flow', label: 'Flow (dashes move along the line)' },
  { value: 'pulse', label: 'Pulse (a dot moves along the line)' }
]

// '' is forward, the field absent in the file.
const ANIMATION_DIRECTION_OPTIONS: {
  value: Exclude<EdgeStyle['animationDirection'], undefined> | ''
  label: string
}[] = [
  { value: '', label: 'Forward (source to target)' },
  { value: 'reverse', label: 'Reverse (target to source)' }
]

export function EdgeFields({
  edges,
  updateStyle,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot
}: {
  edges: Edge[]
  updateStyle: (patch: Partial<EdgeStyle>) => void
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
}): React.JSX.Element {
  const { theme, paletteColors, diagramFontFamily } = useDiagramContext()
  const fontFamilyOptions = useFontOptions(
    edges.map((e) => edgeStyleOf(e).fontFamily),
    defaultFontLabel(diagramFontFamily)
  )
  const D = EDGE_STYLE_DEFAULTS
  const startMarker = computeFieldValue(edges, (e) => edgeStyleOf(e).startMarker ?? D.startMarker)
  const endMarker = computeFieldValue(edges, (e) => edgeStyleOf(e).endMarker ?? D.endMarker)
  const stroke = computeFieldValue(edges, (e) =>
    displayColor(edgeStyleOf(e).stroke, D.stroke, theme, themeAdaptiveColor)
  )
  const strokeOpacity = computeFieldValue(
    edges,
    (e) => edgeStyleOf(e).strokeOpacity ?? D.strokeOpacity
  )
  const strokeWidth = computeFieldValue(edges, (e) => edgeStyleOf(e).strokeWidth ?? D.strokeWidth)
  const lineStyle = computeFieldValue(edges, (e) => edgeStyleOf(e).lineStyle ?? D.lineStyle)
  const routingStyle = computeFieldValue(edges, (e) => edgeStyleOf(e).routingStyle)
  const animation = computeFieldValue(edges, (e) => edgeStyleOf(e).animation)
  const animationSpeed = computeFieldValue(edges, (e) => edgeStyleOf(e).animationSpeed ?? 1)
  const animationDirection = computeFieldValue(edges, (e) => edgeStyleOf(e).animationDirection)
  // Speed and direction mean something only while an edge is animated.
  const animated = animation.mixed || animation.value !== undefined
  const pulsing = edges.some((e) => edgeStyleOf(e).animation === 'pulse')
  const pulseDistance = computeFieldValue(edges, (e) =>
    Math.max(0, edgeStyleOf(e).pulseDistance ?? 0)
  )
  // The dash length and gap are shown for a dashed, dotted or flowing line, with what it draws now.
  const dashed = edges.some((e) => {
    const s = edgeStyleOf(e)
    return (s.lineStyle ?? D.lineStyle) !== 'solid' || s.animation === 'flow'
  })
  const drawnDash = (e: Edge): ReturnType<typeof dashPattern> => {
    const s = edgeStyleOf(e)
    return dashPattern(s, s.animation === 'flow')
  }
  const dashLength = computeFieldValue(edges, (e) => drawnDash(e)?.dash)
  const dashGap = computeFieldValue(edges, (e) => drawnDash(e)?.gap)
  const fontSize = computeFieldValue(edges, (e) => edgeStyleOf(e).fontSize ?? D.fontSize)
  const fontColor = computeFieldValue(edges, (e) =>
    displayColor(edgeStyleOf(e).fontColor, D.fontColor, theme, themeAdaptiveColor)
  )
  const fontOpacity = computeFieldValue(edges, (e) => edgeStyleOf(e).fontOpacity ?? D.fontOpacity)
  const fontWeight = computeFieldValue(edges, (e) => edgeStyleOf(e).fontWeight ?? D.fontWeight)
  const fontFamily = computeFieldValue(edges, (e) => edgeStyleOf(e).fontFamily)
  const labelPosition = computeFieldValue(
    edges,
    (e) => edgeStyleOf(e).labelPosition ?? D.labelPosition
  )

  return (
    <>
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
        <SelectField
          label="Routing"
          value={routingStyle.value ?? ''}
          mixed={routingStyle.mixed}
          options={ROUTING_STYLE_OPTIONS}
          onChange={(v) => updateStyle({ routingStyle: v === '' ? undefined : v })}
          pushSnapshot={pushSnapshot}
        />
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
        {dashed && (
          <>
            <NumberField
              label="Dash length"
              value={dashLength.value}
              mixed={dashLength.mixed}
              min={MIN_DASH_PART}
              max={MAX_DASH_PART}
              onChange={(v) =>
                updateStyle({ dashLength: v === undefined ? undefined : knownDashPart(v) })
              }
              onSessionStart={beginContinuousEdit}
              onSessionEnd={endContinuousEdit}
            />
            <NumberField
              label="Dash gap"
              value={dashGap.value}
              mixed={dashGap.mixed}
              min={MIN_DASH_PART}
              max={MAX_DASH_PART}
              onChange={(v) =>
                updateStyle({ dashGap: v === undefined ? undefined : knownDashPart(v) })
              }
              onSessionStart={beginContinuousEdit}
              onSessionEnd={endContinuousEdit}
            />
          </>
        )}
        <SelectField
          label="Animation"
          value={animation.value ?? ''}
          mixed={animation.mixed}
          options={ANIMATION_OPTIONS}
          // None also drops the speed, direction and pulse distance, so no stale values are left in
          // the file.
          onChange={(v) =>
            updateStyle(
              v === ''
                ? {
                    animation: undefined,
                    animationSpeed: undefined,
                    animationDirection: undefined,
                    pulseDistance: undefined
                  }
                : { animation: v }
            )
          }
          pushSnapshot={pushSnapshot}
        />
        {animated && (
          <>
            <NumberField
              label="Speed"
              value={animationSpeed.value}
              mixed={animationSpeed.mixed}
              min={MIN_ANIMATION_SPEED}
              max={MAX_ANIMATION_SPEED}
              step={0.25}
              onChange={(v) =>
                updateStyle({
                  animationSpeed: v === undefined || knownSpeed(v) === 1 ? undefined : knownSpeed(v)
                })
              }
              onSessionStart={beginContinuousEdit}
              onSessionEnd={endContinuousEdit}
            />
            <SelectField
              label="Direction"
              value={animationDirection.value ?? ''}
              mixed={animationDirection.mixed}
              options={ANIMATION_DIRECTION_OPTIONS}
              onChange={(v) => updateStyle({ animationDirection: v === '' ? undefined : v })}
              pushSnapshot={pushSnapshot}
            />
            {pulsing && (
              <NumberField
                label="Pulse distance"
                value={pulseDistance.value}
                mixed={pulseDistance.mixed}
                min={0}
                step={10}
                // 0 is one pulse at a time, and so is a negative value; neither is stored.
                onChange={(v) =>
                  updateStyle({ pulseDistance: v === undefined || v <= 0 ? undefined : v })
                }
                onSessionStart={beginContinuousEdit}
                onSessionEnd={endContinuousEdit}
              />
            )}
          </>
        )}
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
      <CollapsibleSection title="Label">
        <SliderField
          label="Position"
          value={labelPosition.value != null ? labelPosition.value * 100 : undefined}
          mixed={labelPosition.mixed}
          defaultValue={50}
          onChange={(v) => updateStyle({ labelPosition: v == null ? undefined : v / 100 })}
          onSessionStart={beginContinuousEdit}
          onSessionEnd={endContinuousEdit}
        />
        <SelectField
          label="Font"
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
      </CollapsibleSection>
    </>
  )
}
