import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  MarkerType,
  ConnectionMode,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type HandleType,
  type Node,
  type NodeChange,
  type OnConnectStartParams,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  type ConnectionPoint,
  type ConnectionPointSide,
  type DiagramFile,
  type EdgeStyle,
  type HighlightDefinition,
  type IconRef,
  type IconSlot,
  type JsonValue,
  type LegendEntry,
  type MetadataEntry,
  type NodeStyle,
  type RequiredTagDefinition
} from '@shared/diagram'
import ShapeNode, { SHAPE_MIN_WIDTH, SHAPE_MIN_HEIGHT } from './nodes/ShapeNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from './nodes/TextNode'
import ContainerNode, { CONTAINER_MIN_WIDTH, CONTAINER_MIN_HEIGHT } from './nodes/ContainerNode'
import AnchorNode, { ANCHOR_SIZE } from './nodes/AnchorNode'
import LabeledEdge from './edges/LabeledEdge'
import { highlightId, matchingHighlights, reconcileHighlightGroup } from './highlights'
import EdgeMarkerDefs from './edges/edgeMarkers'
import DiagramContext from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu'
import IconPicker from './components/IconPicker'
import ColorPickerPopup from './components/ColorPickerPopup'
import StylePicker from './components/StylePicker'
import DetailsPanel from './components/DetailsPanel'
import RequiredTagsPanel from './components/RequiredTagsPanel'
import DiagnosticsPanel from './components/DiagnosticsPanel'
import HighlightsPanel from './components/HighlightsPanel'
import LegendPanel from './components/LegendPanel'
import MenuBar, { type MenuBarMenu } from './components/MenuBar'
import LayerPanel from './components/LayerPanel'
import { CONTAINER_BASE, SHAPE_BASE, TEXT_BASE, backfillZIndex, nextZIndexAbove, reorderZIndex } from './layers/zIndexOrdering'
import { reassignConnectionPointHandles, setSideCustomPointCount } from './nodes/connectionPoints'
import SettingsPanel from './components/SettingsPanel'
import AboutDialog from './components/AboutDialog'
import DiagramDock from './panels/DiagramDock'
import UtilityDock from './panels/UtilityDock'
import AlignmentGuides from './components/AlignmentGuides'
import { SNAP_THRESHOLD_PX, boundsFrom, computeSnap } from './alignment'
import type { TransformPatch } from './panels/PropertyPanel'
import { useTheme } from './theme'
import { useSettings } from './settings'
import { themeAdaptiveColor } from './styles/themeAdaptiveColor'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts.
const nodeTypes = { shape: ShapeNode, text: TextNode, container: ContainerNode, anchor: AnchorNode }
const edgeTypes = { labeled: LabeledEdge }

// A sequential per-session counter (shape-1, shape-2, ...) collided with
// ids already used in a *loaded* file, since a fresh session always starts
// back at 1 — opening a diagram that already had "shape-1" and adding
// another shape silently overwrote it. A random UUID suffix makes that
// whole class of collision structurally impossible (no cross-session
// coordination needed) rather than something to patch around on every load
// path. Keeps the readable type prefix — this project's file format is
// meant to stay git-diff-friendly and human-debuggable, and "shape-<uuid>"
// is still a lot easier to recognize at a glance than a bare UUID.
function newNodeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// Shared by onConnectEnd (a brand-new edge dragged out from a handle) and
// onReconnectEnd (an existing edge's own endpoint dragged loose) — both
// need to tell "released on genuine empty canvas" apart from every other
// way a drag can end. `!connectionState.isValid` is the primary signal —
// checking only `event.target`'s `react-flow__pane` class (React Flow's
// own docs example for this pattern) is NOT enough on its own: React Flow
// snaps to any handle within `connectionRadius` (default 20px) of the
// release point, so a drop a few pixels off a real handle but still within
// that radius still completes a valid connection while the raw DOM element
// under the cursor is still the pane. The pane check is kept too, alongside
// isValid, so a drop that's merely invalid (released over another node's
// body without hitting a handle, or over toolbar/panel UI) doesn't spawn an
// anchor either — only a genuine empty-canvas release does.
function isVoidDrop(event: MouseEvent | TouchEvent, connectionState: FinalConnectionState): boolean {
  if (connectionState.isValid) return false
  const target = event.target
  return target instanceof Element && target.classList.contains('react-flow__pane')
}

// MouseEvent and TouchEvent expose the release coordinates differently.
function pointFromEvent(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  return 'changedTouches' in event ? event.changedTouches[0] : event
}

// Containers (epic 0004, ADR 0012) — a child node's `position` is relative
// to its immediate parent's own position, cascading up through any nesting
// depth. These helpers convert between that relative space and true
// absolute canvas coordinates, and keep the invariant React Flow requires:
// a parent node must appear earlier in the `nodes` array than its children.

function absolutePosition(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const seen = new Set<string>([node.id])
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    seen.add(parentId)
    parentId = parent.parentId
  }
  return { x, y }
}

function subtractPosition(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  return { x: a.x - b.x, y: a.y - b.y }
}

function sortNodesForHierarchy(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const placed = new Set<string>()
  const visiting = new Set<string>()
  const result: Node[] = []
  const visit = (node: Node): void => {
    if (placed.has(node.id) || visiting.has(node.id)) return
    visiting.add(node.id)
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) visit(parent)
    visiting.delete(node.id)
    placed.add(node.id)
    result.push(node)
  }
  nodes.forEach(visit)
  return result
}

// Adapter between React Flow's Node shape (zIndex lives in data.zIndex) and
// zIndexOrdering.ts's plain, React-Flow-agnostic ZIndexed shape — see epic
// 0043/ADR 0035. Only touches nodes that actually needed a value; a fully
// backfilled array is returned as-is (same node references, no new objects)
// so this is a safe no-op to call on every load.
function applyZIndexBackfill(nodes: Node[]): Node[] {
  const extracted = nodes.map((n) => ({ id: n.id, type: n.type, zIndex: n.data?.zIndex as number | undefined }))
  const backfilled = backfillZIndex(extracted)
  if (backfilled === extracted) return nodes
  return nodes.map((n, i) =>
    backfilled[i].zIndex === n.data?.zIndex ? n : { ...n, data: { ...n.data, zIndex: backfilled[i].zIndex } }
  )
}

// Same data.zIndex extraction as applyZIndexBackfill, for a freshly-created
// node — see epic 0043/ADR 0035. Always scopes "above everything" to just
// that node's own type/tier (CONTAINER_BASE/SHAPE_BASE/TEXT_BASE), so a
// brand new node lands solidly within its tier — behind existing shapes if
// it's a container, above existing shapes if it's text, etc. — matching
// the backfilled default arrangement, rather than jumping in front of (or
// behind) nodes of a different tier just because it's new. An earlier
// version scoped shapes/text to *every* node regardless of type with no
// tier floor at all, so a fresh diagram's first shape/container landed at
// 10 or 20 instead of its intended tier — caught by the user directly, see
// docs/known-issues.md.
function nextZIndex(nodes: Node[], type: 'shape' | 'text' | 'container'): number {
  const base = type === 'container' ? CONTAINER_BASE : type === 'text' ? TEXT_BASE : SHAPE_BASE
  const scoped = nodes.filter((n) => n.type === type)
  return nextZIndexAbove(
    scoped.map((n) => ({ id: n.id, zIndex: n.data?.zIndex as number | undefined })),
    base
  )
}

// Deleting a container promotes its children to the container's own parent
// (or top-level) rather than deleting them too — see ADR 0012.
function removeContainerReparenting(nodes: Node[], containerId: string): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const container = byId.get(containerId)
  if (!container) return nodes
  const newParentId = container.parentId
  const newParentAbs = newParentId ? absolutePosition(byId.get(newParentId)!, byId) : undefined
  const updated = nodes
    .filter((n) => n.id !== containerId)
    .map((n) => {
      if (n.parentId !== containerId) return n
      const abs = absolutePosition(n, byId)
      const position = newParentAbs ? subtractPosition(abs, newParentAbs) : abs
      return { ...n, parentId: newParentId, position }
    })
  return sortNodesForHierarchy(updated)
}

// Undo/redo — see epic 0006. Deliberately just {nodes, edges}, not
// viewport: panning/zooming isn't a content edit worth undoing.
interface HistorySnapshot {
  nodes: Node[]
  edges: Edge[]
}
const MAX_HISTORY = 50

// Toolbar default-edge-style swatch preview only — deliberately a scaled-
// down echo of LabeledEdge.tsx's own DASH_ARRAY, not a shared import; the
// swatch is a small honest preview, not a real edge render.
const DEFAULT_EDGE_SWATCH_DASH: Record<'solid' | 'dashed' | 'dotted', string | undefined> = {
  solid: undefined,
  dashed: '4 3',
  dotted: '1.5 2'
}

// Only shape/container nodes and edges meaningfully carry metadata — see
// ADR 0022. Kept as a helper since both toDiagramFile and the metadata-only
// node type guard elsewhere need the same "does this node type qualify"
// check.
function nodeMetadataEligible(type: string | undefined): boolean {
  return type === 'shape' || type === 'container'
}

function toDiagramFile(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport,
  metadata: Record<string, JsonValue>,
  requiredTags: RequiredTagDefinition[],
  highlights: HighlightDefinition[],
  legend: LegendEntry[]
): DiagramFile {
  return {
    version: 1,
    viewport,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    legend: legend.length > 0 ? legend : undefined,
    requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.width != null && n.height != null ? { width: n.width, height: n.height } : undefined,
      rotation: typeof n.data?.rotation === 'number' ? (n.data.rotation as number) : undefined,
      zIndex: typeof n.data?.zIndex === 'number' ? (n.data.zIndex as number) : undefined,
      connectionPoints: Array.isArray(n.data?.connectionPoints)
        ? (n.data.connectionPoints as ConnectionPoint[])
        : undefined,
      parentId: n.parentId,
      locked: n.data?.locked === true ? true : undefined,
      style: n.data?.style as NodeStyle | undefined,
      metadata: nodeMetadataEligible(n.type)
        ? (n.data?.metadata as Record<string, MetadataEntry> | undefined)
        : undefined,
      data: {
        label: String(n.data?.label ?? ''),
        icons: n.data?.icons as Partial<Record<IconSlot, IconRef>> | undefined,
        details: typeof n.data?.details === 'string' ? (n.data.details as string) : undefined,
        linkedDiagram:
          typeof n.data?.linkedDiagram === 'string' ? (n.data.linkedDiagram as string) : undefined
      }
    })),
    edges: edges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: typeof e.data?.label === 'string' && e.data.label ? e.data.label : undefined,
      style: e.data?.style as EdgeStyle | undefined,
      metadata: e.data?.metadata as Record<string, MetadataEntry> | undefined
    }))
  }
}

function fromDiagramFile(diagram: DiagramFile): {
  nodes: Node[]
  edges: Edge[]
  metadata: Record<string, JsonValue>
  requiredTags: RequiredTagDefinition[]
  highlights: HighlightDefinition[]
  legend: LegendEntry[]
} {
  return {
    highlights: diagram.highlights ?? [],
    legend: diagram.legend ?? [],
    // sortNodesForHierarchy defensively re-orders in case an external
    // writer didn't honor the parent-before-child requirement — see
    // docs/file-format.md's parentId entry. applyZIndexBackfill runs on
    // that *final* order, not the raw file order, so "array position"
    // means the same thing it does for today's actual rendering — see
    // epic 0043/ADR 0035.
    nodes: applyZIndexBackfill(
      sortNodesForHierarchy(
        diagram.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          width: n.size?.width,
          height: n.size?.height,
          ...(n.parentId ? { parentId: n.parentId } : {}),
          data: {
            label: n.data.label,
            ...(n.rotation != null ? { rotation: n.rotation } : {}),
            ...(n.zIndex != null ? { zIndex: n.zIndex } : {}),
            ...(n.locked ? { locked: true } : {}),
            ...(n.connectionPoints && n.connectionPoints.length > 0
              ? { connectionPoints: n.connectionPoints }
              : {}),
            ...(n.data.icons ? { icons: n.data.icons } : {}),
            ...(n.data.details ? { details: n.data.details } : {}),
            ...(n.data.linkedDiagram ? { linkedDiagram: n.data.linkedDiagram } : {}),
            ...(n.style ? { style: n.style } : {}),
            ...(n.metadata && nodeMetadataEligible(n.type) ? { metadata: n.metadata } : {})
          }
        }))
      )
    ),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: {
        label: e.label ?? '',
        ...(e.style ? { style: e.style } : {}),
        ...(e.metadata ? { metadata: e.metadata } : {})
      }
    })),
    metadata: diagram.metadata ?? {},
    requiredTags: diagram.requiredTags ?? []
  }
}

// Fresh metadata for a brand-new Shape/Container/Edge — every requiredTags
// entry, seeded at its own defaultValue/lock. No diagnostics involved (a
// new element has nothing to "reset"); that only applies to syncElementMetadata
// below, which reconciles *existing* elements against a changed template.
function seedMetadata(requiredTags: RequiredTagDefinition[]): Record<string, MetadataEntry> | undefined {
  if (requiredTags.length === 0) return undefined
  const result: Record<string, MetadataEntry> = {}
  for (const def of requiredTags) {
    result[def.key] = { value: def.defaultValue ?? null, lock: def.lock }
  }
  return result
}

