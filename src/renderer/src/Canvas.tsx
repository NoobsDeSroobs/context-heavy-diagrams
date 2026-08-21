import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ConnectionMode,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
  type DiagramFile,
  type EdgeStyle,
  type HighlightDefinition,
  type IconRef,
  type IconSlot,
  type JsonValue,
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
import DiagramDock from './panels/DiagramDock'
import UtilityDock from './panels/UtilityDock'
import AlignmentGuides from './components/AlignmentGuides'
import { SNAP_THRESHOLD_PX, boundsFrom, computeSnap } from './alignment'
import type { TransformPatch } from './panels/PropertyPanel'
import { useTheme } from './theme'

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
  highlights: HighlightDefinition[]
): DiagramFile {
  return {
    version: 1,
    viewport,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      size: n.width != null && n.height != null ? { width: n.width, height: n.height } : undefined,
      rotation: typeof n.data?.rotation === 'number' ? (n.data.rotation as number) : undefined,
      connectionPoints: Array.isArray(n.data?.connectionPoints)
        ? (n.data.connectionPoints as ConnectionPoint[])
        : undefined,
      parentId: n.parentId,
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
} {
  return {
    highlights: diagram.highlights ?? [],
    // sortNodesForHierarchy defensively re-orders in case an external
    // writer didn't honor the parent-before-child requirement — see
    // docs/file-format.md's parentId entry.
    nodes: sortNodesForHierarchy(
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
  // No allowedValues means nothing to be invalid against — see ADR 0022.
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
  // Non-blocking notices from the most recent syncElementMetadata pass —
  // deliberately *replaced*, not appended, on every sync: this reflects
  // current state (what the last backfill run had to correct), not a
  // growing history log. A file with nothing to correct clears the list.
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [requiredTagsPanelOpen, setRequiredTagsPanelOpen] = useState(false)
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false)
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
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
  }, [nodes, edges])

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
        const discrete = meaningful.some(
          (change) =>
            change.type === 'remove' ||
            change.type === 'add' ||
            change.type === 'replace' ||
            (change.type === 'position' && change.dragging === undefined) ||
            (change.type === 'dimensions' && change.resizing === undefined)
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
  // any of the four closes the other three, same as clicking a different tab.
  const openDetailsPanel = useCallback((nodeId: string) => {
    setRequiredTagsPanelOpen(false)
    setDiagnosticsPanelOpen(false)
    setHighlightsPanelOpen(false)
    setDetailsPanelNodeId(nodeId)
  }, [])

  const toggleRequiredTagsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setHighlightsPanelOpen(false)
    setRequiredTagsPanelOpen((open) => !open)
  }, [])

  const toggleDiagnosticsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setRequiredTagsPanelOpen(false)
    setHighlightsPanelOpen(false)
    setDiagnosticsPanelOpen((open) => !open)
  }, [])

  const toggleHighlightsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setRequiredTagsPanelOpen(false)
    setDiagnosticsPanelOpen(false)
    setHighlightsPanelOpen((open) => !open)
  }, [])

  const updateRequiredTags = useCallback(
    (tags: RequiredTagDefinition[]) => {
      setRequiredTags(tags)
      runSync(tags)
    },
    [runSync]
  )

  // Add: enforces key+value uniqueness in the catalog (two highlights for
  // the same exact match would be ambiguous — which color applies?), same
  // reasoning as highlightId's own doc comment. Silently no-ops on a
  // duplicate rather than erroring — the picker only ever offers tags
  // already in use, so a duplicate attempt means the same tag was already
  // added, not a real error condition worth interrupting the user for.
  const addHighlight = useCallback((key: string, value: JsonValue, color: string) => {
    setHighlights((prev) =>
      prev.some((h) => h.key === key && JSON.stringify(h.value) === JSON.stringify(value))
        ? prev
        : [...prev, { key, value, color }]
    )
  }, [])

  const updateHighlightColor = useCallback((id: string, color: string) => {
    setHighlights((prev) => prev.map((h) => (highlightId(h) === id ? { ...h, color } : h)))
  }, [])

  const removeHighlight = useCallback((id: string) => {
    setHighlights((prev) => prev.filter((h) => highlightId(h) !== id))
    setEnabledHighlightIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

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
    },
    [highlights, usedTags]
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
        addEdge({ ...connection, type: 'labeled', data: { metadata: seedMetadata(requiredTags) } }, eds)
      )
    },
    [setEdges, pushSnapshot, requiredTags]
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
          const data =
            type === 'shape'
              ? { label: 'Shape', metadata }
              : {
                  label: 'Container',
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
              data: { metadata: seedMetadata(requiredTags) }
            },
            eds
          )
        )
      )
    },
    [spawnAnchorAt, setEdges, requiredTags]
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
        data: { label: 'Shape', metadata: seedMetadata(requiredTags) }
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
        data: { label: 'Text', rotation: 0 }
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
        highlights
      )
      await window.api.saveDiagram(path, diagram)
      setNodes(savedNodes)
      return savedNodes
    },
    [edges, rfInstance, flushDetailsDrafts, setNodes, diagramMetadata, requiredTags, highlights]
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
        highlights: openedHighlights
      } = fromDiagramFile(diagram)
      // A different diagram entirely — old undo history doesn't apply to
      // it (and, worse, undoing across a load boundary would try to
      // restore a previous diagram's nodes into the wrong file context).
      setPast([])
      setFuture([])
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
      setDetailsDrafts({})
      setContextMenu(null)
      setIconPicker(null)
      setColorPicker(null)
      setLinePicker(null)
      setDetailsPanelNodeId(null)
      setRequiredTagsPanelOpen(false)
      setDiagnosticsPanelOpen(false)
      setHighlightsPanelOpen(false)
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
      .then((diagram) => loadDiagramIntoCanvas(path, diagram))
      .catch((error) => {
        alert(`Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`)
      })
  }, [loadDiagramIntoCanvas])

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

  // Re-reads this window's own file from disk and reloads it in place,
  // reusing the same loadDiagramIntoCanvas the initial mount effect uses
  // — for picking up changes made outside the app (hand-edited, or
  // written by other tooling) without quitting and relaunching. There's
  // no dirty-tracking in this app yet (epic 0020), so this can't tell
  // whether there are actually unsaved changes to lose — always confirms.
  const handleReload = useCallback(async () => {
    if (!currentPath) return
    if (!confirm('Reload from disk? Any changes since the last save will be lost.')) return
    try {
      const diagram = await window.api.openDiagramAtPath(currentPath)
      loadDiagramIntoCanvas(currentPath, diagram)
    } catch (error) {
      alert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [currentPath, loadDiagramIntoCanvas])

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

  // Containers must always render behind shapes/text, regardless of
  // creation order or drag history — a container is a background grouping
  // box, not something that should ever visually cover a sibling shape it
  // happens to overlap. React Flow computes each node's actual stacking as
  // zIndex + (selected ? 1000 : 0) (elevateNodesOnSelect, on by default —
  // see @xyflow/system's calculateZ), so the two tiers need more than 1000
  // apart, or a *selected* container would still jump above an unselected
  // shape. Derived purely from `type` at render time, never persisted —
  // this is a rendering concern, not diagram content.
  const zIndexedNodes = nodes.map((n) => ({ ...n, zIndex: n.type === 'container' ? 0 : 2000 }))

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
        matchHighlights
      }}
    >
      {/* Outer app shell: [canvas view [diagram dock]] [utility dock], nested
          not flat — see ADR 0013. */}
      <div className="app-shell">
        <div className="canvas-view">
          <div className="toolbar">
            <button onClick={handleNew}>New</button>
            <button onClick={handleOpen}>Open…</button>
            <button onClick={handleSave}>Save</button>
            <button onClick={handleSaveAs}>Save As…</button>
            <button
              onClick={handleReload}
              disabled={!currentPath}
              title="Re-read this file from disk, discarding unsaved changes"
            >
              Reload
            </button>
            {showSavedFlash && (
              <span className="toolbar-saved-flash" role="status">
                ✓ Saved
              </span>
            )}
            <button onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
              Undo
            </button>
            <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
              Redo
            </button>
            <button onClick={toggleRequiredTagsPanel}>Required tags…</button>
            <button onClick={toggleDiagnosticsPanel}>
              Diagnostics{diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}
            </button>
            <button onClick={toggleHighlightsPanel}>
              Highlights{highlights.length > 0 ? ` (${highlights.length})` : ''}
            </button>
            {currentPath && <span className="toolbar-path">{currentPath}</span>}
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
                edges={edges}
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
                onEdgeContextMenu={onEdgeContextMenu}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{ type: 'labeled', markerEnd: { type: MarkerType.ArrowClosed } }}
                deleteKeyCode={['Delete', 'Backspace']}
                multiSelectionKeyCode="Shift" // frees Ctrl/Cmd+click for linked-diagram navigation — epic 0009
                colorMode={theme}
                fitView
              >
                <Background />
                <Controls />
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
              onUpdateNodeMetadata={updateNodeMetadata}
              onUpdateEdgeMetadata={updateEdgeMetadata}
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
              color={colorPicker.kind === 'fill' ? colorPickerStyle.fill : colorPickerStyle.stroke}
              opacity={
                colorPicker.kind === 'fill' ? colorPickerStyle.fillOpacity : colorPickerStyle.strokeOpacity
              }
              width={colorPicker.kind === 'border' ? colorPickerStyle.strokeWidth : undefined}
              onChangeColor={(value) =>
                updateNodeStyle(
                  [colorPicker.nodeId],
                  colorPicker.kind === 'fill' ? { fill: value } : { stroke: value }
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
        </div>
        <UtilityDock>
          {detailsPanelNodeId && (
            <DetailsPanel
              content={detailsDrafts[detailsPanelNodeId] ?? ''}
              onChange={(content) =>
                setDetailsDrafts((prev) => ({ ...prev, [detailsPanelNodeId]: content }))
              }
              onClose={() => setDetailsPanelNodeId(null)}
            />
          )}
          {requiredTagsPanelOpen && (
            <RequiredTagsPanel
              requiredTags={requiredTags}
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
          {highlightsPanelOpen && (
            <HighlightsPanel
              highlights={highlights}
              enabledIds={enabledHighlightIds}
              usedTags={usedTags}
              onAdd={addHighlight}
              onUpdateColor={updateHighlightColor}
              onRemove={removeHighlight}
              onToggle={toggleHighlightEnabled}
              onToggleGroup={toggleHighlightGroup}
              onAddOrResyncGroup={addOrResyncHighlightGroup}
              onClose={() => setHighlightsPanelOpen(false)}
            />
          )}
        </UtilityDock>
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
