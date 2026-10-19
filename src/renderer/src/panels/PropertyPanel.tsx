import { useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPoint,
  ConnectionPointSide,
  EdgeStyle,
  MetadataEntry,
  NodeStyle,
  RequiredTagDefinition
} from '@shared/diagram'
import { useDiagramContext } from '../useDiagramContext'
import { themeAdaptiveColor } from '../styles/themeAdaptiveColor'
import {
  EDGE_STYLE_DEFAULTS,
  LINE_STYLE_DEFAULTS,
  NODE_STYLE_DEFAULTS,
  displayColor,
  styledNodeType,
  type NodeStyleDefaults
} from '../styles/styleDefaults'
import { connectionPointCountForSide } from '../nodes/connectionPoints'
import {
  CollapsibleSection,
  ColorField,
  FieldRow,
  NumberField,
  SliderField,
  SelectField
} from './fields'
import { computeFieldValue } from './fieldValue'
import { MARKER_OPTIONS } from './edgeStyleOptions'
import { GROUP_PALETTE, GROUP_SYSTEM, withStoredFonts, type FontOption } from './fontOptions'
import MetadataSection from './MetadataSection'
import ReferencesSection from './ReferencesSection'
import { canBrushNodeType } from '../styleBrush'

export interface TransformPatch {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
}

interface PropertyPanelProps {
  selectedNodes: Node[]
  selectedEdges: Edge[]
  onUpdateNodeStyle: (nodeIds: string[], patch: Partial<NodeStyle>) => void
  onUpdateEdgeStyle: (edgeIds: string[], patch: Partial<EdgeStyle>) => void
  onUpdateTransform: (nodeIds: string[], patch: TransformPatch) => void
  onUpdateLocked: (nodeIds: string[], locked: boolean) => void
  onUpdateNodeMetadata: (
    nodeId: string,
    metadata: Record<string, MetadataEntry> | undefined
  ) => void
  onUpdateEdgeMetadata: (
    edgeId: string,
    metadata: Record<string, MetadataEntry> | undefined
  ) => void
  onSetConnectionPointCount: (nodeId: string, side: ConnectionPointSide, totalCount: number) => void
  maxConnectionPointsPerSide: number
  // Copies one selected node's current style into preferences.defaultStyles
  // for its type (ADR 0048) — only offered for entity/container/text, only
  // when exactly one node of that type is selected (a style is only
  // well-defined for a single node, not a multi-selection). Edges
  // already have their own equivalent via the toolbar swatch (ADR 0045).
  onSetDefaultStyle: (type: 'entity' | 'container' | 'text', style: NodeStyle) => void
  requiredTags: RequiredTagDefinition[]
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
  // Copy style / apply mode (ADR 0095): the panel only offers the entry point
  // and the exit; the brush itself lives in Canvas.
  styleBrushActive: boolean
  onToggleStyleBrush: () => void
}

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

// Generic CSS families only, for now: a specific named font isn't reliably available on both target
// platforms (Windows/Linux). '' is a real option meaning "no override" (see SelectField), stored as
// fontFamily: undefined. Curated named fonts can be added later without a schema change, since
// fontFamily is a raw CSS font-family string, not an enum. The four CSS generic families are
// categories, not fonts: each means "whichever font this computer uses for that kind", so they are
// grouped apart from named fonts.
const FONT_FAMILY_OPTIONS: FontOption[] = [
  { value: '', label: 'Default' },
  { value: 'sans-serif', label: 'Sans-serif', group: GROUP_SYSTEM },
  { value: 'serif', label: 'Serif', group: GROUP_SYSTEM },
  { value: 'monospace', label: 'Monospace', group: GROUP_SYSTEM },
  { value: 'cursive', label: 'Cursive', group: GROUP_SYSTEM }
]

function nodeStyleOf(n: Node): NodeStyle {
  return (n.data?.style as NodeStyle | undefined) ?? {}
}

// What an element is drawn with when its own style leaves a field unset (ADR 0117).
// The property panel shows these instead of an empty field, so it reads the
// element's data and the built-in defaults as data, never the rendered pixels.
function nodeDefaultsOf(n: Node): NodeStyleDefaults {
  return NODE_STYLE_DEFAULTS[styledNodeType(n.type)]
}

function edgeStyleOf(e: Edge): EdgeStyle {
  return (e.data?.style as EdgeStyle | undefined) ?? {}
}

