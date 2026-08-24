import { useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type {
  ConnectionPoint,
  ConnectionPointSide,
  EdgeStyle,
  MarkerKind,
  MetadataEntry,
  NodeStyle,
  RequiredTagDefinition
} from '@shared/diagram'
import { useDiagramContext } from '../DiagramContext'
import { themeAdaptiveColor } from '../styles/themeAdaptiveColor'
import { connectionPointCountForSide } from '../nodes/connectionPoints'
import { CollapsibleSection, ColorField, FieldRow, NumberField, SliderField, SelectField } from './fields'
import { computeFieldValue } from './fieldValue'
import MetadataSection from './MetadataSection'

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
  onUpdateNodeMetadata: (nodeId: string, metadata: Record<string, MetadataEntry> | undefined) => void
  onUpdateEdgeMetadata: (edgeId: string, metadata: Record<string, MetadataEntry> | undefined) => void
  onSetConnectionPointCount: (nodeId: string, side: ConnectionPointSide, totalCount: number) => void
  maxConnectionPointsPerSide: number
  // Copies one selected node's current style into settings.defaultStyles
  // for its type (epic 0030/ADR 0048) — only offered for shape/container/
  // text, only when exactly one node of that type is selected (a style is
  // only well-defined for a single node, not a multi-selection). Edges
  // already have their own equivalent via the toolbar swatch (epic 0061).
  onSetDefaultStyle: (type: 'shape' | 'container' | 'text', style: NodeStyle) => void
  requiredTags: RequiredTagDefinition[]
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  pushSnapshot: () => void
}

const MARKER_OPTIONS: { value: MarkerKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrowOpen', label: 'Open arrow' },
  { value: 'arrowClosed', label: 'Closed arrow' },
  { value: 'circle', label: 'Circle' },
  { value: 'circleFilled', label: 'Filled circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'diamondFilled', label: 'Filled diamond' },
  { value: 'crowsFootOne', label: "Crow's foot — one" },
  { value: 'crowsFootMany', label: "Crow's foot — many" },
  { value: 'crowsFootOneOrMany', label: "Crow's foot — one or many" },
  { value: 'crowsFootZeroOrOne', label: "Crow's foot — zero or one" },
  { value: 'crowsFootZeroOrMany', label: "Crow's foot — zero or many" }
]

// '' means the field is absent — a real style.routingStyle value, not a
// placeholder — see fontFamily's own identical '' === "no override"
// pattern below. 'straight'/'step'/'smoothstep' are React Flow's own
// built-in path shapes; 'catmullRom' reuses the freeform-line curve math
// (epic 0064/ADR 0050, bendablePath.ts) with this edge's own manual bend
// points — epic 0032. A local copy, not shared with SettingsPanel.tsx's
// identical default-routing-style picker: this file already can't export
// a second named value alongside its default component export
// (react-refresh/only-export-components).
const ROUTING_STYLE_OPTIONS: { value: Exclude<EdgeStyle['routingStyle'], undefined> | ''; label: string }[] = [
  { value: '', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
  { value: 'catmullRom', label: 'Catmull-Rom (gravity)' }
]

// Generic CSS families only, for now — a specific named font isn't
// reliably available on both of this app's target platforms (Windows/
// Linux). '' is a real option meaning "no override" (not a placeholder —
// see SelectField), stored as fontFamily: undefined. Curated specific
// fonts can be added here later without a schema change (fontFamily is a
// raw CSS font-family string, not an enum).
const FONT_FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'cursive', label: 'Cursive' }
]

function nodeStyleOf(n: Node): NodeStyle {
  return (n.data?.style as NodeStyle | undefined) ?? {}
}

function edgeStyleOf(e: Edge): EdgeStyle {
  return (e.data?.style as EdgeStyle | undefined) ?? {}
}