function isValidForTag(value: JsonValue, def: RequiredTagDefinition): boolean {
  // null is always valid, regardless of allowedValues — the implicit
  // "None" value every required tag carries (epic 0058/ADR 0046), without
  // needing to be added to allowedValues itself. Without this, a
  // deliberately-None element would get silently reset back to a real
  // defaultValue on the very next sync pass — exactly backwards from the
  // point of a "not applicable" value.
  if (value === null) return true
  // No allowedValues means nothing else to be invalid against — see ADR 0022.
  if (!def.allowedValues) return true
  return typeof value === 'string' && def.allowedValues.includes(value)
}

// Reconciles one element's existing metadata against the diagram's current
// requiredTags template — see ADR 0022's "Retroactive backfill" and its
// exact rules (lockedEditable keeps a still-valid value / resets an invalid
// one, lockedStatic always takes the template value, a removed key demotes
// rather than deletes). Pushes one message per correction onto `diagnostics`
// (mutated in place — called once per node/edge per sync pass, so a shared
// array avoids threading an accumulator return value through every call).
//
// The "collision-affixing" case from the ADR (demote-then-reinstate: a key
// leaves requiredTags, becomes a free entry, then gets re-added later) is
// handled on the *reinstating* side below — when a required key's own slot
// is already occupied by an old free entry, that free entry is the one that
// gets bumped aside (" (demoted)", numbered if that's also taken), not the
// reinstated required entry, so the template's key always stays clean.
function syncElementMetadata(
  metadata: Record<string, MetadataEntry> | undefined,
  requiredTags: RequiredTagDefinition[],
  elementLabel: string,
  diagnostics: string[]
): Record<string, MetadataEntry> | undefined {
  const next: Record<string, MetadataEntry> = { ...metadata }
  const requiredKeys = new Set(requiredTags.map((def) => def.key))

  for (const def of requiredTags) {
    const existing = next[def.key]
    const templateEntry: MetadataEntry = { value: def.defaultValue ?? null, lock: def.lock }

    if (existing?.lock === def.lock) {
      if (def.lock === 'lockedStatic') {
        if (existing.value !== templateEntry.value) {
          next[def.key] = templateEntry
          diagnostics.push(`Invalid value in ${elementLabel}.${def.key}, reset to default value.`)
        }
      } else if (!isValidForTag(existing.value, def)) {
        next[def.key] = templateEntry
        diagnostics.push(`Invalid value in ${elementLabel}.${def.key}, reset to default value.`)
      }
      continue
    }

    if (existing && !existing.lock) {
      // A pre-existing free entry sitting on a key that's just become
      // required (or reinstated after an earlier demotion) — preserve it
      // under a bumped key rather than silently discarding it.
      let affixed = `${def.key} (demoted)`
      let n = 2
      while (affixed in next) affixed = `${def.key} (demoted ${n++})`
      next[affixed] = existing
      diagnostics.push(`${elementLabel}.${def.key} is now required; previous free value moved to "${affixed}".`)
    }
    next[def.key] = templateEntry
  }

  for (const key of Object.keys(next)) {
    const entry = next[key]
    if (entry.lock && !requiredKeys.has(key)) {
      next[key] = { value: entry.value }
      diagnostics.push(`${elementLabel}.${key} is no longer required, kept as a free tag.`)
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function CanvasInner(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  // This window's crash-recovery identity before it's ever been saved —
  // see epic 0020/ADR 0040. Assigned by main at window creation, carried
  // via ?session= the same way ?path= already is; stable for the whole
  // renderer lifetime (unlike currentPath, never reassigned — once a
  // window has a path, recovery keys off that instead, but the session id
  // itself doesn't need to change to make that happen).
  const sessionIdRef = useRef(
    new URLSearchParams(window.location.search).get('session') ?? crypto.randomUUID()
  )
  // Unsaved-changes tracking (epic 0020/ADR 0040) — set directly at every
  // site that mutates something toDiagramFile() actually serializes, not
  // derived from the undo/redo stack (which only covers nodes/edges, not
  // requiredTags/highlights/legend/detailsDrafts — see the ADR for why
  // that coupling was rejected). Session-only state (enabledHighlightIds,
  // every panel-open boolean, etc.) never touches this.
  const [isDirty, setIsDirty] = useState(false)
  const markDirty = useCallback(() => setIsDirty(true), [])
  // See loadDiagramIntoCanvas's own comment on why this exists — a short
  // grace window after any load during which React Flow's own automatic
  // post-mount dimension measurement doesn't count as a discrete edit.
  const suppressAutoMeasureUntilRef = useRef(0)
  // Brief post-save confirmation next to the toolbar's Save button — see
  // flashSaved below. Purely transient UI state, not persisted, not reset
  // on load (nothing to reset — it's already false by the time any load
  // finishes).
  const [showSavedFlash, setShowSavedFlash] = useState(false)
  const savedFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Diagram-level metadata/requiredTags (epic 0034/ADR 0022) — analogous to
  // currentPath: file-scoped state with no React Flow home of its own,
  // reset on every load, carried into every save via toDiagramFile.
  const [diagramMetadata, setDiagramMetadata] = useState<Record<string, JsonValue>>({})
  const [requiredTags, setRequiredTags] = useState<RequiredTagDefinition[]>([])
  // Highlight catalog (epic 0026/ADR 0025) — persisted, same file-scoped
  // treatment as diagramMetadata/requiredTags above. Which highlights are
  // currently *enabled* is a separate, deliberately volatile Set below —
  // reset on every load, never included in toDiagramFile's payload.
  const [highlights, setHighlights] = useState<HighlightDefinition[]>([])
  const [enabledHighlightIds, setEnabledHighlightIds] = useState<Set<string>>(new Set())
  // Legend catalog (epic 0037/ADR 0033) — same file-scoped, persisted
  // treatment as highlights above. Unlike highlights, there's no per-entry
  // enabled state; the whole panel's shown/hidden state below is what's
  // session-local instead.
  const [legend, setLegend] = useState<LegendEntry[]>([])
  const [legendPanelOpen, setLegendPanelOpen] = useState(false)
  // Anchors the floating panel next to whichever <ControlButton> opened it —
  // same convention as iconPicker/colorPicker/linePicker's own anchorRect.
  const [legendPanelAnchor, setLegendPanelAnchor] = useState<DOMRect | null>(null)
  // Layer panel (epic 0043/ADR 0035) — same UtilityDock family as
  // Highlights/Required tags/Diagnostics. No catalog of its own: it reads
  // straight off `nodes`' own zIndex, there's nothing separate to persist.
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  // Which node the panel currently points at — an "entity highlight," see
  // DiagramContext's own comment on this field. Session-only, reset on load.
  const [entityHighlightNodeId, setEntityHighlightNodeId] = useState<string | null>(null)
  // Non-blocking notices from the most recent syncElementMetadata pass —
  // deliberately *replaced*, not appended, on every sync: this reflects
  // current state (what the last backfill run had to correct), not a
  // growing history log. A file with nothing to correct clears the list.
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [requiredTagsPanelOpen, setRequiredTagsPanelOpen] = useState(false)
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false)
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
  // Floating popup next to Legend's, in the bottom-left <Controls> cluster
  // (fix/highlights-free-tags-and-toggle) — same anchorRect convention as
  // legendPanelAnchor above, no longer the fixed-position UtilityDock shell
  // it used to be.
  const [highlightsPanelAnchor, setHighlightsPanelAnchor] = useState<DOMRect | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false)
  // Toolbar's own "current pen style" swatch (epic 0061/ADR 0045) — reuses
  // StylePicker (ADR 0010) unchanged, same anchorRect convention as
  // linePicker above, just targeting settings.defaultEdgeStyle instead of
  // one edge's data.style.
  const [defaultEdgeStylePicker, setDefaultEdgeStylePicker] = useState<DOMRect | null>(null)
  // Global app preference, not diagram content — see settings.ts/ADR 0032.
  // Deliberately not reset by loadDiagramIntoCanvas below; only the panel's
  // open/closed UI state is.
  const { settings, updateSettings } = useSettings()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const [iconPicker, setIconPicker] = useState<{ nodeId: string; anchorRect: DOMRect } | null>(
    null
  )
  // "Fill…"/"Border…" (nodes) and "Line style…" (edges) context-menu
  // popups — see ADR 0010. Two separate pieces of state since they target
  // different element kinds and render different popup components.
  const [colorPicker, setColorPicker] = useState<{
    nodeId: string
    kind: 'fill' | 'border'
    anchorRect: DOMRect
  } | null>(null)
  const [linePicker, setLinePicker] = useState<{ edgeId: string; anchorRect: DOMRect } | null>(
    null
  )
  // Drag-time alignment guides (epic 0011) — flow-space positions of the
  // guide line(s) currently matched, or null when nothing's being dragged/
  // nothing's in snap range. Set from onNodeDrag, cleared on drag stop.
  const [alignmentGuides, setAlignmentGuides] = useState<{ x: number[]; y: number[] } | null>(
    null
  )
  const [detailsPanelNodeId, setDetailsPanelNodeId] = useState<string | null>(null)
  // Editing a node's details doesn't write to disk immediately — it's just
  // draft state here, flushed as part of the main save flow. See epic 0008.
  const [detailsDrafts, setDetailsDrafts] = useState<Record<string, string>>({})
  const rfInstance = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  // Undo/redo history — see epic 0006. Explicit calls at each real mutation
  // site (pushSnapshot before mutating), not a useEffect reacting to
  // nodes/edges changing — an earlier version tried the effect approach and
  // it broke under React StrictMode's dev-mode double-invoke: the effect's
  // only observable "output" was a ref mutation (lastSettledRef), and an
  // effect whose side effect isn't safe to run twice is exactly what
  // StrictMode's double-invoke exists to catch. Explicit calls from event
  // handlers don't have this problem — StrictMode only double-invokes
  // render bodies and effects, not regular callbacks.
  const [past, setPast] = useState<HistorySnapshot[]>([])
  const [future, setFuture] = useState<HistorySnapshot[]>([])
  // Mid-drag/resize/rotate: don't split one continuous gesture into many
  // undo steps. Only beginContinuousEdit/endContinuousEdit touch this —
  // once from the onNodesChange wrapper below (position/dimension changes
  // carry their own dragging/resizing flag), once from TextNode's rotation
  // handler (no such flag there — it's just repeated updateNodeData calls).
  const interactionInProgressRef = useRef(false)

  // Which node/handle a connection drag started from — set in onConnectStart,
  // read (and cleared) in onConnectEnd to spawn a new shape when the drag is
  // released over empty canvas instead of a valid handle. See epic 0014.
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  // React Flow's own EdgeUpdateAnchors implementation fires BOTH
  // onReconnectStart *and* the generic onConnectStart for the same
  // drag-an-existing-edge's-endpoint gesture (confirmed by reading
  // @xyflow/react's source: its internal `_onConnectStart` composite calls
  // `onReconnectStart?.(...)` immediately before `onConnectStart?.(...)`,
  // synchronously, every time). Without this flag, a reconnect dropped in
  // empty space fired both onConnectEnd (epic 0014's logic) *and*
  // onReconnectEnd (epic 0033's) independently, each spawning its own
  // anchor+edge — the exact "two edges end up connected to the anchor"
  // bug the user reported. Set in onReconnectStart (which always runs
  // first within that composite), read by onConnectStart to skip arming
  // connectStartRef for a gesture onReconnectEnd already owns, reset in
  // onReconnectEnd once the gesture is fully over.
  const isReconnectingRef = useRef(false)

  // Reconciles every eligible node/edge's metadata against `tags`, via
  // syncElementMetadata — see that function's own comment for the exact
  // rules. Runs on file open (defensively, in case of hand-edited drift)
  // and whenever the requiredTags template itself is edited. Deliberately
  // NOT wrapped in pushSnapshot/undo history: this is a diagram-level
  // settings change, not a canvas gesture, and requiredTags itself isn't
  // part of the {nodes, edges} history snapshot shape — undoing the
  // resulting metadata edits without also undoing the template change that
  // caused them would just leave the two out of sync again.
  const runSync = useCallback(
    (tags: RequiredTagDefinition[]) => {
      const notices: string[] = []
      setNodes((nds) =>
        nds.map((n) => {
          if (!nodeMetadataEligible(n.type)) return n
          const label = `${n.type === 'shape' ? 'Shape' : 'Container'} "${String(n.data?.label ?? n.id)}"`
          const metadata = syncElementMetadata(
            n.data?.metadata as Record<string, MetadataEntry> | undefined,
            tags,
            label,
            notices
          )
          return { ...n, data: { ...n.data, metadata } }
        })
      )
      setEdges((eds) =>
        eds.map((e) => {
          const label = `Edge "${(typeof e.data?.label === 'string' && e.data.label) || e.id}"`
          const metadata = syncElementMetadata(
            e.data?.metadata as Record<string, MetadataEntry> | undefined,
            tags,
            label,
            notices
          )
          return { ...e, data: { ...e.data, metadata } }
        })
      )
      setDiagnostics(notices)
    },
    [setNodes, setEdges]
  )

  const pushSnapshot = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { nodes, edges }]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
    setFuture([])
    markDirty()
  }, [nodes, edges, markDirty])

  // Push once at the start of a continuous gesture (guarded so a mid-drag
  // call is a no-op, not a fresh snapshot), never at the end.
  const beginContinuousEdit = useCallback(() => {
    if (!interactionInProgressRef.current) {
      pushSnapshot()
      interactionInProgressRef.current = true
    }
  }, [pushSnapshot])

  const endContinuousEdit = useCallback(() => {
    interactionInProgressRef.current = false
  }, [])

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setFuture((prev) => [...prev, { nodes, edges }])
    setPast((prev) => prev.slice(0, -1))
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }, [past, nodes, edges, setNodes, setEdges])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setPast((prev) => [...prev, { nodes, edges }])
    setFuture((prev) => prev.slice(0, -1))
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [future, nodes, edges, setNodes, setEdges])

  // Wraps the raw onNodesChange from useNodesState to snapshot at the right
  // granularity: once per discrete change (remove/add/replace, or a
  // position/dimension change with no dragging/resizing flag at all — e.g.
  // React Flow's own keyboard-triggered arrow-key nudge), once at the
  // *start* of a continuous drag/resize (via beginContinuousEdit, which
  // itself no-ops on subsequent mid-drag calls), never on pure selection
  // changes.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const meaningful = changes.filter((change) => change.type !== 'select')
      if (meaningful.length > 0) {
        const starting = meaningful.some(
          (change) =>
            (change.type === 'position' && change.dragging === true) ||
            (change.type === 'dimensions' && change.resizing === true)
        )
        const ending = meaningful.some(
          (change) =>
            (change.type === 'position' && change.dragging === false) ||
            (change.type === 'dimensions' && change.resizing === false)
        )
        const withinLoadGrace = Date.now() < suppressAutoMeasureUntilRef.current
        const discrete = meaningful.some(
          (change) =>
            change.type === 'remove' ||
            change.type === 'add' ||
            change.type === 'replace' ||
            (change.type === 'position' && change.dragging === undefined) ||
            (change.type === 'dimensions' && change.resizing === undefined && !withinLoadGrace)
        )
        if (starting) beginContinuousEdit()
        else if (discrete) pushSnapshot()
        if (ending) endContinuousEdit()
      }
      // Deleting a container promotes its children rather than removing
      // them too (ADR 0012) — handled separately from React Flow's default
      // remove-change application, which would otherwise just drop them.
      //
      // React Flow's own delete handling (deleteElements/getElementsToRemove
      // in @xyflow/system) cascades to every descendant automatically —
      // selecting just the container still produces a `remove` change for
      // each nested node too, transitively, not only the container itself.
      // Every descendant's remove-change needs stripping here as well, or
      // they get deleted via the normal path before removeContainerReparenting
      // ever runs (and by the time it does, there's nothing left to promote).
      const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id))
      const containerRemovalIds = Array.from(removedIds).filter(
        (removedId) => nodes.find((n) => n.id === removedId)?.type === 'container'
      )
      const isDescendantOfRemovedContainer = (id: string): boolean => {
        let current = nodes.find((n) => n.id === id)
        while (current?.parentId) {
          if (containerRemovalIds.includes(current.parentId)) return true
          current = nodes.find((n) => n.id === current!.parentId)
        }
        return false
      }
      const passthroughChanges = containerRemovalIds.length
        ? changes.filter(
            (c) =>
              !(
                c.type === 'remove' &&
                (containerRemovalIds.includes(c.id) || isDescendantOfRemovedContainer(c.id))
              )
          )
        : changes
      onNodesChangeBase(passthroughChanges)
      if (containerRemovalIds.length > 0) {
        setNodes((nds) =>
          containerRemovalIds.reduce((acc, cid) => removeContainerReparenting(acc, cid), nds)
        )
        setEdges((eds) =>
          eds.filter(
            (e) => !containerRemovalIds.includes(e.source) && !containerRemovalIds.includes(e.target)
          )
        )
      }
    },
    [
      onNodesChangeBase,
      pushSnapshot,
      beginContinuousEdit,
      endContinuousEdit,
      nodes,
      setNodes,
      setEdges
    ]
  )

  // Edges have no drag/resize concept — every non-select change is already
  // discrete (remove/add/replace), so this is simpler than onNodesChange.
  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      if (changes.some((change) => change.type !== 'select')) pushSnapshot()
      onEdgesChangeBase(changes)
    },
    [onEdgesChangeBase, pushSnapshot]
  )

  const openContextMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    setContextMenu({ x, y, items })
  }, [])

  const openIconPicker = useCallback((nodeId: string, anchorRect: DOMRect) => {
    setIconPicker({ nodeId, anchorRect })
  }, [])

  const openColorPicker = useCallback(
    (nodeId: string, kind: 'fill' | 'border', anchorRect: DOMRect) => {
      setColorPicker({ nodeId, kind, anchorRect })
    },
    []
  )

  // Edges have no single DOM element with a natural bounding rect the way
  // nodes do — anchor the popup at the click point instead (RF's
  // onEdgeContextMenu gives us the DOM event directly, no per-edge ref
  // needed).
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      openContextMenu(event.clientX, event.clientY, [
        {
          label: 'Line style…',
          onSelect: () =>
            setLinePicker({
              edgeId: edge.id,
              anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0)
            })
        }
      ])
    },
    [openContextMenu]
  )

  // The utility dock shows one surface at a time (see ADR 0013) — opening
  // any of the five closes the other four, same as clicking a different
  // tab. Highlights moved out of this family (fix/highlights-free-tags-and-
  // toggle) into its own floating popup next to Legend's, in the bottom-left
  // <Controls> cluster — it doesn't compete for the same dock slot anymore,
  // same independence Legend already had, so opening/closing it no longer
  // touches these five and vice versa.
  const openDetailsPanel = useCallback((nodeId: string) => {
    setRequiredTagsPanelOpen(false)
    setDiagnosticsPanelOpen(false)
    setSettingsPanelOpen(false)
    setLayerPanelOpen(false)
    setDetailsPanelNodeId(nodeId)
  }, [])

  const toggleRequiredTagsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setSettingsPanelOpen(false)
    setLayerPanelOpen(false)
    setRequiredTagsPanelOpen((open) => !open)
  }, [])

  const toggleDiagnosticsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setRequiredTagsPanelOpen(false)
    setSettingsPanelOpen(false)
    setLayerPanelOpen(false)
    setDiagnosticsPanelOpen((open) => !open)
  }, [])

  const toggleSettingsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setRequiredTagsPanelOpen(false)
    setDiagnosticsPanelOpen(false)
    setLayerPanelOpen(false)
    setSettingsPanelOpen((open) => !open)
  }, [])

  // Anchors the floating panel to whichever element opened it — same
  // convention as toggleLegendPanel/iconPicker/colorPicker/linePicker's own
  // anchorRect.
  const toggleHighlightsPanel = useCallback((anchorRect: DOMRect) => {
    setHighlightsPanelAnchor(anchorRect)
    setHighlightsPanelOpen((open) => !open)
  }, [])

  const toggleLayerPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setRequiredTagsPanelOpen(false)
    setDiagnosticsPanelOpen(false)
    setSettingsPanelOpen(false)
    setEntityHighlightNodeId(null)
    setLayerPanelOpen((open) => !open)
  }, [])

  const updateRequiredTags = useCallback(
    (tags: RequiredTagDefinition[]) => {
      setRequiredTags(tags)
      runSync(tags)
      markDirty()
    },
    [runSync, markDirty]
  )

  // Add: enforces key+value uniqueness in the catalog (two highlights for
  // the same exact match would be ambiguous — which color applies?), same
  // reasoning as highlightId's own doc comment. Silently no-ops on a
  // duplicate rather than erroring — the picker only ever offers tags
  // already in use, so a duplicate attempt means the same tag was already
  // added, not a real error condition worth interrupting the user for.
  const addHighlight = useCallback(
    (key: string, value: JsonValue, color: string) => {
      setHighlights((prev) =>
        prev.some((h) => h.key === key && JSON.stringify(h.value) === JSON.stringify(value))
          ? prev
          : [...prev, { key, value, color }]
      )
      markDirty()
    },
    [markDirty]
  )

  const updateHighlightColor = useCallback(
    (id: string, color: string) => {
      setHighlights((prev) => prev.map((h) => (highlightId(h) === id ? { ...h, color } : h)))
      markDirty()
    },
    [markDirty]
  )

  const removeHighlight = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => highlightId(h) !== id))
      setEnabledHighlightIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      markDirty()
    },
    [markDirty]
  )

  const toggleHighlightEnabled = useCallback((id: string) => {
    setEnabledHighlightIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Bulk set (not toggle) — used by a group's tri-state "select all"
  // checkbox, epic 0036/ADR 0026: enabling/disabling every member at
  // once needs a uniform target state, not per-id toggling.
  const toggleHighlightGroup = useCallback((ids: string[], enable: boolean) => {
    setEnabledHighlightIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (enable) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  // Legend CRUD — no uniqueness constraint (unlike highlights, two entries
  // can legitimately look identical, e.g. two red dots explaining two
  // different unrelated conventions) and no undo/redo integration, same
  // treatment as the highlight catalog above.
  const addLegendEntry = useCallback(
    (entry: Omit<LegendEntry, 'id'>) => {
      setLegend((prev) => [...prev, { ...entry, id: newNodeId('legend') }])
      markDirty()
    },
    [markDirty]
  )

  const updateLegendEntry = useCallback(
    (id: string, patch: Partial<Omit<LegendEntry, 'id'>>) => {
      setLegend((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
      markDirty()
    },
    [markDirty]
  )

  const removeLegendEntry = useCallback(
    (id: string) => {
      setLegend((prev) => prev.filter((entry) => entry.id !== id))
      markDirty()
    },
    [markDirty]
  )

  // Anchors the floating panel to whichever element opened it — same
  // convention as iconPicker/colorPicker/linePicker's own anchorRect.
  const toggleLegendPanel = useCallback((anchorRect: DOMRect) => {
    setLegendPanelAnchor(anchorRect)
    setLegendPanelOpen((open) => !open)
  }, [])

  // Every distinct key/value pair currently tagged somewhere in the
  // diagram — the "Add highlight" picker only ever offers a tag that's
  // actually in use, not a blank freeform entry (a highlight for a tag
  // nothing carries yet would never match anything).
  const usedTags = useMemo(() => {
    const seen = new Map<string, { key: string; value: JsonValue }>()
    const collect = (metadata: Record<string, MetadataEntry> | undefined): void => {
      if (!metadata) return
      for (const [key, entry] of Object.entries(metadata)) {
        const id = `${key}::${JSON.stringify(entry.value)}`
        if (!seen.has(id)) seen.set(id, { key, value: entry.value })
      }
    }
    for (const n of nodes) collect(n.data?.metadata as Record<string, MetadataEntry> | undefined)
    for (const e of edges) collect(e.data?.metadata as Record<string, MetadataEntry> | undefined)
    return [...seen.values()]
  }, [nodes, edges])

  // "Add group" and each existing group's resync control both call this
  // with the same key — epic 0036/ADR 0026. Reconciles against usedTags
  // (already a live scan of every node/edge's metadata), not a separate
  // scan: a value with no entry gets a new white one, an entry for a
  // value nothing carries anymore is dropped, everything else untouched.
  // Also prunes enabledHighlightIds for whatever got dropped, so a
  // removed row can't leave an orphaned enabled-id behind.
  const addOrResyncHighlightGroup = useCallback(
    (key: string) => {
      const currentValues = usedTags.filter((t) => t.key === key).map((t) => t.value)
      const next = reconcileHighlightGroup(highlights, key, currentValues)
      const nextIds = new Set(next.map(highlightId))
      setHighlights(next)
      setEnabledHighlightIds((prev) => {
        const filtered = new Set([...prev].filter((id) => nextIds.has(id)))
        return filtered.size === prev.size ? prev : filtered
      })
      markDirty()
    },
    [highlights, usedTags, markDirty]
  )

  const matchHighlights = useCallback(
    (metadata: Record<string, MetadataEntry> | undefined) =>
      matchingHighlights(metadata, highlights, enabledHighlightIds),
    [highlights, enabledHighlightIds]
  )

  // Gathers this diagram's own direct linked-node relative paths (deeper
  // levels are discovered from disk during the walk — see ADR 0024),
  // previews the reachable subtree, confirms with the user, then copies.
  // A link resolving outside this diagram's own directory tree is never
  // followed or written to — reported as excluded, not silently skipped.
  const copyRequiredTagsToChildren = useCallback(async () => {
    if (!currentPath) {
      alert('Save the diagram before copying required tags to linked children.')
      return
    }
    const directChildRelativePaths = nodes
      .map((n) =>
        typeof n.data?.linkedDiagram === 'string' ? (n.data.linkedDiagram as string) : undefined
      )
      .filter((p): p is string => p !== undefined)
    if (directChildRelativePaths.length === 0) {
      alert('This diagram has no linked children yet.')
      return
    }
    const preview = await window.api
      .previewRequiredTagsChildren(currentPath, directChildRelativePaths)
      .catch((error: unknown) => {
        alert(`Couldn't scan linked diagrams: ${error instanceof Error ? error.message : String(error)}`)
        return null
      })
    if (!preview) return
    if (preview.reached.length === 0) {
      alert('No linked diagrams to copy to (all links were external or unreadable).')
      return
    }
    const externalNote =
      preview.external.length > 0
        ? `\n\nExcluded (not nested inside this diagram's own colocation folder):\n${preview.external.map((p) => `  ${p}`).join('\n')}`
        : ''
    const confirmMessage =
      `Copy required tags to ${preview.reached.length} linked diagram(s)?\n\n` +
      preview.reached.map((p) => `  ${p}`).join('\n') +
      externalNote
    if (!confirm(confirmMessage)) return
    const result = await window.api
      .copyRequiredTagsToChildren(currentPath, requiredTags, directChildRelativePaths)
      .catch((error: unknown) => {
        alert(`Couldn't copy required tags: ${error instanceof Error ? error.message : String(error)}`)
        return null
      })
    if (!result) return
    const unreadableNote =
      result.unreadable.length > 0
        ? `\n\nCouldn't be read, skipped:\n${result.unreadable.map((p) => `  ${p}`).join('\n')}`
        : ''
    alert(
      `Copied required tags to ${result.reached.length} linked diagram(s):\n\n` +
        result.reached.map((p) => `  ${p}`).join('\n') +
        unreadableNote
    )
  }, [currentPath, nodes, requiredTags])

  const iconPickerNode = iconPicker ? nodes.find((n) => n.id === iconPicker.nodeId) : undefined
  const iconPickerIcons = (iconPickerNode?.data?.icons ?? {}) as Partial<
    Record<IconSlot, IconRef>
  >

  const colorPickerNode = colorPicker ? nodes.find((n) => n.id === colorPicker.nodeId) : undefined
  const colorPickerStyle = (colorPickerNode?.data?.style as NodeStyle | undefined) ?? {}

  // Seed the draft the first time a node's details panel is opened this
  // session — from an existing file if it has one, empty otherwise.
  useEffect(() => {
    if (!detailsPanelNodeId || detailsPanelNodeId in detailsDrafts) return
    const node = nodes.find((n) => n.id === detailsPanelNodeId)
    const existingPath = typeof node?.data?.details === 'string' ? node.data.details : undefined
    if (existingPath && currentPath) {
      window.api.readDetails(currentPath, existingPath).then((content) => {
        setDetailsDrafts((prev) => ({ ...prev, [detailsPanelNodeId]: content }))
      })
    } else {
      setDetailsDrafts((prev) => ({ ...prev, [detailsPanelNodeId]: '' }))
    }
  }, [detailsPanelNodeId, detailsDrafts, nodes, currentPath])

  const onConnect = useCallback(
    (connection: Connection) => {
      pushSnapshot()
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'labeled',
            data: { metadata: seedMetadata(requiredTags), style: settings.defaultEdgeStyle }
          },
          eds
        )
      )
    },
    [setEdges, pushSnapshot, requiredTags, settings.defaultEdgeStyle]
  )

  // Grabbing an existing edge's own endpoint and redropping it elsewhere —
  // distinct from onConnect (a brand-new edge dragged from a node's
  // handle). `edgesReconnectable` on <ReactFlow> is what turns this on;
  // React Flow's own `reconnectEdge` computes the updated edge, same
  // pattern as `addEdge` above. Lets a connection that made sense on one
  // side keep making sense after shapes get rearranged (e.g. "left" now
  // fits better as "top") without deleting and redrawing the whole edge.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      pushSnapshot()
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
    },
    [setEdges, pushSnapshot]
  )

  const onConnectStart = useCallback((_event: unknown, params: OnConnectStartParams) => {
    // Reconnect drags fire this too (see isReconnectingRef's own comment) —
    // onReconnectEnd already owns that gesture, so don't also arm
    // connectStartRef for onConnectEnd to react to.
    if (isReconnectingRef.current) {
      connectStartRef.current = null
      return
    }
    connectStartRef.current = params.nodeId ? { nodeId: params.nodeId, handleId: params.handleId } : null
  }, [])

  const onReconnectStart = useCallback(() => {
    isReconnectingRef.current = true
  }, [])

  // Turns a placeholder AnchorNode (see below) into a real Shape or
  // Container, in place — same id, recentered on the anchor's own center
  // rather than its (much smaller) top-left corner. No edge update needed:
  // AnchorNode shares the same 4 handle ids ('top'/'right'/'bottom'/'left')
  // as ShapeNode/ContainerNode via the same ConnectionHandles component, so
  // whatever handle the edge already attached to on the anchor stays valid
  // on the resolved node too.
  const resolveAnchorNode = useCallback(
    (nodeId: string, type: 'shape' | 'container') => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const centerX = n.position.x + (n.width ?? ANCHOR_SIZE) / 2
          const centerY = n.position.y + (n.height ?? ANCHOR_SIZE) / 2
          const width = type === 'shape' ? SHAPE_MIN_WIDTH * 2 : CONTAINER_MIN_WIDTH * 2
          const height = type === 'shape' ? SHAPE_MIN_HEIGHT * 2 : CONTAINER_MIN_HEIGHT * 1.5
          const metadata = seedMetadata(requiredTags)
          // An anchor never has a zIndex (epic 0043/ADR 0035) — resolving it
          // into a real shape/container needs one now, same default as
          // addShapeNode/addContainerNode.
          const zIndex = nextZIndex(nds, type)
          const data =
            type === 'shape'
              ? { label: 'Shape', zIndex, metadata }
              : {
                  label: 'Container',
                  zIndex,
                  style: { fill: 'var(--ev-c-gray-1)', fillOpacity: 20 },
                  metadata
                }
          return {
            ...n,
            type,
            position: { x: centerX - width / 2, y: centerY - height / 2 },
            width,
            height,
            data
          }
        })
      )
    },
    [setNodes, pushSnapshot, requiredTags]
  )

  // Shared tail of onConnectEnd/onReconnectEnd once a drop has already been
  // confirmed as genuine empty canvas (via isVoidDrop): spawn an AnchorNode
  // there, let the caller wire whichever edge end needs it (the one part
  // that differs between "brand-new edge" and "existing edge's endpoint"),
  // and offer the same Shape/Container popup epic 0014 already established.
  // Dismissing the popup (click elsewhere/Escape, same generic ContextMenu
  // every other popup in this file uses) just leaves the anchor as a small
  // draggable dot — no default type is assumed.
  const spawnAnchorAt = useCallback(
    (clientX: number, clientY: number, wireEdge: (anchorId: string) => void): void => {
      const dropPosition = rfInstance.screenToFlowPosition({ x: clientX, y: clientY })
      const id = newNodeId('anchor')

      pushSnapshot()
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'anchor',
          position: { x: dropPosition.x - ANCHOR_SIZE / 2, y: dropPosition.y - ANCHOR_SIZE / 2 },
          width: ANCHOR_SIZE,
          height: ANCHOR_SIZE,
          data: { label: '' }
        }
      ])
      wireEdge(id)
      openContextMenu(clientX, clientY, [
        { label: 'Shape', onSelect: () => resolveAnchorNode(id, 'shape') },
        { label: 'Container', onSelect: () => resolveAnchorNode(id, 'container') }
      ])
    },
    [rfInstance, pushSnapshot, setNodes, openContextMenu, resolveAnchorNode]
  )

  // Drag-to-create: releasing a connection drag over empty canvas (rather
  // than onto a valid handle) spawns a placeholder AnchorNode — see epic
  // 0014 and isVoidDrop's own comment for why the check is more than just
  // "is event.target the pane."
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      const origin = connectStartRef.current
      connectStartRef.current = null
      if (!origin || !isVoidDrop(event, connectionState)) return

      const point = pointFromEvent(event)
      spawnAnchorAt(point.clientX, point.clientY, (anchorId) =>
        setEdges((eds) =>
          addEdge(
            {
              source: origin.nodeId,
              sourceHandle: origin.handleId,
              target: anchorId,
              targetHandle: 'left',
              type: 'labeled',
              data: { metadata: seedMetadata(requiredTags), style: settings.defaultEdgeStyle }
            },
            eds
          )
        )
      )
    },
    [spawnAnchorAt, setEdges, requiredTags, settings.defaultEdgeStyle]
  )

  // Grabbing an existing edge's own endpoint and dropping it on empty
  // canvas — the reconnect-side counterpart of onConnectEnd above, same
  // AnchorNode outcome. React Flow hands us the edge and which end
  // (`handleType`) directly, so unlike onConnectStart/onConnectEnd there's
  // no need for a ref to bridge drag-start to drag-end.
  const onReconnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      edge: Edge,
      handleType: HandleType,
      connectionState: FinalConnectionState
    ) => {
      isReconnectingRef.current = false
      if (!isVoidDrop(event, connectionState)) return

      const point = pointFromEvent(event)
      spawnAnchorAt(point.clientX, point.clientY, (anchorId) =>
        setEdges((eds) =>
          eds.map((e) => {
            if (e.id !== edge.id) return e
            // `handleType` here is React Flow's own "oppositeHandle" type —
            // the FIXED end that's staying put, not the one being dragged
            // (confirmed by reading EdgeUpdateAnchors' source: grabbing the
            // source anchor passes the *target*'s type, and vice versa).
            // So handleType === 'target' means the target is fixed and the
            // source is what got dragged loose — the inverse of the
            // naive reading.
            return handleType === 'target'
              ? { ...e, source: anchorId, sourceHandle: 'left' }
              : { ...e, target: anchorId, targetHandle: 'left' }
          })
        )
      )
    },
    [spawnAnchorAt, setEdges]
  )

  // Anchors new nodes to the middle of whatever part of the canvas is
  // currently visible, not a fixed canvas-coordinate origin — on a large,
  // panned/zoomed-into diagram, a fixed spawn point is very likely off
  // whatever the user is actually looking at. `index` adds a small bounded
  // jitter (wraps every 5) so repeated clicks don't stack exactly on top of
  // each other, without letting position drift indefinitely over a long
  // session the way the old length-based offset did.
  const spawnPosition = useCallback(
    (width: number, height: number, index: number): { x: number; y: number } => {
      const center = rfInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      })
      const jitter = (index % 5) * 24
      return { x: center.x - width / 2 + jitter, y: center.y - height / 2 + jitter }
    },
    [rfInstance]
  )

  const addShapeNode = useCallback(() => {
    pushSnapshot()
    const id = newNodeId('shape')
    const width = SHAPE_MIN_WIDTH * 2
    const height = SHAPE_MIN_HEIGHT * 2
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'shape',
        position: spawnPosition(width, height, nds.length),
        width,
        height,
        data: { label: 'Shape', zIndex: nextZIndex(nds, 'shape'), metadata: seedMetadata(requiredTags) }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition, requiredTags])

  const addTextNode = useCallback(() => {
    pushSnapshot()
    const id = newNodeId('text')
    const width = TEXT_MIN_WIDTH * 3
    const height = TEXT_MIN_HEIGHT * 2
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'text',
        position: spawnPosition(width, height, nds.length),
        width,
        height,
        data: { label: 'Text', rotation: 0, zIndex: nextZIndex(nds, 'text') }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition])

  const addContainerNode = useCallback(() => {
    pushSnapshot()
    const id = newNodeId('container')
    const width = CONTAINER_MIN_WIDTH * 2
    const height = CONTAINER_MIN_HEIGHT * 1.5
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'container',
        position: spawnPosition(width, height, nds.length),
        width,
        height,
        // A visible-but-faint default fill (the same neutral tone as the
        // dashed border) rather than fully transparent — a freshly-added
        // container should read as "a container" at a glance, not require
        // opening the property panel first to see anything at all.
        data: {
          label: 'Container',
          zIndex: nextZIndex(nds, 'container'),
          style: { fill: 'var(--ev-c-gray-1)', fillOpacity: 20 },
          metadata: seedMetadata(requiredTags)
        }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition, requiredTags])

  // Alignment guides + snap-to-shape while dragging — see epic 0011.
  // Shared by onNodeDrag (live, every tick) and onNodeDragStop (once more
  // on release — see its own comment for why that second call is
  // necessary, not redundant). Snap is computed from the lead dragged node
  // only; a multi-node drag applies the same resulting delta to every node
  // in the group, so their relative offsets to each other are preserved.
  //
  // A dragged node's own descendants move with it, but comparing against
  // them is meaningless (a container always "aligns" with its own
  // contents) and would produce distracting guide lines, so they're
  // excluded from the comparison set.
  const computeGroupSnap = useCallback(
    (draggedNode: Node, nodesToMove: Node[]): { dx: number; dy: number; guideX: number[]; guideY: number[] } => {
      const movedIds = new Set(nodesToMove.map((n) => n.id))
      const byId = new Map(nodes.map((n) => [n.id, n]))
      nodesToMove.forEach((n) => byId.set(n.id, n))

      const isDescendantOfMoved = (id: string): boolean => {
        let current = byId.get(id)
        while (current?.parentId) {
          if (movedIds.has(current.parentId)) return true
          current = byId.get(current.parentId)
        }
        return false
      }

      const draggedAbs = absolutePosition(draggedNode, byId)
      const draggedBounds = boundsFrom(
        draggedAbs.x,
        draggedAbs.y,
        draggedNode.width ?? 0,
        draggedNode.height ?? 0
      )
      const others = nodes
        .filter((n) => !movedIds.has(n.id) && !isDescendantOfMoved(n.id))
        .map((n) => {
          const abs = absolutePosition(n, byId)
          return boundsFrom(abs.x, abs.y, n.width ?? 0, n.height ?? 0)
        })

      const thresholdFlow = SNAP_THRESHOLD_PX / rfInstance.getViewport().zoom
      return computeSnap(draggedBounds, others, thresholdFlow)
    },
    [nodes, rfInstance]
  )

  // Fires on every drag tick with the *live* (pre-snap) position already
  // applied to `node`/`draggedNodes` by React Flow's own onNodesChange
  // pass; this then nudges that position by the computed snap delta via a
  // follow-up setNodes call, which wins as the tick's final state. React
  // Flow's own drag math recomputes each tick from the drag's *start*
  // position plus total pointer movement (not incrementally from the
  // previous tick), so this correction doesn't get "fought" — it just
  // holds the snapped position for as long as the pointer stays within the
  // threshold band, exactly like a Figma/Illustrator smart guide.
  const onNodeDrag = useCallback(
    (_event: unknown, draggedNode: Node, draggedNodes: Node[]) => {
      const nodesToMove = draggedNodes.length > 0 ? draggedNodes : [draggedNode]
      const movedIds = new Set(nodesToMove.map((n) => n.id))
      const { dx, dy, guideX, guideY } = computeGroupSnap(draggedNode, nodesToMove)

      if (dx !== 0 || dy !== 0) {
        setNodes((nds) =>
          nds.map((n) =>
            movedIds.has(n.id)
              ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
              : n
          )
        )
      }
      setAlignmentGuides((prev) => {
        if (guideX.length === 0 && guideY.length === 0) return prev === null ? prev : null
        return { x: guideX, y: guideY }
      })
    },
    [computeGroupSnap, setNodes]
  )

  // Drag-into/out-of a container: fires once at the end of a drag gesture,
  // after the position changes from onNodesChange above have already
  // applied (so each node's `.position` here reflects its final drop
  // position). No pushSnapshot here — reparenting is part of the same
  // gesture whose start already snapshotted via beginContinuousEdit, not a
  // separate action.
  //
  // React Flow's third callback arg is *every* node that moved as part of
  // this drag, not just the one under the cursor — a multi-selected drag
  // must reparent each of them independently (each against its own
  // geometry), or only the grabbed node ends up attached.
  //
  // Re-applies the same snap correction onNodeDrag already did, recomputed
  // fresh rather than reused (the pointer may have moved slightly between
  // the last onNodeDrag tick and release). This is NOT redundant: React
  // Flow commits one final position update straight from the raw pointer
  // position internally (XYDrag's drag-end handler calls
  // updateNodePositions before invoking onNodeDragStop), which silently
  // overwrites whatever onNodeDrag's per-tick corrections had already
  // applied — without this, a node visibly snaps while dragging and then
  // jumps back to the unsnapped position the instant it's released.
  const onNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node, draggedNodes: Node[]) => {
      setAlignmentGuides(null)
      const rawNodesToProcess = draggedNodes.length > 0 ? draggedNodes : [draggedNode]
      const { dx, dy } = computeGroupSnap(draggedNode, rawNodesToProcess)
      const nodesToProcess =
        dx !== 0 || dy !== 0
          ? rawNodesToProcess.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }))
          : rawNodesToProcess

      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        nodesToProcess.forEach((n) => byId.set(n.id, n))
        // Carry the snap correction into the actual state, not just this
        // local byId lookup used for the reparenting math below.
        let result = nds.map((n) => byId.get(n.id) ?? n)

        const isDescendantOf = (candidateId: string, ofId: string): boolean => {
          let current = byId.get(candidateId)
          while (current?.parentId) {
            if (current.parentId === ofId) return true
            current = byId.get(current.parentId)
          }
          return false
        }

        for (const dragged of nodesToProcess) {
          const target = rfInstance
            .getIntersectingNodes(dragged, false)
            .find((n) => n.type === 'container' && n.id !== dragged.id && !isDescendantOf(n.id, dragged.id))
          const newParentId = target?.id
          const current = byId.get(dragged.id)
          if (!current || newParentId === current.parentId) continue
          const abs = absolutePosition(dragged, byId)
          const position = newParentId
            ? subtractPosition(abs, absolutePosition(byId.get(newParentId)!, byId))
            : abs
          const patched = { ...current, parentId: newParentId, position }
          byId.set(dragged.id, patched)
          result = result.map((n) => (n.id === dragged.id ? patched : n))
        }
        return sortNodesForHierarchy(result)
      })
    },
    [rfInstance, setNodes, computeGroupSnap]
  )

  // Bulk version of the drag-in reparenting above, for a container's
  // "Attach contained shapes" menu item — encapsulating a lot of
  // already-positioned nodes shouldn't require one drag per node. Only
  // currently-top-level nodes fully inside the container's bounds qualify —
  // a node already parented elsewhere is left alone, not silently moved
  // out of its existing container.
  const attachContainedNodes = useCallback(
    (containerId: string) => {
      pushSnapshot()
      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        const container = byId.get(containerId)
        if (!container) return nds
        const candidateIds = new Set(
          rfInstance
            .getIntersectingNodes(container, false)
            .filter((n) => n.id !== containerId && !n.parentId)
            .map((n) => n.id)
        )
        if (candidateIds.size === 0) return nds
        const containerAbs = absolutePosition(container, byId)
        const updated = nds.map((n) => {
          if (!candidateIds.has(n.id)) return n
          const abs = absolutePosition(n, byId)
          return { ...n, parentId: containerId, position: subtractPosition(abs, containerAbs) }
        })
        return sortNodesForHierarchy(updated)
      })
    },
    [pushSnapshot, rfInstance, setNodes]
  )

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? n : { ...n, selected: true })))
    setEdges((eds) => eds.map((e) => (e.selected ? e : { ...e, selected: true })))
  }, [setNodes, setEdges])

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)))
  }, [setNodes, setEdges])

  // No clipboard involved (deliberately simpler than real copy/paste — see
  // epic 0025), just clones selected nodes in place with a small offset and
  // selects the clones so they're immediately draggable. Edges between
  // duplicated nodes are not duplicated — same reasoning as epic 0025's
  // notes: that's real clipboard-shaped complexity this shortcut isn't
  // trying to take on.
  const duplicateSelected = useCallback(() => {
    if (!nodes.some((n) => n.selected)) return
    pushSnapshot()
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected)
      if (selected.length === 0) return nds
      const clones = selected.map((n) => ({
        ...n,
        id: newNodeId(n.type ?? 'shape'),
        position: { x: n.position.x + 20, y: n.position.y + 20 },
        selected: true,
        data: { ...n.data }
      }))
      return [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), ...clones]
    })
  }, [nodes, setNodes, pushSnapshot])

  // Property panel writes (epic 0003) — bypass onNodesChange/onEdgesChange
  // entirely (direct setNodes/setEdges), same as IconPicker's onPick already
  // does. Undo grouping is the caller's job: PropertyPanel brackets each
  // field's edit session with beginContinuousEdit/endContinuousEdit (color/
  // number inputs) or calls pushSnapshot directly (selects), passed straight
  // through as props rather than duplicated here.
  const updateNodeStyle = useCallback(
    (nodeIds: string[], patch: Partial<NodeStyle>) => {
      setNodes((nds) =>
        nds.map((n) =>
          nodeIds.includes(n.id)
            ? { ...n, data: { ...n.data, style: { ...(n.data?.style as NodeStyle | undefined), ...patch } } }
            : n
        )
      )
    },
    [setNodes]
  )

  const updateEdgeStyle = useCallback(
    (edgeIds: string[], patch: Partial<EdgeStyle>) => {
      setEdges((eds) =>
        eds.map((e) =>
          edgeIds.includes(e.id)
            ? { ...e, data: { ...e.data, style: { ...(e.data?.style as EdgeStyle | undefined), ...patch } } }
            : e
        )
      )
    },
    [setEdges]
  )

  // Layer panel drag-reorder (epic 0043/ADR 0035) — a discrete action, not
  // a continuous drag session, so this snapshots itself rather than
  // relying on a caller's beginContinuousEdit/endContinuousEdit pair (same
  // "snapshot right before the one-shot mutation" treatment as the icon
  // picker's onPick). `orderedDescending` is built fresh from current
  // `nodes` state each call — the panel doesn't own its own copy of the
  // ordering, `nodes` is the only source of truth.
  const reorderNodeZIndex = useCallback(
    (movedId: string, newIndex: number) => {
      pushSnapshot()
      setNodes((nds) => {
        const orderedDescending = [...nds]
          .map((n) => ({ id: n.id, type: n.type, zIndex: (n.data?.zIndex as number | undefined) ?? 0 }))
          .sort((a, b) => b.zIndex - a.zIndex)
        const updates = reorderZIndex(orderedDescending, movedId, newIndex)
        const updateMap = new Map(updates.map((u) => [u.id, u.zIndex]))
        return nds.map((n) =>
          updateMap.has(n.id) ? { ...n, data: { ...n.data, zIndex: updateMap.get(n.id) } } : n
        )
      })
    },
    [setNodes, pushSnapshot]
  )

  // Metadata section writes (epic 0034) — same bypass-onNodesChange pattern
  // as updateNodeStyle/updateEdgeStyle above; undo grouping is MetadataSection's
  // own job (it calls pushSnapshot before each commit), not duplicated here.
  const updateNodeMetadata = useCallback(
    (nodeId: string, metadata: Record<string, MetadataEntry> | undefined) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, metadata } } : n)))
    },
    [setNodes]
  )

  const updateEdgeMetadata = useCallback(
    (edgeId: string, metadata: Record<string, MetadataEntry> | undefined) => {
      setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, metadata } } : e)))
    },
    [setEdges]
  )

  // Connection point count field (epic 0039/ADR 0036) — a discrete,
  // structural action rather than a style patch: it can both reposition
  // and delete/create points on the target node, and reassign edges off
  // any point it removes. `totalCount` is the side's whole point count,
  // same number the property panel shows and edits directly — no
  // default/custom split to convert between (see ADR 0036's second
  // revision for why that split was removed).
  const setConnectionPointCount = useCallback(
    (nodeId: string, side: ConnectionPointSide, totalCount: number) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const customPoints = (node.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
      const { points, handleReassignments } = setSideCustomPointCount(customPoints, side, totalCount)
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, connectionPoints: points } } : n))
      )
      setEdges((eds) => reassignConnectionPointHandles(eds, nodeId, handleReassignments))
      updateNodeInternals(nodeId)
    },
    [nodes, setNodes, setEdges, pushSnapshot, updateNodeInternals]
  )

  // x/y/width/height are effectively required (or default-sized) fields on
  // a node, unlike the optional style properties above — an empty/cleared
  // number field (patch value undefined, mid-typing) is treated as "leave
  // unchanged" rather than "unset," since there's no meaningful "no
  // position" state to fall into. Rotation is the exception (genuinely
  // optional, defaults to 0 — see TextNode).
  const updateTransform = useCallback(
    (nodeIds: string[], patch: TransformPatch) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (!nodeIds.includes(n.id)) return n
          const position =
            patch.x !== undefined || patch.y !== undefined
              ? { x: patch.x ?? n.position.x, y: patch.y ?? n.position.y }
              : n.position
          return {
            ...n,
            position,
            width: patch.width !== undefined ? patch.width : n.width,
            height: patch.height !== undefined ? patch.height : n.height,
            data: patch.rotation !== undefined ? { ...n.data, rotation: patch.rotation } : n.data
          }
        })
      )
    },
    [setNodes]
  )

  // Locked (epic — blocks drag/resize/rotate and accidental delete via the
  // canvas, see docs/file-format.md's `locked` field). `false` is written
  // as `undefined`, not stored explicitly — matches every other "absent
  // means off" optional node field (rotation, connectionPoints, etc.),
  // keeps an unlocked node's data free of a lingering `locked: false`.
  const updateLocked = useCallback(
    (nodeIds: string[], locked: boolean) => {
      setNodes((nds) =>
        nds.map((n) =>
          nodeIds.includes(n.id) ? { ...n, data: { ...n.data, locked: locked ? true : undefined } } : n
        )
      )
    },
    [setNodes]
  )

  // Writes any dirty detail drafts to disk and returns nodes with
  // data.details updated to point at them — must happen before the main
  // diagram.chd write so that write reflects the new references.
  const flushDetailsDrafts = useCallback(
    async (diagramPath: string, currentNodes: Node[]): Promise<Node[]> => {
      const entries = Object.entries(detailsDrafts)
      if (entries.length === 0) return currentNodes
      const updates: Record<string, string> = {}
      for (const [nodeId, content] of entries) {
        updates[nodeId] = await window.api.writeDetails(diagramPath, nodeId, content)
      }
      const updatedNodes = currentNodes.map((n) =>
        updates[n.id] ? { ...n, data: { ...n.data, details: updates[n.id] } } : n
      )
      setNodes(updatedNodes)
      return updatedNodes
    },
    [detailsDrafts, setNodes]
  )

  // Writes nodesToSave (plus current edges/viewport) to path, flushing any
  // pending detail drafts first, and syncs canvas state to whatever actually
  // got written — the one place a diagram is persisted to disk, so every
  // save-adjacent flow (manual save, link creation, forward link navigation)
  // goes through the same path instead of duplicating the write logic.
  const persistDiagram = useCallback(
    async (path: string, nodesToSave: Node[]): Promise<Node[]> => {
      const savedNodes = await flushDetailsDrafts(path, nodesToSave)
      const diagram = toDiagramFile(
        savedNodes,
        edges,
        rfInstance.getViewport(),
        diagramMetadata,
        requiredTags,
        highlights,
        legend
      )
      await window.api.saveDiagram(path, diagram, sessionIdRef.current)
      setNodes(savedNodes)
      setIsDirty(false)
      return savedNodes
    },
    [edges, rfInstance, flushDetailsDrafts, setNodes, diagramMetadata, requiredTags, highlights, legend]
  )

  // Brief "Saved" confirmation next to the toolbar's Save button — the
  // user reported missing that a save actually happened (there was only
  // ever an alert on *failure*, nothing on success). Re-triggering the
  // timeout on every successful save (not just the first) means rapid
  // successive saves each restart the same visible flash rather than the
  // indicator disappearing mid-flash.
  const flashSaved = useCallback(() => {
    if (savedFlashTimeoutRef.current != null) clearTimeout(savedFlashTimeoutRef.current)
    setShowSavedFlash(true)
    savedFlashTimeoutRef.current = setTimeout(() => setShowSavedFlash(false), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (savedFlashTimeoutRef.current != null) clearTimeout(savedFlashTimeoutRef.current)
    }
  }, [])

  const performSave = useCallback(
    async (forceNewPath: boolean) => {
      try {
        let path = forceNewPath ? null : currentPath
        if (!path) {
          path = await window.api.pickSavePath()
          if (!path) return
        }
        await persistDiagram(path, nodes)
        setCurrentPath(path)
        flashSaved()
      } catch (error) {
        alert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, nodes, persistDiagram, flashSaved]
  )

  const handleSave = useCallback(() => performSave(false), [performSave])
  const handleSaveAs = useCallback(() => performSave(true), [performSave])

  // The one place that applies a loaded DiagramFile to all canvas state —
  // called by this window's own initial-load mount effect below (a window
  // never loads a *different* diagram into itself after that; File Open
  // and both link-navigation flows all open new windows instead, ADR
  // 0023). Also resets any panel/menu state, defensively, in case this
  // ever gets a second caller again.
  const loadDiagramIntoCanvas = useCallback(
    (path: string | null, diagram: DiagramFile) => {
      const {
        nodes: openedNodes,
        edges: openedEdges,
        metadata: openedMetadata,
        requiredTags: openedRequiredTags,
        highlights: openedHighlights,
        legend: openedLegend
      } = fromDiagramFile(diagram)
      // A different diagram entirely — old undo history doesn't apply to
      // it (and, worse, undoing across a load boundary would try to
      // restore a previous diagram's nodes into the wrong file context).
      setPast([])
      setFuture([])
      setIsDirty(false)
      // React Flow measures every freshly-mounted node's real DOM size via
      // ResizeObserver and reports it back as a 'dimensions' NodeChange
      // with resizing left undefined — indistinguishable, by shape alone,
      // from onNodesChange's own "discrete edit" classification below for
      // a scripted dimension change. Harmless before epic 0020 (just an
      // extra no-op undo entry), but now that pushSnapshot also marks the
      // diagram dirty, that same auto-measurement pass falsely dirtied
      // every single load. Suppressed for a short window after any load.
      suppressAutoMeasureUntilRef.current = Date.now() + 500
      setNodes(openedNodes)
      setEdges(openedEdges)
      rfInstance.setViewport(diagram.viewport)
      setCurrentPath(path)
      setDiagramMetadata(openedMetadata)
      setRequiredTags(openedRequiredTags)
      setHighlights(openedHighlights)
      // Enabled state is deliberately never loaded from the file — always
      // starts at none-enabled, ADR 0025's "split persistence" decision.
      setEnabledHighlightIds(new Set())
      setLegend(openedLegend)
      // Shown/hidden state is deliberately never loaded from the file either
      // — always starts closed, same split-persistence treatment (ADR 0033).
      setLegendPanelOpen(false)
      setDetailsDrafts({})
      setContextMenu(null)
      setIconPicker(null)
      setColorPicker(null)
      setLinePicker(null)
      setDetailsPanelNodeId(null)
      setRequiredTagsPanelOpen(false)
      setDiagnosticsPanelOpen(false)
      setHighlightsPanelOpen(false)
      setSettingsPanelOpen(false)
      // Defensive, per ADR 0022 — reconcile against hand-edited drift on
      // every load, not just when the template is edited from within the app.
      runSync(openedRequiredTags)
    },
    [rfInstance, setNodes, setEdges, runSync]
  )

  // A window opened with an initial diagram (File -> Open, or either
  // link-navigation flow) gets it via a ?path= query string on its URL —
  // read here rather than in main, so this reuses the same tested load
  // path as everything else instead of duplicating file-read logic
  // (ADR 0023). Ref-guarded, not an empty deps array, so this survives
  // React StrictMode's dev-mode double-invoke and doesn't re-fire if
  // loadDiagramIntoCanvas's identity changes across renders — see epic
  // 0006/ADR 0018 for why this file is careful about effect double-runs.
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    const path = new URLSearchParams(window.location.search).get('path')
    if (!path) return
    window.api
      .openDiagramAtPath(path)
      .then(async (diagram) => {
        loadDiagramIntoCanvas(path, diagram)
        // Crash recovery (epic 0020/ADR 0040) — a snapshot newer than the
        // real file means the last session ended without saving (crash or
        // force-quit). Prompted, not silently preferred, so a stale
        // recovery snapshot can never clobber a real out-of-app edit.
        const recovered = await window.api.checkRecoveryForPath(path)
        if (!recovered) return
        if (confirm('Unsaved changes from an unexpected close were found for this diagram. Recover them?')) {
          loadDiagramIntoCanvas(path, recovered.diagram)
          setDetailsDrafts(recovered.detailsDrafts)
          markDirty()
        } else {
          window.api.deleteRecoverySnapshot(path, sessionIdRef.current)
        }
      })
      .catch((error) => {
        alert(`Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`)
      })
  }, [loadDiagramIntoCanvas, markDirty])

  // A window created by the startup orphan scan (recovery.ts) — a diagram
  // that crashed before ever being saved, so there's no path for the
  // effect above to key a lookup against. Main pushes the content directly
  // once this fresh window's finished loading. Loaded as unsaved (no
  // path, marked dirty) rather than treated as already-saved content.
  useEffect(() => {
    return window.api.onRecoveredOrphan((snapshot) => {
      loadDiagramIntoCanvas(null, snapshot.diagram)
      setDetailsDrafts(snapshot.detailsDrafts)
      markDirty()
    })
  }, [loadDiagramIntoCanvas, markDirty])

  // Periodic autosave (epic 0020/ADR 0040) — only writes while isDirty, no
  // point re-snapshotting unchanged state. Refs, not effect deps, carry the
  // latest values into the interval callback: re-creating the interval on
  // every nodes/edges change (which is most renders) would mean it almost
  // never actually reaches its own timeout.
  const autosaveStateRef = useRef({
    isDirty,
    currentPath,
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    detailsDrafts
  })
  useEffect(() => {
    autosaveStateRef.current = {
      isDirty,
      currentPath,
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      detailsDrafts
    }
  })
  useEffect(() => {
    const interval = setInterval(() => {
      const s = autosaveStateRef.current
      if (!s.isDirty) return
      const diagram = toDiagramFile(
        s.nodes,
        s.edges,
        rfInstance.getViewport(),
        s.diagramMetadata,
        s.requiredTags,
        s.highlights,
        s.legend
      )
      window.api.writeRecoverySnapshot(s.currentPath, sessionIdRef.current, diagram, s.detailsDrafts)
    }, 60_000)
    return () => clearInterval(interval)
  }, [rfInstance])

  // Real OS window close (close button, Alt+F4) — main intercepts it and
  // asks the renderer whether it's safe to proceed (epic 0020/ADR 0040).
  // A clean window approves immediately; a dirty one drives the native
  // Save/Discard/Cancel dialog, reusing this window's own existing save
  // flow (performSave) rather than duplicating "how to actually save" in
  // main. Refs for the same reason as the autosave timer above — this
  // subscribes once, not on every isDirty/currentPath change.
  const closeCheckStateRef = useRef({ isDirty, currentPath, nodes })
  useEffect(() => {
    closeCheckStateRef.current = { isDirty, currentPath, nodes }
  })

  // Shared by the close-prompt's Save option and the drop-prompt's "Save &
  // Open Here" option — both need "pick a path if there isn't one yet,
  // then persist" outside of an interactive Save/Save As click, so this
  // takes its inputs as plain arguments rather than closing over
  // possibly-stale `currentPath`/`nodes` the way a normal useCallback
  // would (both callers already track their own fresh values via refs, for
  // the same reason persistDiagram itself takes nodesToSave as a param).
  // Returns the path actually saved to, or null if cancelled/failed.
  const performSaveNow = useCallback(
    async (nodesToSave: Node[], currentPathNow: string | null): Promise<string | null> => {
      let path = currentPathNow
      if (!path) {
        path = await window.api.pickSavePath()
        if (!path) return null
      }
      try {
        await persistDiagram(path, nodesToSave)
        setCurrentPath(path)
        return path
      } catch (error) {
        alert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
        return null
      }
    },
    [persistDiagram]
  )

  useEffect(() => {
    return window.api.onCloseRequested(async () => {
      const { isDirty: dirtyNow, currentPath: pathNow, nodes: nodesNow } = closeCheckStateRef.current
      if (!dirtyNow) {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const decision = await window.api.requestCloseDecision()
      if (decision === 'cancel') return
      if (decision === 'discard') {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const savedPath = await performSaveNow(nodesNow, pathNow)
      if (savedPath) window.api.closeApproved(savedPath, sessionIdRef.current)
    })
  }, [performSaveNow])

  // "Save changes, Open Here" (drop onto a dirty window, epic 0038 revision) —
  // main shows the dialog and asks back here since it can't perform the
  // save itself; once done, confirmSavedThenOpen tells main it's safe to
  // navigate this window to the dropped path. A cancelled/failed save
  // just leaves this window as-is, same as the close-prompt's own Cancel.
  useEffect(() => {
    return window.api.onPerformSaveThenOpenDropped(async (path) => {
      const { nodes: nodesNow, currentPath: pathNow } = closeCheckStateRef.current
      const savedPath = await performSaveNow(nodesNow, pathNow)
      if (savedPath) window.api.confirmSavedThenOpen(path)
    })
  }, [performSaveNow])

  // Drag-and-drop a .chd onto this window (epic 0038) — attached to the
  // whole window, not a specific drop zone: React Flow's own node dragging
  // uses pointer events, not the HTML5 Drag-and-Drop API, so the two never
  // compete for the same gesture. Refs, not effect deps, for the same
  // reason as the autosave/close-check state above — this subscribes once.
  const dropStateRef = useRef({ isDirty, currentPath, nodes, edges })
  useEffect(() => {
    dropStateRef.current = { isDirty, currentPath, nodes, edges }
  })
  useEffect(() => {
    // Both dragenter and dragover need preventDefault — Chromium only
    // treats a drop target as valid once both agree, even though in
    // practice dragover alone is enough in most builds.
    const onDragEnter = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      // Rejected upfront by extension, matching the file dialog's own
      // filter — no attempt to read a non-.chd file and fail gracefully.
      const paths = Array.from(files)
        .map((file) => window.api.getPathForFile(file))
        .filter((path) => path.toLowerCase().endsWith('.chd'))
      if (paths.length === 0) {
        alert('Only .chd diagram files can be opened this way.')
        return
      }
      const s = dropStateRef.current
      window.api.handleDroppedFiles(
        paths,
        s.nodes.length === 0 && s.edges.length === 0,
        s.isDirty,
        s.currentPath,
        sessionIdRef.current
      )
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // Opens (or focuses, if already open elsewhere) a new window — except
  // when this window's own diagram is currently empty, in which case that
  // empty window is reused instead of leaving it around unused (see
  // ADR 0023's window-reuse addendum).
  const handleOpen = useCallback(async () => {
    try {
      // A window with nothing in it yet has nothing to lose by being
      // reused, rather than leaving it sitting there empty next to the
      // diagram you actually meant to open.
      await window.api.openInNewWindow(nodes.length === 0 && edges.length === 0)
    } catch (error) {
      alert(`Open failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [nodes, edges])

  // Always opens a new window, never replaces the current one — see
  // ADR 0023. No file is written, nothing is linked from anywhere.
  const handleNew = useCallback(() => {
    window.api.newWindow()
  }, [])

  // File -> Close (epic 0049) — NOT closing the OS window (this app's own
  // convention, confirmed with the user: a window is a diagram, not
  // necessarily disposable). Discards the current diagram back to a blank
  // one *in this same window*, reusing loadDiagramIntoCanvas — the same
  // full-state reset every other load path already goes through — rather
  // than duplicating a scattered set of individual setState(initial) calls.
  // Now that isDirty exists (epic 0020), the confirm() guard is skipped
  // whenever there's genuinely nothing to lose, not just when the canvas
  // happens to be empty (a diagram can be dirty while empty too — add a
  // shape, delete it again — so this is a real behavior change from before).
  const handleClose = useCallback(() => {
    if (isDirty && !confirm('Close this diagram? Any changes since the last save will be lost.')) return
    loadDiagramIntoCanvas(null, { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] })
    // This is an in-place reset, not a page navigation — main's window
    // registry (windows.ts) otherwise never learns this window stopped
    // showing its old path, and a later attempt to open that same file
    // would just focus this (now blank) window instead of reloading it.
    window.api.clearWindowPath()
  }, [isDirty, loadDiagramIntoCanvas])

  // Re-reads this window's own file from disk and reloads it in place,
  // reusing the same loadDiagramIntoCanvas the initial mount effect uses
  // — for picking up changes made outside the app (hand-edited, or
  // written by other tooling) without quitting and relaunching. Now
  // dirty-aware (epic 0020) — a clean window reloads without prompting.
  const handleReload = useCallback(async () => {
    if (!currentPath) return
    if (isDirty && !confirm('Reload from disk? Any changes since the last save will be lost.')) return
    try {
      const diagram = await window.api.openDiagramAtPath(currentPath)
      loadDiagramIntoCanvas(currentPath, diagram)
    } catch (error) {
      alert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [currentPath, isDirty, loadDiagramIntoCanvas])

  // Opens (or focuses, if already open elsewhere) a linked diagram in its
  // own window — used by both link-navigation flows below. Never mutates
  // current state on failure — a missing or unreadable link must leave the
  // diagram containing it fully intact (ADR 0005). Does NOT save anything
  // itself — callers persist first if the parent needs it.
  const openLinkedWindow = useCallback(async (parentPath: string, relativePath: string) => {
    try {
      const result = await window.api.openLinkedInNewWindow(parentPath, relativePath)
      if (!result.found) {
        alert(`Linked diagram not found at ${result.resolvedPath}`)
      }
    } catch (error) {
      alert(
        `Linked diagram at ${relativePath} couldn't be read: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, [])

  // Ctrl/Cmd+click on an already-linked node: persist the parent first —
  // forward link navigation is a natural save point, and skipping this was
  // exactly the bug where a just-created link never survived navigating
  // away from the diagram that holds it (nothing else was ever going to
  // write it to disk once in-memory state gets replaced by the target).
  // Opens the child in a new window rather than replacing this one — see
  // ADR 0023.
  const navigateExistingLink = useCallback(
    async (parentPath: string, relativePath: string) => {
      await persistDiagram(parentPath, nodes)
      await openLinkedWindow(parentPath, relativePath)
    },
    [nodes, persistDiagram, openLinkedWindow]
  )

  // Creating a new linked diagram: link the node (computed directly, not via
  // updateNodeData + re-reading state later — that update wouldn't have been
  // visible to a synchronous save call in the same tick), persist, then
  // open it in a new window — this window stays exactly as it was (ADR 0023).
  const createAndLink = useCallback(
    async (nodeId: string, parentPath: string, label: string) => {
      try {
        const relativePath = await window.api.createLinkedDiagram(parentPath, label)
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedDiagram: relativePath } } : n
        )
        await persistDiagram(parentPath, updatedNodes)
        await openLinkedWindow(parentPath, relativePath)
      } catch (error) {
        alert(
          `Couldn't create linked diagram: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, persistDiagram, openLinkedWindow]
  )

  // Linking to an existing diagram: link and persist, but deliberately stay
  // put — unlike "create new," pointing at something that already exists
  // doesn't imply wanting to jump into it right now.
  const pickAndLink = useCallback(
    async (nodeId: string, parentPath: string) => {
      const relativePath = await window.api.pickExistingLinkedDiagram(parentPath)
      if (!relativePath) return
      try {
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedDiagram: relativePath } } : n
        )
        await persistDiagram(parentPath, updatedNodes)
      } catch (error) {
        alert(`Couldn't save the link: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [nodes, persistDiagram]
  )

  // Ctrl/Cmd+click entry point, exposed via DiagramContext — see epic 0009.
  // A node with no link yet shows a chooser (create new / link existing) at
  // the click point using the existing generic ContextMenu; an already-
  // linked node opens straight into a new window (ADR 0023).
  const handleLinkClick = useCallback(
    (nodeId: string, clientX: number, clientY: number) => {
      if (!currentPath) {
        alert('Save the diagram before linking to another diagram.')
        return
      }
      const node = nodes.find((n) => n.id === nodeId)
      const linkedPath =
        typeof node?.data?.linkedDiagram === 'string' ? (node.data.linkedDiagram as string) : undefined
      if (linkedPath) {
        navigateExistingLink(currentPath, linkedPath)
        return
      }
      const label = String(node?.data?.label ?? 'diagram')
      openContextMenu(clientX, clientY, [
        {
          label: 'Create new linked diagram…',
          onSelect: () => createAndLink(nodeId, currentPath, label)
        },
        { label: 'Link to existing diagram…', onSelect: () => pickAndLink(nodeId, currentPath) }
      ])
    },
    [currentPath, nodes, navigateExistingLink, openContextMenu, createAndLink, pickAndLink]
  )

  // Global shortcuts — see epic 0018. One handler rather than one useEffect
  // per shortcut, now that there are enough of these to make that
  // unwieldy. Checks both ctrlKey and metaKey throughout (not just on
  // Windows/Linux's Ctrl) — no reason to make this actively worse for Mac
  // users over a one-line check, even though macOS isn't a primary target.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const isEditingText =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const mod = event.ctrlKey || event.metaKey

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (event.shiftKey) handleSaveAs()
        else handleSave()
        return
      }
      if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        handleOpen()
        return
      }
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleNew()
        return
      }
      // Universal desktop-app convention, added alongside epic 0049's File
      // -> Close menu item — no shortcut existed for this action before.
      // See handleClose's own comment for what "Close" actually does here
      // (discard back to blank, not close the OS window).
      if (mod && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        handleClose()
        return
      }
      // Ctrl+A/D are text-editing conventions (select-all-text, and in some
      // apps duplicate-line) — defer to native behavior while a text field
      // has focus rather than hijacking them for canvas actions.
      if (mod && event.key.toLowerCase() === 'a' && !isEditingText) {
        event.preventDefault()
        selectAll()
        return
      }
      if (mod && event.key.toLowerCase() === 'd' && !isEditingText) {
        event.preventDefault()
        duplicateSelected()
        return
      }
      // Same reasoning as Ctrl+A/D — defer to native text-field undo while
      // typing. Figma-style redo binding (Ctrl+Shift+Z), not Ctrl+Y.
      if (mod && event.key.toLowerCase() === 'z' && !isEditingText) {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && event.key === '0') {
        event.preventDefault()
        rfInstance.fitView()
        return
      }
      if (event.key === 'Escape') {
        if (detailsPanelNodeId) {
          setDetailsPanelNodeId(null)
        } else if (requiredTagsPanelOpen) {
          setRequiredTagsPanelOpen(false)
        } else if (diagnosticsPanelOpen) {
          setDiagnosticsPanelOpen(false)
        } else if (highlightsPanelOpen) {
          setHighlightsPanelOpen(false)
        } else if (settingsPanelOpen) {
          setSettingsPanelOpen(false)
        } else if (iconPicker) {
          setIconPicker(null)
        } else if (colorPicker) {
          setColorPicker(null)
        } else if (linePicker) {
          setLinePicker(null)
        } else if (contextMenu) {
          setContextMenu(null)
        } else {
          deselectAll()
        }
        return
      }
      // No custom arrow-key nudge here — React Flow already moves selected
      // nodes on arrow keys natively (1px, 4px with Shift; see
      // arrowKeyDiffs/moveSelectedNodes in @xyflow/react). Adding our own
      // handler double-applied on top of it (confirmed: a single ArrowRight
      // moved a node 6px, not the 1px expected) rather than being additive
      // with nothing already there, unlike drag-to-select/multi-select.
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    handleClose,
    selectAll,
    duplicateSelected,
    deselectAll,
    undo,
    redo,
    rfInstance,
    detailsPanelNodeId,
    requiredTagsPanelOpen,
    diagnosticsPanelOpen,
    highlightsPanelOpen,
    settingsPanelOpen,
    iconPicker,
    colorPicker,
    linePicker,
    contextMenu
  ])

  // Drives the diagram dock's mode (item palette vs. property panel) — see
  // ADR 0013/epic 0003. Recomputed from `nodes`/`edges` each render rather
  // than tracked separately; the tree is small enough that this isn't worth
  // memoizing.
  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedEdges = edges.filter((e) => e.selected)

  // Each node's persisted stacking order — see epic 0043/ADR 0035. No
  // type-based special-casing here: the "containers render behind shapes"
  // look most diagrams start with is purely a consequence of the
  // load-time backfill's starting values (applyZIndexBackfill/nextZIndex),
  // not a rule enforced at render time — drag a container above a shape in
  // the layer panel and it genuinely renders above it from then on. React
  // Flow still adds its own selection elevation on top of whatever's set
  // here (elevateNodesOnSelect, on by default).
  // Locked (data.locked, see docs/file-format.md) maps onto React Flow's
  // own native draggable/deletable per-node overrides here, same "convert
  // at the point nodes are actually handed to <ReactFlow>" pattern as
  // zIndex above — selectable is deliberately left alone (still true),
  // since the whole point was blocking accidental drags/deletes while
  // keeping selection/highlighting working normally.
  const zIndexedNodes = nodes.map((n) => ({
    ...n,
    zIndex: (n.data?.zIndex as number | undefined) ?? 0,
    draggable: n.data?.locked !== true,
    deletable: n.data?.locked !== true
  }))
  const nodeZIndexById = new Map(zIndexedNodes.map((n) => [n.id, n.zIndex as number]))

  // Stable DOM-order tie-breaker for edges of otherwise-equal zIndex below
  // — kept from epic 0046, though live debugging (2026-08-22, see
  // docs/known-issues.md) found DOM order was never actually the real
  // mechanism deciding reconnect-handle hit-testing; see SELECTED_EDGE_Z_BOOST
  // just below for the fix that actually addresses it.
  const orderedEdges = [...edges.filter((e) => !e.selected), ...edges.filter((e) => e.selected)]

  // An edge has no zIndex of its own to control — epic 0043/ADR 0035
  // deliberately scoped this feature to Shape/Container/Text only. Instead
  // it always sits at the midpoint of its two endpoints' current stacking,
  // computed fresh here alongside orderedEdges above, never persisted.
  //
  // Selected edges get pushed well above that midpoint range — traced
  // 2026-08-22 (docs/known-issues.md) after a real, reproduced bug: React
  // Flow renders each edge inside its own `<svg style={{ zIndex }}>`
  // wrapper (a real CSS z-index per edge, not shared DOM/paint order at
  // all), and that zIndex comes from this exact midpoint computation
  // combined with `elevateEdgesOnSelect` (a React Flow option that
  // defaults to false and was never enabled here) — so selection had
  // *zero* effect on which edge's z-index won at a shared connection
  // point; two converging edges resolved purely by which pair of
  // endpoints happened to average a higher zIndex, unrelated to which one
  // was actually selected. Epic 0046's original `orderedEdges`-only fix
  // (DOM order) coincidentally looked like it worked in that one test
  // scenario but was never actually the operative mechanism.
  const SELECTED_EDGE_Z_BOOST = 1_000_000
  const zIndexedEdges = orderedEdges.map((e) => {
    const sourceZ = nodeZIndexById.get(e.source) ?? 0
    const targetZ = nodeZIndexById.get(e.target) ?? 0
    const baseZ = (sourceZ + targetZ) / 2
    return { ...e, zIndex: e.selected ? baseZ + SELECTED_EDGE_Z_BOOST : baseZ }
  })

  // Plain-data projection for LayerPanel — keeps that component decoupled
  // from React Flow's own Node type, same reasoning as passing plain
  // derived data to other panels elsewhere in this file. Sorted highest
  // z-index first, matching the panel's own top-of-list-is-frontmost
  // display convention — see epic 0043/ADR 0035.
  const layerRows = [...nodes]
    .map((n) => ({
      id: n.id,
      type: n.type ?? 'shape',
      label: String(n.data?.label ?? ''),
      zIndex: (n.data?.zIndex as number | undefined) ?? 0
    }))
    .sort((a, b) => b.zIndex - a.zIndex)

  // Top menu bar (epic 0049) — File/Edit/View, an explicit information-
  // architecture split worked out with the user alongside epic 0048 (left
  // sidebar, not yet built): file-level actions here, per-diagram
  // inspection panels also here for now (View), Highlights already moved
  // to its own floating popup next to Legend regardless of this epic
  // (fix/highlights-free-tags-and-toggle). Every item reuses an existing
  // handler unchanged — this menu is purely a new way to reach them, not a
  // new set of actions.
  const menus: MenuBarMenu[] = [
    {
      label: 'File',
      items: [
        { label: 'New', accelerator: 'Ctrl+N', onSelect: handleNew },
        { label: 'Open…', accelerator: 'Ctrl+O', onSelect: handleOpen },
        { label: 'Save', accelerator: 'Ctrl+S', onSelect: handleSave },
        { label: 'Save As…', accelerator: 'Ctrl+Shift+S', onSelect: handleSaveAs },
        { label: 'Reload', disabled: !currentPath, onSelect: handleReload },
        { label: 'Close', accelerator: 'Ctrl+W', onSelect: handleClose }
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', accelerator: 'Ctrl+Z', disabled: past.length === 0, onSelect: undo },
        { label: 'Redo', accelerator: 'Ctrl+Shift+Z', disabled: future.length === 0, onSelect: redo }
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Required tags', onSelect: toggleRequiredTagsPanel },
        {
          label: `Diagnostics${diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}`,
          onSelect: toggleDiagnosticsPanel
        },
        { label: 'Layers', onSelect: toggleLayerPanel },
        { label: 'Settings', onSelect: toggleSettingsPanel }
      ]
    },
    {
      label: 'Help',
      items: [{ label: 'About', onSelect: () => setAboutDialogOpen(true) }]
    }
  ]

  return (
    <DiagramContext.Provider
      value={{
        diagramPath: currentPath,
        openContextMenu,
        openIconPicker,
        openColorPicker,
        openDetailsPanel,
        handleLinkClick,
        beginContinuousEdit,
        endContinuousEdit,
        pushSnapshot,
        attachContainedNodes,
        matchHighlights,
        edgeStraightSegmentLength: settings.edgeStraightSegmentLength,
        maxConnectionPointsPerSide: settings.maxConnectionPointsPerSide,
        selectedEdgeHighlightColor: settings.selectedEdgeHighlightColor,
        theme,
        entityHighlightNodeId
      }}
    >
      {/* Outer app shell: [canvas view [diagram dock]] [utility dock], nested
          not flat — see ADR 0013. */}
      <div className="app-shell">
        <div className="canvas-view">
          <div className="toolbar">
            <MenuBar menus={menus} />
            {showSavedFlash && (
              <span className="toolbar-saved-flash" role="status">
                ✓ Saved
              </span>
            )}
            {currentPath && (
              <span className="toolbar-path" title={currentPath}>
                {currentPath.split(/[\\/]/).pop()}
              </span>
            )}
            <button
              type="button"
              className="toolbar-edge-style-swatch"
              title="Default style for newly drawn edges"
              aria-label="Default style for newly drawn edges"
              onClick={(event) => setDefaultEdgeStylePicker(event.currentTarget.getBoundingClientRect())}
            >
              <svg width="28" height="16" viewBox="0 0 28 16">
                <line
                  x1="2"
                  y1="8"
                  x2={settings.defaultEdgeStyle.endMarker === 'none' ? 26 : 20}
                  y2="8"
                  stroke={settings.defaultEdgeStyle.stroke ?? 'currentColor'}
                  strokeWidth={settings.defaultEdgeStyle.strokeWidth ?? 2}
                  strokeDasharray={DEFAULT_EDGE_SWATCH_DASH[settings.defaultEdgeStyle.lineStyle ?? 'solid']}
                />
                {settings.defaultEdgeStyle.endMarker !== 'none' && (
                  <polygon
                    points="20,3 26,8 20,13"
                    fill={settings.defaultEdgeStyle.stroke ?? 'currentColor'}
                  />
                )}
              </svg>
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="canvas-view-body">
            <div className="canvas-view-flow">
              <EdgeMarkerDefs />
              <ReactFlow
                nodes={zIndexedNodes}
                edges={zIndexedEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onReconnect={onReconnect}
                onReconnectStart={onReconnectStart}
                onReconnectEnd={onReconnectEnd}
                edgesReconnectable
                // A little smaller than React Flow's own default (10) — and
                // kept equal to main.css's `.react-flow__edgeupdater` `r`
                // value, epic 0046, so the visible dot on a selected edge
                // matches the actual grabbable area exactly rather than
                // over- or under-promising it.
                reconnectRadius={8}
                onEdgeContextMenu={onEdgeContextMenu}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{ type: 'labeled', markerEnd: { type: MarkerType.ArrowClosed } }}
                deleteKeyCode={['Delete', 'Backspace']}
                multiSelectionKeyCode="Shift" // frees Ctrl/Cmd+click for linked-diagram navigation — epic 0009
                colorMode={theme}
                fitView
              >
                <Background />
                <Controls>
                  <ControlButton
                    title="Show legend"
                    aria-label="Show legend"
                    onClick={(event) => toggleLegendPanel(event.currentTarget.getBoundingClientRect())}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <circle cx="5" cy="7" r="2.5" fill="currentColor" />
                      <line x1="10" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" />
                      <circle cx="5" cy="17" r="2.5" fill="currentColor" />
                      <line x1="10" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </ControlButton>
                  <ControlButton
                    title={`Highlights${highlights.length > 0 ? ` (${highlights.length})` : ''}`}
                    aria-label="Show highlights"
                    onClick={(event) => toggleHighlightsPanel(event.currentTarget.getBoundingClientRect())}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M12 3 L14.5 9.5 L21 12 L14.5 14.5 L12 21 L9.5 14.5 L3 12 L9.5 9.5 Z"
                        fill="currentColor"
                      />
                    </svg>
                  </ControlButton>
                </Controls>
                <MiniMap />
              </ReactFlow>
              <AlignmentGuides guides={alignmentGuides} />
            </div>
            <DiagramDock
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onAddShape={addShapeNode}
              onAddText={addTextNode}
              onAddContainer={addContainerNode}
              onUpdateNodeStyle={updateNodeStyle}
              onUpdateEdgeStyle={updateEdgeStyle}
              onUpdateTransform={updateTransform}
              onUpdateLocked={updateLocked}
              onUpdateNodeMetadata={updateNodeMetadata}
              onUpdateEdgeMetadata={updateEdgeMetadata}
              onSetConnectionPointCount={setConnectionPointCount}
              maxConnectionPointsPerSide={settings.maxConnectionPointsPerSide}
              requiredTags={requiredTags}
              beginContinuousEdit={beginContinuousEdit}
              endContinuousEdit={endContinuousEdit}
              pushSnapshot={pushSnapshot}
            />
          </div>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={contextMenu.items}
              onClose={() => setContextMenu(null)}
            />
          )}
          {iconPicker && iconPickerNode && (
            <IconPicker
              diagramPath={currentPath}
              icons={iconPickerIcons}
              initialSlot="topRight"
              anchorRect={iconPicker.anchorRect}
              onPick={(slot, icon) => {
                pushSnapshot()
                rfInstance.updateNodeData(iconPicker.nodeId, {
                  icons: { ...iconPickerIcons, [slot]: icon }
                })
                setIconPicker(null)
              }}
              onRemove={(slot) => {
                pushSnapshot()
                const next = { ...iconPickerIcons }
                delete next[slot]
                rfInstance.updateNodeData(iconPicker.nodeId, { icons: next })
                setIconPicker(null)
              }}
              onClose={() => setIconPicker(null)}
            />
          )}
          {colorPicker && colorPickerNode && (
            <ColorPickerPopup
              title={colorPicker.kind === 'fill' ? 'Fill' : 'Border'}
              anchorRect={colorPicker.anchorRect}
              color={themeAdaptiveColor(
                colorPicker.kind === 'fill' ? colorPickerStyle.fill : colorPickerStyle.stroke,
                theme
              )}
              opacity={
                colorPicker.kind === 'fill' ? colorPickerStyle.fillOpacity : colorPickerStyle.strokeOpacity
              }
              width={colorPicker.kind === 'border' ? colorPickerStyle.strokeWidth : undefined}
              onChangeColor={(value) =>
                updateNodeStyle(
                  [colorPicker.nodeId],
                  colorPicker.kind === 'fill'
                    ? { fill: themeAdaptiveColor(value, theme) }
                    : { stroke: themeAdaptiveColor(value, theme) }
                )
              }
              onChangeOpacity={(value) =>
                updateNodeStyle(
                  [colorPicker.nodeId],
                  colorPicker.kind === 'fill' ? { fillOpacity: value } : { strokeOpacity: value }
                )
              }
              onChangeWidth={
                colorPicker.kind === 'border'
                  ? (value) => updateNodeStyle([colorPicker.nodeId], { strokeWidth: value })
                  : undefined
              }
              onSessionStart={beginContinuousEdit}
              onSessionEnd={endContinuousEdit}
              onClose={() => setColorPicker(null)}
            />
          )}
          {linePicker && (
            <StylePicker
              anchorRect={linePicker.anchorRect}
              onPick={(patch) => {
                pushSnapshot()
                updateEdgeStyle([linePicker.edgeId], patch)
                setLinePicker(null)
              }}
              onClose={() => setLinePicker(null)}
            />
          )}
          {defaultEdgeStylePicker && (
            <StylePicker
              anchorRect={defaultEdgeStylePicker}
              onPick={(patch) => {
                // Whole-object replace, not merged into the existing
                // default — picking a preset here means "this preset is
                // now the default," same as picking one for a single edge
                // replaces that edge's look rather than layering on top.
                updateSettings({ defaultEdgeStyle: patch })
                setDefaultEdgeStylePicker(null)
              }}
              onClose={() => setDefaultEdgeStylePicker(null)}
            />
          )}
          {legendPanelOpen && (
            <LegendPanel
              diagramPath={currentPath}
              legend={legend}
              anchorRect={legendPanelAnchor}
              onAdd={addLegendEntry}
              onUpdate={updateLegendEntry}
              onRemove={removeLegendEntry}
              onClose={() => setLegendPanelOpen(false)}
            />
          )}
          {highlightsPanelOpen && (
            <HighlightsPanel
              highlights={highlights}
              enabledIds={enabledHighlightIds}
              usedTags={usedTags}
              anchorRect={highlightsPanelAnchor}
              onAdd={addHighlight}
              onUpdateColor={updateHighlightColor}
              onRemove={removeHighlight}
              onToggle={toggleHighlightEnabled}
              onToggleGroup={toggleHighlightGroup}
              onAddOrResyncGroup={addOrResyncHighlightGroup}
              onClose={() => setHighlightsPanelOpen(false)}
            />
          )}
        </div>
        <UtilityDock>
          {detailsPanelNodeId && (
            <DetailsPanel
              content={detailsDrafts[detailsPanelNodeId] ?? ''}
              onChange={(content) => {
                setDetailsDrafts((prev) => ({ ...prev, [detailsPanelNodeId]: content }))
                markDirty()
              }}
              onClose={() => setDetailsPanelNodeId(null)}
            />
          )}
          {requiredTagsPanelOpen && (
            <RequiredTagsPanel
              requiredTags={requiredTags}
              usedTags={usedTags}
              onChange={updateRequiredTags}
              onClose={() => setRequiredTagsPanelOpen(false)}
              onCopyToChildren={copyRequiredTagsToChildren}
            />
          )}
          {diagnosticsPanelOpen && (
            <DiagnosticsPanel
              entries={diagnostics}
              onRecheck={() => runSync(requiredTags)}
              onClose={() => setDiagnosticsPanelOpen(false)}
            />
          )}
          {layerPanelOpen && (
            <LayerPanel
              rows={layerRows}
              entityHighlightNodeId={entityHighlightNodeId}
              onPointAt={setEntityHighlightNodeId}
              onReorder={reorderNodeZIndex}
              onClose={() => {
                setEntityHighlightNodeId(null)
                setLayerPanelOpen(false)
              }}
            />
          )}
          {settingsPanelOpen && (
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onClose={() => setSettingsPanelOpen(false)}
            />
          )}
        </UtilityDock>
        {aboutDialogOpen && <AboutDialog onClose={() => setAboutDialogOpen(false)} />}
      </div>
    </DiagramContext.Provider>
  )
}

export default function Canvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