// Fill/Border/Font/Transform — shared between entity and container nodes per
// ADR 0014's grouping (container fill is customizable now, deliberately no
// longer hardcoded-transparent). `includeTextAlign` distinguishes the one
// field difference from TextFields below (font-only, no fill/border).
function NodeStyleFields({
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

function EdgeFields({
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
  const { theme, paletteColors, paletteFonts } = useDiagramContext()
  const fontFamilyOptions = withStoredFonts(
    [
      ...FONT_FAMILY_OPTIONS,
      ...paletteFonts.map((f) => ({ value: f, label: f, group: GROUP_PALETTE }))
    ],
    edges.map((e) => edgeStyleOf(e).fontFamily)
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

// 'line' nodes (see ADR 0050) — same Start/Line/End shape as
// EdgeFields above, reading/writing NodeStyle instead of EdgeStyle (they
// share the same lineStyle/startMarker/endMarker fields), plus Locked
// since a line has a real position/bounding box unlike an edge. No Fill/
// Font/Transform — a line has no fill and no label in this pass, and its
// shape is edited by dragging its own points on the canvas, not numeric
// fields here.
function LineStyleFields({
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
function ConnectionPointFields({
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

// Entity/container share NodeStyleFields' four groups; text gets the same
// component minus fill/border, since a text node's "look" is font +
// transform only (deliberately still allows a fill for consistency's sake —
// see ADR 0014 — even though it's rare in practice). Rotation is text-only
// (ADR 0004/0012 — entities/containers are never rotated).
const TYPE_LABELS: Record<string, string> = {
  entity: 'Entities',
  container: 'Containers',
  text: 'Text',
  line: 'Lines'
}
const MIN_SIZE: Record<string, { width: number; height: number }> = {
  entity: { width: 60, height: 40 },
  container: { width: 160, height: 120 },
  text: { width: 40, height: 24 }
}

export default function PropertyPanel({
  selectedNodes,
  selectedEdges,
  onUpdateNodeStyle,
  onUpdateEdgeStyle,
  onUpdateTransform,
  onUpdateLocked,
  onUpdateNodeMetadata,
  onUpdateEdgeMetadata,
  onSetConnectionPointCount,
  maxConnectionPointsPerSide,
  requiredTags,
  beginContinuousEdit,
  endContinuousEdit,
  pushSnapshot,
  onSetDefaultStyle,
  styleBrushActive,
  onToggleStyleBrush
}: PropertyPanelProps): React.JSX.Element {
  const byType = new Map<string, Node[]>()
  for (const n of selectedNodes) {
    const type = n.type ?? 'entity'
    byType.set(type, [...(byType.get(type) ?? []), n])
  }
  const nodeGroups = Array.from(byType.entries())
  const groupCount = nodeGroups.length + (selectedEdges.length > 0 ? 1 : 0)

  // Metadata section: single-selection only (see MetadataSection's own
  // comment), and only for the node types that actually carry metadata —
  // Text/Anchor never do (ADR 0022).
  const metadataTarget: { kind: 'node'; node: Node } | { kind: 'edge'; edge: Edge } | undefined =
    selectedNodes.length + selectedEdges.length === 1
      ? selectedNodes.length === 1 &&
        (selectedNodes[0].type === 'entity' || selectedNodes[0].type === 'container')
        ? { kind: 'node', node: selectedNodes[0] }
        : selectedEdges.length === 1
          ? { kind: 'edge', edge: selectedEdges[0] }
          : undefined
      : undefined

  const renderNodeGroup = (type: string, nodes: Node[]): React.JSX.Element => {
    const ids = nodes.map((n) => n.id)
    if (type === 'line') {
      return (
        <LineStyleFields
          key={type}
          nodes={nodes}
          updateStyle={(patch) => onUpdateNodeStyle(ids, patch)}
          updateLocked={(locked) => onUpdateLocked(ids, locked)}
          beginContinuousEdit={beginContinuousEdit}
          endContinuousEdit={endContinuousEdit}
          pushSnapshot={pushSnapshot}
        />
      )
    }
    const min = MIN_SIZE[type] ?? MIN_SIZE.entity
    return (
      <NodeStyleFields
        key={type}
        nodes={nodes}
        minWidth={min.width}
        minHeight={min.height}
        includeRotation={type === 'text'}
        updateStyle={(patch) => onUpdateNodeStyle(ids, patch)}
        updateTransform={(patch) => onUpdateTransform(ids, patch)}
        updateLocked={(locked) => onUpdateLocked(ids, locked)}
        beginContinuousEdit={beginContinuousEdit}
        endContinuousEdit={endContinuousEdit}
        pushSnapshot={pushSnapshot}
      />
    )
  }

  const renderEdgeGroup = (): React.JSX.Element => {
    const ids = selectedEdges.map((e) => e.id)
    return (
      <EdgeFields
        edges={selectedEdges}
        updateStyle={(patch) => onUpdateEdgeStyle(ids, patch)}
        beginContinuousEdit={beginContinuousEdit}
        endContinuousEdit={endContinuousEdit}
        pushSnapshot={pushSnapshot}
      />
    )
  }

  // One element that can be a brush source (an entity/container/text/line or an
  // edge) gets "Copy style"; while a brush is active, any selection shows
  // the way out instead.
  const singleElement = selectedNodes.length + selectedEdges.length === 1
  const canCopyStyle =
    singleElement && (selectedEdges.length === 1 || canBrushNodeType(selectedNodes[0].type))
  const styleBrushButton =
    canCopyStyle || styleBrushActive ? (
      <button
        type="button"
        className={styleBrushActive ? 'style-brush-button active' : 'style-brush-button'}
        title={
          styleBrushActive
            ? 'Stop applying the copied style (Esc)'
            : 'Copy this element’s style, then click other elements of the same type to apply it'
        }
        onClick={onToggleStyleBrush}
      >
        {styleBrushActive ? 'Stop applying style' : '🖌 Copy style'}
      </button>
    ) : null

  // "Set as default style": exactly one entity, container or text node selected
  // (see PropertyPanelProps' comment on onSetDefaultStyle). It sits beside
  // "Copy style" because both act on the style of the element you are looking at.
  const defaultStyleType =
    selectedNodes.length === 1 && selectedEdges.length === 0
      ? (['entity', 'container', 'text'] as const).find((t) => t === selectedNodes[0].type)
      : undefined
  const setDefaultButton = defaultStyleType ? (
    <button
      type="button"
      className="property-set-default"
      onClick={() => onSetDefaultStyle(defaultStyleType, nodeStyleOf(selectedNodes[0]))}
      title="Newly created elements of this type will start with this exact style"
    >
      Set as default style
    </button>
  ) : null
  const styleActions =
    styleBrushButton || setDefaultButton ? (
      <div className="property-style-actions">
        {styleBrushButton}
        {setDefaultButton}
      </div>
    ) : null

  if (groupCount === 0) return <div className="property-panel-empty">Nothing selected</div>

  // Same-type selection (including a single edge): no extra "Type (N)"
  // wrapper, just the groups directly. Mixed-type selection: stacked,
  // collapsible per-type sections.
  if (groupCount === 1) {
    return (
      <div className="property-panel">
        {styleActions}
        {nodeGroups.map(([type, nodes]) => renderNodeGroup(type, nodes))}
        {selectedEdges.length > 0 && renderEdgeGroup()}
        {metadataTarget?.kind === 'node' && (
          <ConnectionPointFields
            node={metadataTarget.node}
            maxPerSide={maxConnectionPointsPerSide}
            onSetCount={(side, count) =>
              onSetConnectionPointCount(metadataTarget.node.id, side, count)
            }
          />
        )}
        {metadataTarget?.kind === 'node' && <ReferencesSection node={metadataTarget.node} />}
        {metadataTarget && (
          <MetadataSection
            metadata={
              metadataTarget.kind === 'node'
                ? (metadataTarget.node.data?.metadata as Record<string, MetadataEntry> | undefined)
                : (metadataTarget.edge.data?.metadata as Record<string, MetadataEntry> | undefined)
            }
            onChange={(metadata) =>
              metadataTarget.kind === 'node'
                ? onUpdateNodeMetadata(metadataTarget.node.id, metadata)
                : onUpdateEdgeMetadata(metadataTarget.edge.id, metadata)
            }
            requiredTags={requiredTags}
            pushSnapshot={pushSnapshot}
          />
        )}
      </div>
    )
  }

  return (
    <div className="property-panel">
      {styleActions}
      {nodeGroups.map(([type, nodes]) => (
        <CollapsibleSection
          key={type}
          title={`${TYPE_LABELS[type] ?? type} (${nodes.length})`}
          sectionKey={`group-${type}`}
        >
          {renderNodeGroup(type, nodes)}
        </CollapsibleSection>
      ))}
      {selectedEdges.length > 0 && (
        <CollapsibleSection title={`Edges (${selectedEdges.length})`} sectionKey="group-edges">
          {renderEdgeGroup()}
        </CollapsibleSection>
      )}
    </div>
  )
}