// Fill/Border/Font/Transform — shared between shape and container nodes per
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
  pushSnapshot,
  onSetDefault
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
  // Only set when exactly one node is selected — see PropertyPanelProps'
  // own comment on onSetDefaultStyle.
  onSetDefault?: () => void
}): React.JSX.Element {
  const { theme, paletteColors, paletteFonts } = useDiagramContext()
  const fontFamilyOptions = [...FONT_FAMILY_OPTIONS, ...paletteFonts.map((f) => ({ value: f, label: f }))]
  const fill = computeFieldValue(nodes, (n) => nodeStyleOf(n).fill)
  const fillOpacity = computeFieldValue(nodes, (n) => nodeStyleOf(n).fillOpacity)
  const stroke = computeFieldValue(nodes, (n) => nodeStyleOf(n).stroke)
  const strokeOpacity = computeFieldValue(nodes, (n) => nodeStyleOf(n).strokeOpacity)
  const strokeWidth = computeFieldValue(nodes, (n) => nodeStyleOf(n).strokeWidth)
  const fontSize = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontSize)
  const fontColor = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontColor)
  const fontOpacity = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontOpacity)
  const fontWeight = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontWeight)
  const fontFamily = computeFieldValue(nodes, (n) => nodeStyleOf(n).fontFamily)
  const textAlign = computeFieldValue(nodes, (n) => nodeStyleOf(n).textAlign)
  const x = computeFieldValue(nodes, (n) => n.position.x)
  const y = computeFieldValue(nodes, (n) => n.position.y)
  const width = computeFieldValue(nodes, (n) => n.width ?? undefined)
  const height = computeFieldValue(nodes, (n) => n.height ?? undefined)
  const rotation = computeFieldValue(nodes, (n) => (typeof n.data?.rotation === 'number' ? (n.data.rotation as number) : 0))
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
      {onSetDefault && (
        <button
          type="button"
          className="property-set-default"
          onClick={onSetDefault}
          title="Newly created elements of this type will start with this exact style"
        >
          Set as default style
        </button>
      )}
      <CollapsibleSection title="Fill">
        <ColorField
          label="Fill"
          value={themeAdaptiveColor(fill.value, theme)}
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
          value={themeAdaptiveColor(stroke.value, theme)}
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
          label="Family"
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
          value={themeAdaptiveColor(fontColor.value, theme)}
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
  const fontFamilyOptions = [...FONT_FAMILY_OPTIONS, ...paletteFonts.map((f) => ({ value: f, label: f }))]
  const startMarker = computeFieldValue(edges, (e) => edgeStyleOf(e).startMarker)
  const endMarker = computeFieldValue(edges, (e) => edgeStyleOf(e).endMarker)
  const stroke = computeFieldValue(edges, (e) => edgeStyleOf(e).stroke)
  const strokeOpacity = computeFieldValue(edges, (e) => edgeStyleOf(e).strokeOpacity)
  const strokeWidth = computeFieldValue(edges, (e) => edgeStyleOf(e).strokeWidth)
  const lineStyle = computeFieldValue(edges, (e) => edgeStyleOf(e).lineStyle)
  const routingStyle = computeFieldValue(edges, (e) => edgeStyleOf(e).routingStyle)
  const fontSize = computeFieldValue(edges, (e) => edgeStyleOf(e).fontSize)
  const fontColor = computeFieldValue(edges, (e) => edgeStyleOf(e).fontColor)
  const fontOpacity = computeFieldValue(edges, (e) => edgeStyleOf(e).fontOpacity)
  const fontWeight = computeFieldValue(edges, (e) => edgeStyleOf(e).fontWeight)
  const fontFamily = computeFieldValue(edges, (e) => edgeStyleOf(e).fontFamily)
  const labelPosition = computeFieldValue(edges, (e) => edgeStyleOf(e).labelPosition)

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
          value={themeAdaptiveColor(stroke.value, theme)}
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
          label="Family"
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
          value={themeAdaptiveColor(fontColor.value, theme)}
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

// 'line' nodes (epic 0064/ADR 0050) — same Start/Line/End shape as
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
  const startMarker = computeFieldValue(nodes, (n) => nodeStyleOf(n).startMarker)
  const endMarker = computeFieldValue(nodes, (n) => nodeStyleOf(n).endMarker)
  const stroke = computeFieldValue(nodes, (n) => nodeStyleOf(n).stroke)
  const strokeOpacity = computeFieldValue(nodes, (n) => nodeStyleOf(n).strokeOpacity)
  const strokeWidth = computeFieldValue(nodes, (n) => nodeStyleOf(n).strokeWidth)
  const lineStyle = computeFieldValue(nodes, (n) => nodeStyleOf(n).lineStyle)

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
          value={themeAdaptiveColor(stroke.value, theme)}
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

// Single-node-selection only (epic 0039) — unlike the style fields above,
// a count here reads from and structurally rewrites one specific node's
// own connectionPoints/edges, which doesn't generalize to "apply this
// patch to every selected node" the way a color or opacity does.
//
// Deliberately applies on blur/Enter (onSessionEnd), not per-keystroke
// like every other NumberField in this panel: unlike a style patch, commit
// here regenerates points and can transfer edges between handles, so
// typing "12" must not run that as "1" then "12". A ref tracks the
// in-progress value between onChange and onSessionEnd.
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

// Shape/container share NodeStyleFields' four groups; text gets the same
// component minus fill/border, since a text node's "look" is font +
// transform only (deliberately still allows a fill for consistency's sake —
// see ADR 0014 — even though it's rare in practice). Rotation is text-only
// (ADR 0004/0012 — shapes/containers are never rotated).
const TYPE_LABELS: Record<string, string> = { shape: 'Shapes', container: 'Containers', text: 'Text', line: 'Lines' }
const MIN_SIZE: Record<string, { width: number; height: number }> = {
  shape: { width: 60, height: 40 },
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
  onSetDefaultStyle
}: PropertyPanelProps): React.JSX.Element {
  const byType = new Map<string, Node[]>()
  for (const n of selectedNodes) {
    const type = n.type ?? 'shape'
    byType.set(type, [...(byType.get(type) ?? []), n])
  }
  const nodeGroups = Array.from(byType.entries())
  const groupCount = nodeGroups.length + (selectedEdges.length > 0 ? 1 : 0)

  // Metadata section: single-selection only (see MetadataSection's own
  // comment), and only for the node types that actually carry metadata —
  // Text/Anchor never do (ADR 0022).
  const metadataTarget: { kind: 'node'; node: Node } | { kind: 'edge'; edge: Edge } | undefined =
    selectedNodes.length + selectedEdges.length === 1
      ? selectedNodes.length === 1 && (selectedNodes[0].type === 'shape' || selectedNodes[0].type === 'container')
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
    const min = MIN_SIZE[type] ?? MIN_SIZE.shape
    const canSetDefault = nodes.length === 1 && (type === 'shape' || type === 'container' || type === 'text')
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
        onSetDefault={
          canSetDefault
            ? () => onSetDefaultStyle(type as 'shape' | 'container' | 'text', nodeStyleOf(nodes[0]))
            : undefined
        }
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

  if (groupCount === 0) return <div className="property-panel-empty">Nothing selected</div>

  // Same-type selection (including a single edge): no extra "Type (N)"
  // wrapper, just the groups directly. Mixed-type selection: stacked,
  // collapsible per-type sections — see epic 0003's design.
  if (groupCount === 1) {
    return (
      <div className="property-panel">
        {nodeGroups.map(([type, nodes]) => renderNodeGroup(type, nodes))}
        {selectedEdges.length > 0 && renderEdgeGroup()}
        {metadataTarget?.kind === 'node' && (
          <ConnectionPointFields
            node={metadataTarget.node}
            maxPerSide={maxConnectionPointsPerSide}
            onSetCount={(side, count) => onSetConnectionPointCount(metadataTarget.node.id, side, count)}
          />
        )}
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
      {nodeGroups.map(([type, nodes]) => (
        <CollapsibleSection key={type} title={`${TYPE_LABELS[type] ?? type} (${nodes.length})`}>
          {renderNodeGroup(type, nodes)}
        </CollapsibleSection>
      ))}
      {selectedEdges.length > 0 && (
        <CollapsibleSection title={`Edges (${selectedEdges.length})`}>{renderEdgeGroup()}</CollapsibleSection>
      )}
    </div>
  )
}
