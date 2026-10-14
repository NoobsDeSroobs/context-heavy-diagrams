import { showAlert } from './alerts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { SaveAbortedError, isSaveAborted } from './saveAborted'
import {
  adoptDisk,
  anyNoteDirty,
  dirtyBaselines,
  dirtyDrafts,
  editNote,
  HUB_KEY,
  loadedNoteShadow,
  markSaved,
  newNoteShadow,
  planSave,
  recoveredNoteShadow,
  resolveConflicts,
  restoredNoteShadow,
  type NoteBaseline,
  type NoteShadow,
  type PlanNoteInput,
  type RecoverySnapshot,
  type SavedNote,
  type SaveDocumentRequest,
  type SaveOutcome,
  type Stamp
} from '@shared/documentSave'
import { derivedDetailsPath } from '@shared/detailPaths'
import { askConflictResolution, type ConflictItem } from './conflictDialog'
import ConflictDialog from './components/ConflictDialog'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  ConnectionMode,
  SelectionMode,
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
  type OnConnectStartParams
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  createEmptyDiagram,
  type AggregateMethod,
  type CombineMethod,
  type ConnectionPoint,
  type ConnectionPointSide,
  type DiagramFile,
  type DiagramSecurity,
  type EdgeDirection,
  type EdgeDirectionSet,
  type EdgeDirectionSetStyle,
  type EdgeStyle,
  type GravityPreset,
  type HighlightDefinition,
  type IconRef,
  type IconSlot,
  type JsonValue,
  type LegendEntry,
  type LinePoint,
  type MetadataEntry,
  type NodeStyle,
  type RequiredTagDefinition,
  type RiskCell
} from '@shared/diagram'
import type { SecurityCrawlResult } from '@shared/threatMatrixMath'
import { diffDiagrams, summarizeChanges, type ChangesSinceSave } from '@shared/changesSinceSave'
import EntityNode, { ENTITY_MIN_WIDTH, ENTITY_MIN_HEIGHT } from './nodes/EntityNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from './nodes/TextNode'
import ContainerNode, { CONTAINER_MIN_WIDTH, CONTAINER_MIN_HEIGHT } from './nodes/ContainerNode'
import { scaleGroupMembers, type GroupResizeMember } from './groupResize'
import AnchorNode, { ANCHOR_SIZE } from './nodes/AnchorNode'
import LineNode, { LINE_BOUNDS_PADDING } from './nodes/LineNode'
import DiagramSettingsPanel from './components/DiagramSettingsPanel'
import { effectiveGravityPresets } from './lineGravityPresets'
import LabeledEdge from './edges/LabeledEdge'
import {
  highlightGroupSourceValues,
  highlightId,
  matchingHighlights,
  reconcileHighlightGroup
} from './highlights'
import EdgeMarkerDefs from './edges/edgeMarkers'
import { markerUrl } from './edges/markerIds'
import DiagramContext, { type DiagramContextValue } from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu'
import IconPicker from './components/IconPicker'
import IconBrowser from './components/IconBrowser'
import ColorPickerPopup from './components/ColorPickerPopup'
import StylePicker from './components/StylePicker'
import DetailsPanel from './components/DetailsPanel'
import DiagnosticsPanel, { type MissingFileEntry } from './components/DiagnosticsPanel'
import ChangesPanel, { type DetailsChangedEntry } from './components/ChangesPanel'
import HighlightsPanel from './components/HighlightsPanel'
import SearchOverlay from './components/SearchOverlay'
import {
  criteriaFromQuery,
  elementMatchesCriteria,
  elementMatchesWithDetails,
  hasSearchCriteria,
  parseSearchQuery,
  searchableFromData,
  type SearchCriteria
} from './search'
import LegendPanel from './components/LegendPanel'
import MenuBar, { type MenuBarMenu, type MenuBarItem } from './components/MenuBar'
import LayerPanel from './components/LayerPanel'
import {
  CONTAINER_BASE,
  ENTITY_BASE,
  TEXT_BASE,
  backfillZIndex,
  nextZIndexAbove,
  reorderZIndex
} from './layers/zIndexOrdering'
import {
  connectionPointAtOrdinal,
  effectiveConnectionPoints,
  pointOrdinal,
  reassignConnectionPointHandles,
  setSideCustomPointCount
} from './nodes/connectionPoints'
import { nearestSegmentIndex, type PathPoint } from './geometry/bendablePath'
import { nearestWaypointGap } from './geometry/orthogonalPath'
import {
  activeDirectionSetStyle,
  addDirectionSetFrom,
  DEFAULT_DIRECTION_SET_LEGEND_COLOR,
  directionSetLegendRow,
  ensureDirectionSets,
  migrateDirectionSetStyle,
  refreshActiveDirectionSet,
  removeDirectionSetKey,
  reverseEdgeDirection,
  stripDirectionSets,
  switchActiveDirectionSet
} from './edges/edgeDirectionSets'
import { absolutePosition, subtractPosition } from './geometry/nodePosition'
import MultiConnectionLine from './edges/MultiConnectionLine'
import PreferencesPanel from './components/PreferencesPanel'
import AlignDistributePanel from './components/AlignDistributePanel'
import AboutDialog from './components/AboutDialog'
import ShortcutsDialog from './components/ShortcutsDialog'
import CommandPalette from './components/CommandPalette'
import { buildPaletteActions, type ExtraPaletteAction } from './paletteActions'
import { acceleratorFor, findKeyCommand, type CommandId } from './commands'
import {
  applyBrushToEdgeData,
  applyBrushToNodeData,
  brushAppliesToNode,
  captureEdgeBrush,
  captureNodeBrush,
  type StyleBrush
} from './styleBrush'
import AlertDialog from './components/AlertDialog'
import ExportPngDialog, { type PngExportChoice } from './components/ExportPngDialog'
import BulkCreateDialog from './components/BulkCreateDialog'
import StylePalettePanel from './components/StylePalettePanel'
import ReferenceWindow from './components/ReferenceWindow'
import ReferencesPanel from './components/ReferencesPanel'
import DiagramDock from './panels/DiagramDock'
import { PALETTE_ITEM_DRAG_TYPE, type PaletteItemType } from './panels/ItemPalette'
import UtilityDock from './panels/UtilityDock'
import AlignmentGuides from './components/AlignmentGuides'
import { SNAP_THRESHOLD_PX, boundsFrom, computeSnap } from './alignment'
import { buildClipboardPayload, parseClipboardPayload, remapForPaste } from './clipboard'
import type { TransformPatch } from './panels/PropertyPanel'
import { useTheme } from './theme'
import { useEventCallback } from './hooks/useEventCallback'
import { useModifierDragDuplicate } from './hooks/useModifierDragDuplicate'
import { useDetailsPeek } from './hooks/useDetailsPeek'
import PeekCard from './components/PeekCard'
import { effectiveStylePalette, usePreferences } from './preferences'
import {
  captureDiagramPng,
  resolveEffectiveBackgroundColor,
  rgbStringToHex
} from './export/exportPng'
import { buildExportLegendItems } from './export/exportLegendItems'
import ThreatMatrixView from './security/ThreatMatrixView'
import { themeAdaptiveColor } from './styles/themeAdaptiveColor'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts.
const nodeTypes = {
  entity: EntityNode,
  text: TextNode,
  container: ContainerNode,
  anchor: AnchorNode,
  line: LineNode
}
const edgeTypes = { labeled: LabeledEdge }

// Static — module scope so React Flow gets a stable reference, same reason
// as nodeTypes/edgeTypes above. EdgeWrapper (@xyflow/react) reads this via
// its own separate, unguarded useStore(s => s.defaultEdgeOptions) call —
// no shallow/custom equality — so a fresh object literal here on every
// render (this was previously written inline on <ReactFlow>) forces *every*
// edge to re-render on *every* render of this component, regardless of
// whether any edge or node data actually changed.
//
// markerEnd used to be React Flow's own { type: MarkerType.ArrowClosed } —
// RF generates its own marker def for that, colored via a `defaultColor`
// prop this app never set, so it silently stayed RF's stock `#b1b1b7`
// forever, independent of the edge line's own default color (base.css's
// --xy-edge-stroke-default override, see known-issues.md's "Default edge
// stroke... unreadable" entry) — the two only looked consistent by
// coincidence on the dark canvas, and washed out ("invisible") against a
// light PNG export background. A raw 'url(#id)' string here (same form
// LabeledEdge's own computedMarkerEnd already uses for a styled edge's
// endMarker) points every default, unstyled edge at this app's own
// context-stroke marker (edgeMarkers.tsx) instead — RF passes a string
// straight through with no def of its own generated (createMarkerIds only
// acts on an object marker), and the arrowhead then always inherits
// whatever color the edge itself actually draws in, live or exported, so
// the two can't drift apart again.
const DEFAULT_EDGE_OPTIONS = {
  type: 'labeled',
  markerEnd: markerUrl('arrowClosed')
}

// A 'line' node's own rectangular bounding box is frequently much larger
// than its actual (possibly concave, e.g. a U-bend) curve — see ADR 0050's
// addendum. React Flow applies `style` straight onto its own node wrapper,
// so pointerEvents: 'none' here makes the *whole box* click/drag-through by
// default; LineNode.tsx's invisible hit-stroke path and its own point
// handles each explicitly re-enable pointer events (CSS pointer-events is
// inherited but overridable per descendant), so only the curve itself and
// its points stay interactive — matching how an edge only responds near
// its own path, not its own bounding rectangle.
function needsLineStyleFix(n: Node): boolean {
  return n.type === 'line' && (n.style as React.CSSProperties | undefined)?.pointerEvents !== 'none'
}

// Locked (data.locked, see docs/file-format.md) maps onto React Flow's own
// native draggable/deletable per-node overrides; zIndex (ADR 0035)
// likewise onto React Flow's own field — selectable is deliberately
// left alone (still true), since the whole point of `locked` was blocking
// accidental drags/deletes while keeping selection/highlighting working
// normally.
//
// Pure — returns `n` itself, unchanged, when every derived field already
// matches (the common case), or a new object only when something actually
// needs to change. That "return the same reference when nothing changed"
// property is what CanvasInner's own materializing effect (see its call
// site) relies on to keep an unrelated node's object identity stable
// across renders — see that effect's own comment for why that stability
// specifically matters on a large diagram.
function deriveNodeFields(n: Node): Node {
  const zIndex = (n.data?.zIndex as number | undefined) ?? 0
  const draggable = n.data?.locked !== true
  const deletable = n.data?.locked !== true
  if (
    n.zIndex === zIndex &&
    n.draggable === draggable &&
    n.deletable === deletable &&
    !needsLineStyleFix(n)
  ) {
    return n
  }
  return {
    ...n,
    zIndex,
    draggable,
    deletable,
    ...(needsLineStyleFix(n) ? { style: { ...n.style, pointerEvents: 'none' as const } } : {})
  }
}

// An edge's own zIndex isn't derivable from the edge alone — it depends on
// its endpoints' current zIndex (see zIndexOrdering's SELECTED_EDGE_Z_BOOST
// comment) — so unlike deriveNodeFields this takes the already-resolved
// value as a plain param rather than recomputing it itself. Same "return
// `e` itself when nothing changed" contract otherwise. (Hover used to be
// materialized here too; it's per-edge local state in LabeledEdge now —
// ADR 0073.)
function deriveEdgeFields(e: Edge, zIndex: number): Edge {
  if (e.zIndex === zIndex) return e
  return { ...e, zIndex }
}

// A sequential per-session counter (entity-1, entity-2, ...) collided with
// ids already used in a *loaded* file, since a fresh session always starts
// back at 1 — opening a diagram that already had "entity-1" and adding
// another entity silently overwrote it. A random UUID suffix makes that
// whole class of collision structurally impossible (no cross-session
// coordination needed) rather than something to patch around on every load
// path. Keeps the readable type prefix — this project's file format is
// meant to stay git-diff-friendly and human-debuggable, and "entity-<uuid>"
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
function isVoidDrop(
  event: MouseEvent | TouchEvent,
  connectionState: FinalConnectionState
): boolean {
  if (connectionState.isValid) return false
  const target = event.target
  return target instanceof Element && target.classList.contains('react-flow__pane')
}

// MouseEvent and TouchEvent expose the release coordinates differently.
function pointFromEvent(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  return 'changedTouches' in event ? event.changedTouches[0] : event
}

// Outward from a bound endpoint's own side — matches LabeledEdge.tsx's own
// identically-named table one-for-one (small local copy, not shared —
// that file's own comment on OUTWARD_DIRECTION explains why), keyed here
// by this schema's ConnectionPointSide strings instead of React Flow's
// Position enum, since this is only ever used against the app's own
// connectionPoints data, not React Flow's resolved edge props.
const SIDE_OUTWARD_DIRECTION: Record<ConnectionPointSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
}

// An edge endpoint's resolved absolute position and outward direction —
// used only by "Add point here" below to find the nearest segment on the
// same curve the edge actually renders with (ADR 0057). React Flow
// resolves this internally for rendering, but doesn't expose it as a
// plain computable function, so it's derived directly from the same
// side+offset data ConnectionHandles itself renders from
// (connectionPoints.ts).
function resolveEndpointPosition(
  nodeId: string,
  handleId: string | null | undefined,
  nodeById: Map<string, Node>
): PathPoint {
  const node = nodeById.get(nodeId)
  if (!node) return { x: 0, y: 0 }
  const abs = absolutePosition(node, nodeById)
  const width = node.width ?? 0
  const height = node.height ?? 0
  const customPoints = (node.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
  const point = handleId
    ? effectiveConnectionPoints(customPoints).find((p) => p.id === handleId)
    : undefined
  const side = point?.side ?? 'left'
  const offset = point?.offset ?? 0.5
  const direction = SIDE_OUTWARD_DIRECTION[side]
  switch (side) {
    case 'top':
      return { x: abs.x + offset * width, y: abs.y, direction }
    case 'bottom':
      return { x: abs.x + offset * width, y: abs.y + height, direction }
    case 'right':
      return { x: abs.x + width, y: abs.y + offset * height, direction }
    case 'left':
    default:
      return { x: abs.x, y: abs.y + offset * height, direction }
  }
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

// Load-time repair of a corrupt container hierarchy (ADR 0075). Runs once per
// load, before the nodes reach React Flow — an in-session edit can't produce
// either of these states (every parentId write is guarded). Silent, but each
// class of repair returns a note for the Diagnostics panel. `.chd` unchanged;
// the file self-heals on the next save.
//  - dangling parentId (points at a node not in the file): dropped. The
//    position numbers are kept and reinterpreted as absolute — the real
//    parent is gone, nothing better is recoverable.
//  - parent cycle: the link at the cycle's entry node is cut.
function healHierarchy(nodes: Node[]): { nodes: Node[]; notes: string[] } {
  const stripParentId = (n: Node): Node => {
    const copy = { ...n }
    delete copy.parentId
    return copy
  }
  const ids = new Set(nodes.map((n) => n.id))
  let danglingCount = 0
  let healed = nodes.map((n) => {
    if (n.parentId && !ids.has(n.parentId)) {
      danglingCount += 1
      return stripParentId(n)
    }
    return n
  })

  let cycleCount = 0
  for (;;) {
    const byId = new Map(healed.map((n) => [n.id, n]))
    let entry: string | null = null
    for (const n of healed) {
      const seen = new Set<string>()
      let cur: string | undefined = n.id
      while (cur) {
        if (seen.has(cur)) {
          entry = cur
          break
        }
        seen.add(cur)
        cur = byId.get(cur)?.parentId
      }
      if (entry) break
    }
    if (!entry) break
    healed = healed.map((n) => (n.id === entry ? stripParentId(n) : n))
    cycleCount += 1
  }

  const notes: string[] = []
  if (danglingCount > 0) {
    notes.push(
      `Removed ${danglingCount} node reference${danglingCount === 1 ? '' : 's'} to a container that isn't in this file.`
    )
  }
  if (cycleCount > 0) {
    notes.push(
      `Broke ${cycleCount} circular container nesting relationship${cycleCount === 1 ? '' : 's'}.`
    )
  }
  return { nodes: healed, notes }
}

// Adapter between React Flow's Node shape (zIndex lives in data.zIndex) and
// zIndexOrdering.ts's plain, React-Flow-agnostic ZIndexed shape — see
// ADR 0035. Only touches nodes that actually needed a value; a fully
// backfilled array is returned as-is (same node references, no new objects)
// so this is a safe no-op to call on every load.
function applyZIndexBackfill(nodes: Node[]): Node[] {
  const extracted = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    zIndex: n.data?.zIndex as number | undefined
  }))
  const backfilled = backfillZIndex(extracted)
  if (backfilled === extracted) return nodes
  return nodes.map((n, i) =>
    backfilled[i].zIndex === n.data?.zIndex
      ? n
      : { ...n, data: { ...n.data, zIndex: backfilled[i].zIndex } }
  )
}

// Same data.zIndex extraction as applyZIndexBackfill, for a freshly-created
// node — see ADR 0035. Always scopes "above everything" to just
// that node's own type/tier (CONTAINER_BASE/ENTITY_BASE/TEXT_BASE), so a
// brand new node lands solidly within its tier — behind existing entities if
// it's a container, above existing entities if it's text, etc. — matching
// the backfilled default arrangement, rather than jumping in front of (or
// behind) nodes of a different tier just because it's new. An earlier
// version scoped entities/text to *every* node regardless of type with no
// tier floor at all, so a fresh diagram's first entity/container landed at
// 10 or 20 instead of its intended tier — caught by the user directly, see
// docs/known-issues.md.
function nextZIndex(nodes: Node[], type: 'entity' | 'text' | 'container' | 'line'): number {
  const base = type === 'container' ? CONTAINER_BASE : type === 'text' ? TEXT_BASE : ENTITY_BASE
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

// Undo/redo — see ADR 0018. Deliberately just {nodes, edges}, not
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

// Only entity/container nodes and edges meaningfully carry metadata — see
// ADR 0022. Kept as a helper since both toDiagramFile and the metadata-only
// node type guard elsewhere need the same "does this node type qualify"
// check.
function nodeMetadataEligible(type: string | undefined): boolean {
  return type === 'entity' || type === 'container'
}

// Only these three types render ConnectionHandles (see EntityNode/
// ContainerNode/AnchorNode) — 'text' and 'line' have no handles at all, so
// a selected one of either can never legitimately be an edge endpoint.
// Used by multi-connection onConnect below to skip a selected node that
// happens not to be connectable, rather than trying to resolve a
// connection point that doesn't exist on it.
function isConnectableNodeType(type: string | undefined): boolean {
  return type === 'entity' || type === 'container' || type === 'anchor'
}

// DetailsPanel's own header — the element's current label (first line only,
// same convention as the on-disk detail filename), falling back to that
// file's own name for a blank-labeled element. Lets the user tell which
// element's details they're looking at without having to check the canvas
// selection, especially when navigating between several in a row.
function detailsPanelTitle(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  if (label) return label
  const path = typeof node?.data?.details === 'string' ? node.data.details : undefined
  return path ? (path.split(/[/\\]/).pop() ?? path) : 'Untitled'
}

// Names the note in the toolbar's "changed outside the app" notice: the
// element's label (first line), else "This note".
function detailsNoteName(node: Node | undefined): string {
  const label = typeof node?.data?.label === 'string' ? node.data.label.split('\n')[0].trim() : ''
  return label ? `Note "${label}"` : 'This note'
}

// Notes restored from a crash-recovery snapshot become dirty shadows. With their
// recorded baseline the disk check still works (an outside edit made before the
// crash is still caught on Save); snapshots from older builds have none.
function shadowsFromSnapshot(snapshot: RecoverySnapshot): Record<string, NoteShadow> {
  const out: Record<string, NoteShadow> = {}
  for (const [id, content] of Object.entries(snapshot.detailsDrafts)) {
    const baseline = snapshot.noteBaselines?.[id]
    if (baseline) {
      out[id] = restoredNoteShadow(id, content, baseline)
    } else {
      const details = snapshot.diagram.nodes.find((n) => n.id === id)?.data?.details
      out[id] = recoveredNoteShadow(id, typeof details === 'string' ? details : null, content)
    }
  }
  return out
}

function toDiagramFile(
  nodes: Node[],
  edges: Edge[],
  metadata: Record<string, JsonValue>,
  requiredTags: RequiredTagDefinition[],
  highlights: HighlightDefinition[],
  legend: LegendEntry[],
  gravityPresets: GravityPreset[],
  maxConnectionPointsPerSide: number | undefined,
  edgeDirectionSets: EdgeDirectionSet[],
  activeEdgeDirectionSetId: string | undefined,
  security: DiagramSecurity
): DiagramFile {
  // Edge direction sets (ADR 0081): on disk, every edge is stored in the
  // *base* (first) set's orientation regardless of which set is active, so
  // switching the displayed reading never churns the edges in git. Refresh
  // the active set's per-edge records from the live fields, then — if a
  // non-base set is active — re-express the edges in base orientation for
  // serialization.
  let outEdges = edges
  if (edgeDirectionSets.length >= 2) {
    const setIds = edgeDirectionSets.map((s) => s.id)
    const baseId = edgeDirectionSets[0].id
    const activeId = activeEdgeDirectionSetId ?? baseId
    outEdges =
      activeId === baseId
        ? refreshActiveDirectionSet(edges, setIds, baseId)
        : switchActiveDirectionSet(
            edges,
            setIds,
            activeId,
            baseId,
            new Map(nodes.map((n) => [n.id, n]))
          )
  }
  return {
    version: 1,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    legend: legend.length > 0 ? legend : undefined,
    gravityPresets: gravityPresets.length > 0 ? gravityPresets : undefined,
    maxConnectionPointsPerSide,
    // serializeDiagram drops these below 2 sets — pass them through as-is.
    edgeDirectionSets: edgeDirectionSets.length > 0 ? edgeDirectionSets : undefined,
    activeEdgeDirectionSetId,
    // serializeDiagram drops this when it carries nothing.
    security:
      security.threats.length > 0 || security.matrixEntityIds.length > 0 ? security : undefined,
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
          typeof n.data?.linkedDiagram === 'string' ? (n.data.linkedDiagram as string) : undefined,
        points: Array.isArray(n.data?.points) ? (n.data.points as LinePoint[]) : undefined,
        references:
          Array.isArray(n.data?.references) && (n.data.references as string[]).length > 0
            ? (n.data.references as string[])
            : undefined,
        security:
          n.type === 'entity' && n.data?.security && typeof n.data.security === 'object'
            ? (n.data.security as Record<string, RiskCell>)
            : undefined
      }
    })),
    edges: outEdges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: typeof e.data?.label === 'string' && e.data.label ? e.data.label : undefined,
      style: e.data?.style as EdgeStyle | undefined,
      metadata: e.data?.metadata as Record<string, MetadataEntry> | undefined,
      points:
        Array.isArray(e.data?.points) && (e.data.points as LinePoint[]).length > 0
          ? (e.data.points as LinePoint[])
          : undefined,
      directionSets: e.data?.directionSets as Record<string, EdgeDirection> | undefined
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
  gravityPresets: GravityPreset[]
  maxConnectionPointsPerSide: number | undefined
  edgeDirectionSets: EdgeDirectionSet[]
  activeEdgeDirectionSetId: string | undefined
  security: DiagramSecurity
  hierarchyNotes: string[]
} {
  // healHierarchy repairs a dangling/cyclic parentId before the nodes reach
  // React Flow (ADR 0075); sortNodesForHierarchy then defensively re-orders in
  // case an external writer didn't honor the parent-before-child requirement
  // (see docs/file-format.md's parentId entry). applyZIndexBackfill runs on
  // that *final* order, not the raw file order, so "array position" means the
  // same thing it does for today's actual rendering — see ADR 0035.
  const healed = healHierarchy(
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
        ...(n.data.points && n.data.points.length > 0 ? { points: n.data.points } : {}),
        ...(Array.isArray(n.data.references) && n.data.references.length > 0
          ? { references: n.data.references }
          : {}),
        ...(n.type === 'entity' && n.data.security && Object.keys(n.data.security).length > 0
          ? { security: n.data.security }
          : {}),
        ...(n.style ? { style: n.style } : {}),
        ...(n.metadata && nodeMetadataEligible(n.type) ? { metadata: n.metadata } : {})
      }
    }))
  )
  const finalNodes = applyZIndexBackfill(sortNodesForHierarchy(healed.nodes))

  // Edge direction sets (ADR 0081). The file's edges are in base ([0])
  // orientation with per-set records in `directionSets`. Seed any missing
  // record from the live (base) fields, then — if a non-base set is the
  // saved active one — re-express the live edges in that set's orientation.
  // migrateDirectionSetStyle: pre-ADR-0083 `legend` -> `style` (ADR 0083).
  const directionSets = (diagram.edgeDirectionSets ?? []).map(migrateDirectionSetStyle)
  let edges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    // Conditional, not `type: e.type` — an *explicit* `type: undefined` on
    // the edge object (as opposed to the key being absent) survives into
    // React Flow's own `{ ...defaultEdgeOptions, ...edge }` merge
    // (EdgeWrapper, @xyflow/react) and overwrites `defaultEdgeOptions.type`
    // right back to `undefined`, silently routing the edge to RF's built-in
    // default component instead of this app's `LabeledEdge` — no error, but
    // none of LabeledEdge's own logic (style, highlights, custom routing)
    // ever runs. Found 2026-09-05 on a hand-authored file that (correctly,
    // per docs/file-format.md's own "absent means default" rule) omitted
    // `type` on every edge.
    ...(e.type ? { type: e.type } : {}),
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    data: {
      label: e.label ?? '',
      ...(e.style ? { style: e.style } : {}),
      ...(e.metadata ? { metadata: e.metadata } : {}),
      ...(e.points && e.points.length > 0 ? { points: e.points } : {}),
      ...(e.directionSets && Object.keys(e.directionSets).length > 0
        ? { directionSets: e.directionSets }
        : {})
    }
  }))
  let activeEdgeDirectionSetId: string | undefined
  if (directionSets.length >= 1) {
    const setIds = directionSets.map((s) => s.id)
    const baseId = setIds[0]
    activeEdgeDirectionSetId =
      diagram.activeEdgeDirectionSetId && setIds.includes(diagram.activeEdgeDirectionSetId)
        ? diagram.activeEdgeDirectionSetId
        : baseId
    // Per-edge records + base-orientation only matter at 2+ sets.
    if (directionSets.length >= 2) {
      edges = ensureDirectionSets(edges, setIds)
      if (activeEdgeDirectionSetId !== baseId) {
        edges = switchActiveDirectionSet(
          edges,
          setIds,
          baseId,
          activeEdgeDirectionSetId,
          new Map(finalNodes.map((n) => [n.id, n]))
        )
      }
    }
  }

  // Security model (ADR 0082) — prune references that no longer resolve
  // (entity deleted from the canvas) and strip orphan per-entity cells
  // (threat since removed from the catalog, or entity no longer a matrix
  // member — e.g. resurrected by an undo across a remove). One Diagnostics
  // note if anything changed. Same self-cleaning stance as recentDiagrams.
  const securityNotes: string[] = []
  let security: DiagramSecurity = { threats: [], matrixEntityIds: [] }
  let securedNodes = finalNodes
  const src = diagram.security
  if (src && (src.threats.length > 0 || src.matrixEntityIds.length > 0)) {
    const entityIds = new Set(finalNodes.filter((n) => n.type === 'entity').map((n) => n.id))
    const threatIds = new Set(src.threats.map((t) => t.id))
    const matrixEntityIds = src.matrixEntityIds.filter((id) => entityIds.has(id))
    const matrixSet = new Set(matrixEntityIds)
    const droppedEntities = src.matrixEntityIds.length - matrixEntityIds.length
    security = {
      threats: src.threats,
      hiddenThreatIds: src.hiddenThreatIds?.filter((id) => threatIds.has(id)),
      matrixEntityIds,
      hiddenEntityIds: src.hiddenEntityIds?.filter((id) => matrixSet.has(id)),
      probabilityScale: src.probabilityScale,
      consequenceScale: src.consequenceScale
      // combineMethod / aggregateMethod: session-only, ignored on read (ADR 0088)
    }
    let droppedCells = 0
    securedNodes = finalNodes.map((n) => {
      const cells = n.data?.security as Record<string, RiskCell> | undefined
      if (!cells) return n
      const keep =
        n.type === 'entity' && matrixSet.has(n.id)
          ? Object.fromEntries(Object.entries(cells).filter(([tid]) => threatIds.has(tid)))
          : {}
      const removed = Object.keys(cells).length - Object.keys(keep).length
      if (removed === 0) return n
      droppedCells += removed
      const nextData = { ...n.data }
      if (Object.keys(keep).length > 0) nextData.security = keep
      else delete nextData.security
      return { ...n, data: nextData }
    })
    if (droppedEntities > 0) {
      securityNotes.push(
        `Security matrix: ${droppedEntities} entity reference(s) dropped — the entity no longer exists.`
      )
    }
    if (droppedCells > 0) {
      securityNotes.push(
        `Security matrix: ${droppedCells} orphan assessment(s) dropped — the threat was removed, or the entity isn't in the matrix.`
      )
    }
  }

  return {
    highlights: diagram.highlights ?? [],
    legend: diagram.legend ?? [],
    gravityPresets: diagram.gravityPresets ?? [],
    maxConnectionPointsPerSide: diagram.maxConnectionPointsPerSide,
    edgeDirectionSets: directionSets.length >= 1 ? directionSets : [],
    activeEdgeDirectionSetId,
    security,
    hierarchyNotes: [...healed.notes, ...securityNotes],
    nodes: securedNodes,
    edges,
    metadata: diagram.metadata ?? {},
    requiredTags: diagram.requiredTags ?? []
  }
}

// Fresh metadata for a brand-new Entity/Container/Edge — every requiredTags
// entry, seeded at its own defaultValue/lock. No diagnostics involved (a
// new element has nothing to "reset"); that only applies to syncElementMetadata
// below, which reconciles *existing* elements against a changed template.
// A not-yet-named tag (addTag() seeds a blank key, not a placeholder — see
// its own comment) is skipped: nothing to seed under an empty key.
function seedMetadata(
  requiredTags: RequiredTagDefinition[]
): Record<string, MetadataEntry> | undefined {
  const result: Record<string, MetadataEntry> = {}
  for (const def of requiredTags) {
    if (!def.key) continue
    result[def.key] = { value: def.defaultValue ?? null, lock: def.lock }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function isValidForTag(value: JsonValue, def: RequiredTagDefinition): boolean {
  // null is always valid, regardless of allowedValues — the implicit
  // "None" value every required tag carries (see ADR 0046), without
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
//
// A not-yet-named tag (blank key — see addTag()'s own comment) is skipped
// entirely here, both as a def to reconcile against and as a member of
// requiredKeys: nothing was ever stamped under an empty key, so there's
// nothing to reconcile or demote for it either.
function syncElementMetadata(
  metadata: Record<string, MetadataEntry> | undefined,
  requiredTags: RequiredTagDefinition[],
  elementLabel: string,
  diagnostics: string[]
): Record<string, MetadataEntry> | undefined {
  const next: Record<string, MetadataEntry> = { ...metadata }
  const namedTags = requiredTags.filter((def) => def.key)
  const requiredKeys = new Set(namedTags.map((def) => def.key))

  for (const def of namedTags) {
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
      diagnostics.push(
        `${elementLabel}.${def.key} is now required; previous free value moved to "${affixed}".`
      )
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

// Every on-disk resource path referenced by a diagram element — for the
// Diagnostics "missing files" check (ADR 0084). `resolvedPath` is filled in
// later, after main reports back which paths don't exist.
function collectResourceRefs(
  nodeList: Node[],
  legendList: LegendEntry[]
): Omit<MissingFileEntry, 'resolvedPath'>[] {
  const refs: Omit<MissingFileEntry, 'resolvedPath'>[] = []
  for (const n of nodeList) {
    const ownerLabel = String(n.data?.label ?? '')
    const ownerType = n.type ?? 'entity'
    const base = { ownerKind: 'node' as const, ownerId: n.id, ownerLabel, ownerType }
    const d = n.data ?? {}
    if (typeof d.linkedDiagram === 'string' && d.linkedDiagram) {
      refs.push({ ...base, key: `${n.id}:linkedDiagram`, resourceKind: 'linkedDiagram', relativePath: d.linkedDiagram })
    }
    if (typeof d.details === 'string' && d.details) {
      refs.push({ ...base, key: `${n.id}:details`, resourceKind: 'details', relativePath: d.details })
    }
    const icons = d.icons as Partial<Record<IconSlot, IconRef>> | undefined
    for (const [slot, ref] of Object.entries(icons ?? {})) {
      if (ref?.source === 'custom' && typeof ref.path === 'string') {
        refs.push({ ...base, key: `${n.id}:icon:${slot}`, resourceKind: 'icon', relativePath: ref.path, iconSlot: slot })
      }
    }
    const references = Array.isArray(d.references) ? (d.references as string[]) : []
    references.forEach((p, i) => {
      if (typeof p === 'string' && p) {
        refs.push({ ...base, key: `${n.id}:reference:${i}`, resourceKind: 'reference', relativePath: p })
      }
    })
  }
  for (const e of legendList) {
    if (e.kind === 'icon' && e.icon?.source === 'custom' && typeof e.icon.path === 'string') {
      refs.push({
        key: `legend:${e.id}`,
        ownerKind: 'legend',
        ownerId: e.id,
        ownerLabel: e.label,
        ownerType: 'legend',
        resourceKind: 'icon',
        relativePath: e.icon.path
      })
    }
  }
  return refs
}

// Apply one staged missing-file removal (ADR 0084) to a nodes+legend pair —
// the same mutation each element's own UI does. Pure; used at save time
// (persistDiagram), so a staged removal only ever reaches disk on save.
function applyMissingFileRemoval(
  nodes: Node[],
  legend: LegendEntry[],
  entry: MissingFileEntry
): { nodes: Node[]; legend: LegendEntry[] } {
  if (entry.ownerKind === 'legend') {
    return { nodes, legend: legend.filter((e) => e.id !== entry.ownerId) }
  }
  return {
    legend,
    nodes: nodes.map((n) => {
      if (n.id !== entry.ownerId) return n
      const d: Record<string, unknown> = { ...n.data }
      switch (entry.resourceKind) {
        case 'linkedDiagram':
          d.linkedDiagram = undefined
          break
        case 'details':
          d.details = undefined
          break
        case 'icon': {
          const icons = { ...(d.icons as Partial<Record<IconSlot, IconRef>> | undefined) }
          if (entry.iconSlot) delete icons[entry.iconSlot as IconSlot]
          d.icons = Object.keys(icons).length > 0 ? icons : undefined
          break
        }
        case 'reference': {
          const refs = (Array.isArray(d.references) ? (d.references as string[]) : []).filter(
            (p) => p !== entry.relativePath
          )
          d.references = refs.length > 0 ? refs : undefined
          break
        }
      }
      return { ...n, data: d }
    })
  }
}

function CanvasInner(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  // This window's crash-recovery identity before it's ever been saved —
  // see ADR 0040. Assigned by main at window creation, carried
  // via ?session= the same way ?path= already is; stable for the whole
  // renderer lifetime (unlike currentPath, never reassigned — once a
  // window has a path, recovery keys off that instead, but the session id
  // itself doesn't need to change to make that happen).
  const sessionIdRef = useRef(
    new URLSearchParams(window.location.search).get('session') ?? crypto.randomUUID()
  )
  // Unsaved-changes tracking (see ADR 0040) — set directly at every
  // site that mutates something toDiagramFile() actually serializes, not
  // derived from the undo/redo stack (which only covers nodes/edges, not
  // requiredTags/highlights/legend/noteShadows — see the ADR for why
  // that coupling was rejected). Session-only state (enabledHighlightIds,
  // every panel-open boolean, etc.) never touches this.
  // Dirty state is per file (ADR 0092): the diagram — the "hub" — has its own
  // flag, and each detail note its own inside its shadow. `isDirty` (close
  // prompt, autosave, reload confirms) is simply "any of them".
  const [hubDirty, setHubDirty] = useState(false)
  // In-memory copies ("shadows") of the detail notes that are open or have
  // unsaved edits — content, baseline and dirty flag per note (documentSave.ts).
  // A note nobody has touched has no entry: it is just a file on disk.
  const [noteShadows, setNoteShadows] = useState<Record<string, NoteShadow>>({})
  const isDirty = hubDirty || anyNoteDirty(noteShadows)
  // The latest shadows, readable from callbacks that must not depend on them
  // (a diagram reload needs to know which notes have unsaved edits).
  const noteShadowsRef = useRef(noteShadows)
  useEffect(() => {
    noteShadowsRef.current = noteShadows
  })
  // Reloads the diagram file from disk keeping unsaved note edits — set once
  // loadDiagramIntoCanvas exists (it is declared after persistDiagram).
  const reloadHubRef = useRef<((path: string) => Promise<void>) | null>(null)
  const markDirty = useCallback(() => setHubDirty(true), [])
  // What we last read/wrote of the diagram file — the baseline the window-focus
  // check and the save-time conflict check compare against.
  const hubBaselineRef = useRef<{ path: string | null; stamp: Stamp }>({
    path: null,
    stamp: null
  })
  // Outside-the-app change notice for the diagram file: externalChangeStamp is
  // non-null while the "changed on disk" banner shows; dismissedStampRef
  // remembers which specific change the user ignored so a later focus doesn't
  // re-show it (the save-time check still fires — dismissing never touches the
  // baseline).
  const [externalChangeStamp, setExternalChangeStamp] = useState<string | null>(null)
  const dismissedStampRef = useRef<string | null>(null)
  // What the open Details panel says about an outside change to its note:
  // 'refreshed' = it was unedited, so it was silently re-read from disk;
  // 'conflict' = the note has unsaved edits AND the file changed. The
  // dismissed map remembers the stamp the user chose to ignore, per note.
  const [detailsNotice, setDetailsNotice] = useState<{
    nodeId: string
    kind: 'refreshed' | 'conflict'
  } | null>(null)
  const detailsDismissedStampRef = useRef<Record<string, string>>({})
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
  // Diagram-level metadata/requiredTags (ADR 0022) — analogous to
  // currentPath: file-scoped state with no React Flow home of its own,
  // reset on every load, carried into every save via toDiagramFile.
  const [diagramMetadata, setDiagramMetadata] = useState<Record<string, JsonValue>>({})
  const [requiredTags, setRequiredTags] = useState<RequiredTagDefinition[]>([])
  // Highlight catalog (ADR 0025) — persisted, same file-scoped
  // treatment as diagramMetadata/requiredTags above. Which highlights are
  // currently *enabled* is a separate, deliberately volatile Set below —
  // reset on every load, never included in toDiagramFile's payload.
  const [highlights, setHighlights] = useState<HighlightDefinition[]>([])
  const [enabledHighlightIds, setEnabledHighlightIds] = useState<Set<string>>(new Set())
  // Legend catalog (ADR 0033) — same file-scoped, persisted
  // treatment as highlights above. Unlike highlights, there's no per-entry
  // enabled state; the whole panel's shown/hidden state below is what's
  // session-local instead.
  const [legend, setLegend] = useState<LegendEntry[]>([])
  const [legendPanelOpen, setLegendPanelOpen] = useState(false)
  // Line bend preset catalog (ADR 0050) — same file-scoped,
  // persisted treatment as highlights/legend above. Raw/possibly-empty;
  // effectiveGravityPresets resolves "empty" to this app's own built-in
  // four wherever it's actually consumed (DiagramContext's own value below).
  const [gravityPresets, setGravityPresets] = useState<GravityPreset[]>([])
  // Diagram-level override for max connection points per side (ADR 0067;
  // ADR 0052) — undefined means "not overridden," same file-scoped/reset-
  // on-load treatment as gravityPresets above.
  const [diagramMaxConnectionPointsPerSide, setDiagramMaxConnectionPointsPerSide] = useState<
    number | undefined
  >(undefined)
  // Flippable edge direction sets (ADR 0081) — same file-scoped/reset-on-
  // load treatment as gravityPresets above. `[]` (or a single set) means
  // the feature is dormant: an edge's direction is just its own
  // source/target/handles. When >= 2 sets exist, [0] is the "base" set the
  // edges are stored in on disk, and `activeEdgeDirectionSetId` picks which
  // reading the live edges currently show.
  const [edgeDirectionSets, setEdgeDirectionSets] = useState<EdgeDirectionSet[]>([])
  const [activeEdgeDirectionSetId, setActiveEdgeDirectionSetId] = useState<string | undefined>(
    undefined
  )
  // Threat/risk model (ADR 0082) — same file-scoped / reset-on-load
  // treatment as the catalogs above. Kept as a non-null object with empty
  // arrays when the Security Matrix has never been used; serialization
  // drops it when empty. Per-element assessment cells live on
  // node.data.security, not here.
  const [security, setSecurity] = useState<DiagramSecurity>({ threats: [], matrixEntityIds: [] })
  // Matrix calculation modes are session-only, not persisted (ADR 0088) —
  // deliberately NOT reset on file open, so they behave as a property of
  // the active matrix view and flow uniformly down a linked-diagram tree.
  const [securityCombineMethod, setSecurityCombineMethod] = useState<CombineMethod>('multiply')
  const [securityAggregateMethod, setSecurityAggregateMethod] =
    useState<AggregateMethod>('average')
  const [diagramSettingsPanelOpen, setDiagramSettingsPanelOpen] = useState(false)
  // Anchors the floating panel next to whichever <ControlButton> opened it —
  // same convention as iconPicker/colorPicker/linePicker's own anchorRect.
  const [legendPanelAnchor, setLegendPanelAnchor] = useState<DOMRect | null>(null)
  // Layer panel (ADR 0035) — same UtilityDock family as
  // Highlights/Required tags/Diagnostics. No catalog of its own: it reads
  // straight off `nodes`' own zIndex, there's nothing separate to persist.
  const [layerPanelOpen, setLayerPanelOpen] = useState(false)
  // Which node the panel currently points at — an "entity highlight," see
  // DiagramContext's own comment on this field. Session-only, reset on load.
  const [entityHighlightNodeId, setEntityHighlightNodeId] = useState<string | null>(null)
  // Reference images (ADR 0069). `referencesPanelOpen` is the
  // diagram-wide inventory View (same UtilityDock family as Layers).
  // `referenceWindows` is the set of open floating viewer windows — pure
  // session state, one entry per (entity, image path), gone on reload.
  const [referencesPanelOpen, setReferencesPanelOpen] = useState(false)
  const [referenceWindows, setReferenceWindows] = useState<{ nodeId: string; path: string }[]>([])
  // Edge hover (a catmull-rom edge's bend-point handles are hover-revealed,
  // see ADR 0057) is tracked per-edge, locally in LabeledEdge — see ADR
  // 0073. It used to live here as a single hoveredEdgeId, materialized onto
  // edge.data.hovered via a setEdges effect, which rebuilt the whole edges
  // array (and forced React Flow to re-sync its entire edge store) on every
  // hover. LabeledEdge now owns a local useState flag driven by an
  // invisible hit-path it renders itself.
  // Non-blocking notices from the most recent syncElementMetadata pass —
  // deliberately *replaced*, not appended, on every sync: this reflects
  // current state (what the last backfill run had to correct), not a
  // growing history log. A file with nothing to correct clears the list.
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  // Notices from healHierarchy at load time (ADR 0075) — a dangling or cyclic
  // parentId that was silently repaired. Session-only, replaced on every load,
  // kept separate from `diagnostics` so a later required-tags sync doesn't
  // wipe it; combined for display in `displayedDiagnostics`.
  const [hierarchyLoadNotes, setHierarchyLoadNotes] = useState<string[]>([])
  // Elements referencing a file that no longer resolves on disk — a linked
  // diagram, a custom icon, a reference image, a details `.md` (ADR 0084).
  // Refreshed by scanMissingFiles on load and on the Diagnostics "Recheck"
  // button — an async fs check, so it can't be derived during render like
  // the other advisories. Session-only, never persisted.
  //
  // A "Remove" in the panel doesn't mutate anything — it moves the entry
  // into `stagedFileRemovals`, and those are applied (to nodes/legend) only
  // when the diagram is saved, in persistDiagram. `dismissedFileKeys` hides
  // a row for the session ("it's expected right now"). Both reset on the
  // next scan.
  const [missingFiles, setMissingFiles] = useState<MissingFileEntry[]>([])
  const [stagedFileRemovals, setStagedFileRemovals] = useState<MissingFileEntry[]>([])
  const [dismissedFileKeys, setDismissedFileKeys] = useState<Set<string>>(new Set())
  const [diagnosticsPanelOpen, setDiagnosticsPanelOpen] = useState(false)
  // "Changes since last save" (epic 0117, ADR 0102) — v1 scope, nodes/edges
  // only. null means "not computed yet" (opening the panel triggers the
  // async reread), distinct from an empty diff (no changes).
  const [changesPanelOpen, setChangesPanelOpen] = useState(false)
  const [changesDiff, setChangesDiff] = useState<ChangesSinceSave | null>(null)
  const [highlightsPanelOpen, setHighlightsPanelOpen] = useState(false)
  // Floating popup next to Legend's, in the bottom-left <Controls> cluster
  // (fix/highlights-free-tags-and-toggle) — same anchorRect convention as
  // legendPanelAnchor above, no longer the fixed-position UtilityDock shell
  // it used to be.
  const [highlightsPanelAnchor, setHighlightsPanelAnchor] = useState<DOMRect | null>(null)
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false)
  const [stylePalettePanelOpen, setStylePalettePanelOpen] = useState(false)
  const [alignDistributePanelOpen, setAlignDistributePanelOpen] = useState(false)
  // Search overlay (ADR 0062) — Ctrl+F. All session-only, reset
  // on load like every other panel's open/enabled state above. searchRun
  // distinguishes "haven't searched yet" from "searched, zero results";
  // matchOrder is the stable id ordering next/prev cycles through
  // (recomputed each run — nodes first, then edges, insertion order).
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false)
  const [deepSearchLoading, setDeepSearchLoading] = useState(false)
  const [searchRun, setSearchRun] = useState(false)
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string>>(new Set())
  const [searchMatchOrder, setSearchMatchOrder] = useState<string[]>([])
  const [searchMatchCursor, setSearchMatchCursor] = useState(0)
  // Icon-identity search (ADR 0072) — when set, the query is "every node
  // carrying this exact icon" and the free-text box is disabled; the two
  // are deliberately not combined (ADR 0062 defers all criteria-combining
  // to a future query language). searchIconPicker holds the anchor rect of
  // the overlay's icon button while its IconBrowser popup is open.
  const [searchIcon, setSearchIcon] = useState<IconRef | null>(null)
  const [searchIconPicker, setSearchIconPicker] = useState<DOMRect | null>(null)
  // Query-token problems (unknown `has:` value, empty `tag:`) shown in the
  // overlay so a typo isn't silently "no matches" (ADR 0096).
  const searchQueryProblems = useMemo(() => parseSearchQuery(searchQuery).problems, [searchQuery])
  // Linked diagrams that couldn't be read during the last deep search — shown
  // in the overlay so a broken link is never silently "no match" (ADR 0097).
  const [searchUnreadable, setSearchUnreadable] = useState<string[]>([])
  // "Isolate" (ADR 0063) — search-driven only, per the user's
  // own call: a separate explicit toggle next to Search, not folded into
  // running a search itself, so turning it on/off doesn't require
  // re-searching. Always cleared alongside search results (see
  // clearSearchResults below) since it's meaningless without a live match
  // set to isolate down to.
  const [isolateActive, setIsolateActive] = useState(false)
  // Persona switch (see ADR 0055) — akin to FreeCAD's workbench
  // switcher/Affinity's persona tabs: swaps the entire main view, not a
  // split or overlay. Render-only prototype for now (ThreatMatrixView),
  // purely to validate whether a mode swap like this feels right at all —
  // no data flows between personas yet, and diagram state (nodes/edges,
  // panels, etc.) is untouched underneath while 'matrix' is shown, same
  // as switching tabs never destroys the other tab's content.
  const [persona, setPersona] = useState<'diagram' | 'matrix'>('diagram')
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  // Command palette (ADR 0100).
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [exportPngDialogOpen, setExportPngDialogOpen] = useState(false)
  const [exportPngEffectiveColorHex, setExportPngEffectiveColorHex] = useState('#ffffff')
  // See ADR 0089 — right-click on the ItemPalette Entity/Container button.
  const [bulkCreateType, setBulkCreateType] = useState<'entity' | 'container' | null>(null)
  // onlyRenderVisibleElements (ADR 0073) keeps React Flow from mounting
  // off-screen nodes/edges — a large win on big diagrams, but PNG export
  // (handleExportPng) clones the .react-flow__viewport DOM subtree, so
  // every off-screen element would be missing from the capture. Flipped
  // true for the duration of a capture so the whole diagram is in the DOM.
  const [isExportingPng, setIsExportingPng] = useState(false)
  // Toolbar's own "current pen style" swatch (ADR 0045) — reuses
  // StylePicker (ADR 0010) unchanged, same anchorRect convention as
  // linePicker above, just targeting preferences.defaultEdgeStyle instead of
  // one edge's data.style.
  const [defaultEdgeStylePicker, setDefaultEdgeStylePicker] = useState<DOMRect | null>(null)
  // Global app preference, not diagram content — see preferences.ts/ADR 0032.
  // Deliberately not reset by loadDiagramIntoCanvas below; only the panel's
  // open/closed UI state is.
  const { preferences, updatePreferences } = usePreferences()
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const [iconPicker, setIconPicker] = useState<{ nodeId: string; anchorRect: DOMRect } | null>(null)
  // "Fill…"/"Border…" (nodes) and "Line style…" (edges) context-menu
  // popups — see ADR 0010. Two separate pieces of state since they target
  // different element kinds and render different popup components.
  const [colorPicker, setColorPicker] = useState<{
    nodeId: string
    kind: 'fill' | 'border'
    anchorRect: DOMRect
  } | null>(null)
  const [linePicker, setLinePicker] = useState<{ edgeId: string; anchorRect: DOMRect } | null>(null)
  // Drag-time alignment guides (ADR 0019) — flow-space positions of the
  // guide line(s) currently matched, or null when nothing's being dragged/
  // nothing's in snap range. Set from onNodeDrag, cleared on drag stop.
  const [alignmentGuides, setAlignmentGuides] = useState<{ x: number[]; y: number[] } | null>(null)
  const [detailsPanelNodeId, setDetailsPanelNodeId] = useState<string | null>(null)
  // Editing a node's details doesn't write to disk immediately — it's just
  // draft state here, flushed as part of the main save flow.
  const rfInstance = useReactFlow()
  const { peek, bindings: peekBindings } = useDetailsPeek()
  const peekNode = peek ? rfInstance.getNode(peek.nodeId) : undefined
  const updateNodeInternals = useUpdateNodeInternals()
  // Scopes the PNG export (ADR 0051) capture to this window's own
  // .react-flow__viewport rather than a bare document-wide query — no
  // functional difference today (one ReactFlow per window), just avoids
  // relying on that staying true.
  const flowWrapperRef = useRef<HTMLDivElement>(null)

  // Undo/redo history — see ADR 0018. Explicit calls at each real mutation
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

  // Latest nodes/edges, mirrored into a ref (updated from an effect) so
  // callbacks that only need to *read* the current graph — pushSnapshot,
  // undo/redo, openDetailsPanel — can do so without listing nodes/edges in
  // their useCallback deps. Those callbacks are threaded through the
  // memoized DiagramContext value (ADR 0056); when their identity churned
  // on every node/edge change, so did the context value, re-rendering every
  // node and edge on every edit/drag/hover and defeating that memoization
  // (ADR 0073). Reading a ref inside a callback — not during render — is
  // allowed by the react-hooks lint rules; same pattern as useDetailsPeek
  // and openReferencesFor's rfInstance.getNode read.
  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  useEffect(() => {
    graphRef.current = { nodes, edges }
  }, [nodes, edges])

  // Which node/handle a connection drag started from — set in onConnectStart,
  // read (and cleared) in onConnectEnd to spawn a new entity when the drag is
  // released over empty canvas instead of a valid handle. See ADR 0015.
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  // React Flow's own EdgeUpdateAnchors implementation fires BOTH
  // onReconnectStart *and* the generic onConnectStart for the same
  // drag-an-existing-edge's-endpoint gesture (confirmed by reading
  // @xyflow/react's source: its internal `_onConnectStart` composite calls
  // `onReconnectStart?.(...)` immediately before `onConnectStart?.(...)`,
  // synchronously, every time). Without this flag, a reconnect dropped in
  // empty space fired both onConnectEnd (the drag-to-empty-space logic)
  // *and* onReconnectEnd (the reconnection logic) independently, each spawning its own
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
          const label = `${n.type === 'entity' ? 'Entity' : 'Container'} "${String(n.data?.label ?? n.id)}"`
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

  // Missing-file scan for the Diagnostics panel (ADR 0084): collect every
  // on-disk resource a diagram element references — linked diagrams, custom
  // icons, reference images, details files — ask main which don't resolve,
  // and keep those. Takes the node/legend lists + diagram path explicitly
  // so it can run against a freshly-loaded diagram before that state has
  // committed. An unsaved diagram (no path) can't have resolvable
  // references — reports none.
  const missingFileScanRef = useRef(0)
  const scanMissingFiles = useCallback(
    async (nodeList: Node[], legendList: LegendEntry[], diagramPath: string | null) => {
      // Guard against a stale async result stomping a newer scan (load A
      // then quickly reload B in the same window).
      const scanId = ++missingFileScanRef.current
      // A fresh scan supersedes any pending per-row decisions.
      setStagedFileRemovals([])
      setDismissedFileKeys(new Set())
      const refs = collectResourceRefs(nodeList, legendList)
      if (!diagramPath || refs.length === 0) {
        setMissingFiles([])
        return
      }
      const uniquePaths = [...new Set(refs.map((r) => r.relativePath))]
      let results: { relativePath: string; resolvedPath: string; found: boolean }[]
      try {
        results = await window.api.checkResourceFiles(diagramPath, uniquePaths)
      } catch {
        return
      }
      if (scanId !== missingFileScanRef.current) return
      const missing = new Set(results.filter((r) => !r.found).map((r) => r.relativePath))
      const resolvedByPath = new Map(results.map((r) => [r.relativePath, r.resolvedPath]))
      setMissingFiles(
        refs
          .filter((r) => missing.has(r.relativePath))
          .map((r) => ({ ...r, resolvedPath: resolvedByPath.get(r.relativePath) ?? r.relativePath }))
      )
    },
    []
  )

  const pushSnapshot = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { ...graphRef.current }]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
    setFuture([])
    markDirty()
  }, [markDirty])

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
    setFuture((prev) => [...prev, { ...graphRef.current }])
    setPast((prev) => prev.slice(0, -1))
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }, [past, setNodes, setEdges])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setPast((prev) => [...prev, { ...graphRef.current }])
    setFuture((prev) => prev.slice(0, -1))
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [future, setNodes, setEdges])

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
            (e) =>
              !containerRemovalIds.includes(e.source) && !containerRemovalIds.includes(e.target)
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

  // See ADR 0065 — replaces the current selection with every element of one
  // type, rather than shift-clicking each one individually. Exposed via
  // each type's own right-click context menu (EntityNode/ContainerNode/
  // TextNode/LineNode/onEdgeContextMenu below) rather than a top menu-bar
  // item — MenuBar has no submenu support yet, and a per-type context menu
  // entry is already exactly where the user's own example ("select all
  // edges") pointed. Whole-type only for now, no finer filtering (e.g.
  // "edges with this routing style") — left as an open question, not resolved here.
  // Declared here (early) rather than alongside selectAll/deselectAll
  // further down — onEdgeContextMenu below needs it, and a useCallback's
  // own deps array is evaluated immediately at render time, unlike the
  // callback body itself, so a later declaration would be a genuine
  // temporal-dead-zone error, not just a theoretical one.
  const selectAllOfType = useCallback(
    (type: 'entity' | 'container' | 'text' | 'line' | 'edge') => {
      setNodes((nds) =>
        nds.map((n) => (n.selected === (n.type === type) ? n : { ...n, selected: n.type === type }))
      )
      setEdges((eds) =>
        eds.map((e) => (e.selected === (type === 'edge') ? e : { ...e, selected: type === 'edge' }))
      )
    },
    [setNodes, setEdges]
  )

  // Flip the direction of every edge in `ids` in one action — see ADR 0087.
  // reverseEdgeDirection (edges/edgeDirectionSets.ts) is a pure Edge -> Edge
  // that swaps the endpoints + handles and the direction-tied visuals
  // (points order, labelPosition); mapping it over N edges under a single
  // snapshot makes the whole batch one undo step. When a direction set is
  // active, each edge's per-set record is refreshed from these live fields
  // at the next switch/save, so this reverses only the active reading —
  // same as the single-edge case it generalizes. Declared here (early)
  // because onEdgeContextMenu below references it in a deps array, which is
  // evaluated at render time (see selectAllOfType's own note).
  const reverseEdges = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      pushSnapshot()
      setEdges((eds) => eds.map((e) => (idSet.has(e.id) ? reverseEdgeDirection(e) : e)))
    },
    [pushSnapshot, setEdges]
  )

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
      const clickPoint = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      // Right-clicking an edge that's part of a multi-selection reverses the
      // whole selection; right-clicking an unselected edge acts on just that
      // one and leaves the selection alone (ADR 0087).
      const reverseTargetIds =
        edge.selected && edges.some((e) => e.selected && e.id !== edge.id)
          ? edges.filter((e) => e.selected).map((e) => e.id)
          : [edge.id]
      openContextMenu(event.clientX, event.clientY, [
        {
          label: 'Line style…',
          onSelect: () =>
            setLinePicker({
              edgeId: edge.id,
              anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0)
            })
        },
        { label: 'Select all edges', onSelect: () => selectAllOfType('edge') },
        {
          label:
            reverseTargetIds.length > 1
              ? `Reverse direction (${reverseTargetIds.length})`
              : 'Reverse direction',
          onSelect: () => reverseEdges(reverseTargetIds)
        },
        {
          label: 'Add point here',
          separatorBefore: true,
          onSelect: () => {
            const points = (edge.data?.points as LinePoint[] | undefined) ?? []
            const routingStyle = (edge.data?.style as EdgeStyle | undefined)?.routingStyle
            const nodeById = new Map(nodes.map((n) => [n.id, n]))
            const source = resolveEndpointPosition(edge.source, edge.sourceHandle, nodeById)
            const target = resolveEndpointPosition(edge.target, edge.targetHandle, nodeById)
            const newPoint: LinePoint = { x: clickPoint.x, y: clickPoint.y }

            let newPoints: LinePoint[]
            let newRoutingStyle: EdgeStyle['routingStyle']
            if (routingStyle === 'step' || routingStyle === 'smoothstep') {
              // Keep the right-angled routing; the new waypoint just gets
              // forced into the orthogonal path (ADR 0077). Insert it in the
              // gap of [source, ...points, target] it's nearest to.
              const gap = nearestWaypointGap(source, points, target, clickPoint)
              newPoints = [...points]
              newPoints.splice(gap, 0, newPoint)
              newRoutingStyle = routingStyle
            } else if (routingStyle === 'catmullRom' && points.length > 0) {
              const pathPoints: PathPoint[] = [source, ...points, target]
              const segmentIndex = nearestSegmentIndex(pathPoints, clickPoint)
              newPoints = [...points]
              // No explicit gravity — falls back to bendablePath's own
              // default (0.5), same "absent means the standard value"
              // convention as the rest of this schema.
              newPoints.splice(segmentIndex, 0, newPoint)
              newRoutingStyle = 'catmullRom'
            } else {
              // straight / bezier / absent, or catmull-rom with no points
              // yet: only one segment exists, so the new point is trivially
              // the only entry. Adding it is what opts the edge into
              // catmull-rom routing in the first place (ADR 0057) — no prior
              // trip to the property panel required.
              newPoints = [newPoint]
              newRoutingStyle = 'catmullRom'
            }
            pushSnapshot()
            setEdges((eds) =>
              eds.map((e) =>
                e.id === edge.id
                  ? {
                      ...e,
                      data: {
                        ...e.data,
                        points: newPoints,
                        style: {
                          ...(e.data?.style as EdgeStyle | undefined),
                          routingStyle: newRoutingStyle
                        }
                      }
                    }
                  : e
              )
            )
          }
        }
      ])
    },
    [openContextMenu, rfInstance, nodes, edges, pushSnapshot, setEdges, reverseEdges, selectAllOfType]
  )

  // The utility dock shows one surface at a time (see ADR 0013) — opening
  // any of the family closes every other one, same as clicking a different
  // tab. Each toggle below therefore has to name every sibling; the
  // repetition is deliberate and low-risk, not worth a generic
  // exclusive-panel abstraction. Highlights and Legend are NOT in this
  // family — both are floating popups anchored near the bottom-left
  // <Controls> cluster, independent of the dock. Required tags and line
  // bend presets used to be members too; ADR 0071 folded them into
  // DiagramSettingsPanel as collapsible sections, so only that one toggle
  // remains for all three.
  const openDetailsPanel = useCallback(
    (nodeId: string) => {
      setDiagnosticsPanelOpen(false)
      setPreferencesPanelOpen(false)
      setLayerPanelOpen(false)
      setStylePalettePanelOpen(false)
      setAlignDistributePanelOpen(false)
      setDiagramSettingsPanelOpen(false)
      setReferencesPanelOpen(false)
      setChangesPanelOpen(false)
      setDetailsPanelNodeId(nodeId)
      // No-existing-file (or nothing saved yet to resolve one against) is
      // seeded synchronously right here rather than in the effect below
      // — nothing asynchronous happens in this branch, so
      // there's no reason to route it through an effect at all. The
      // functional-updater guard (not a closure read of noteShadows)
      // keeps this callback's own identity stable regardless of how often
      // noteShadows itself changes (every keystroke while editing) —
      // matters because this callback is threaded through DiagramContext's
      // memoized value (ADR 0056).
      // Read the node off the React Flow instance, not a closed-over `nodes`
      // — keeps this callback stable so it doesn't bust the memoized
      // DiagramContext value on every node change (ADR 0073), same as
      // openReferencesFor.
      const node = rfInstance.getNode(nodeId)
      const existingPath = typeof node?.data?.details === 'string' ? node.data.details : undefined
      if (!existingPath || !currentPath) {
        setNoteShadows((prev) => (nodeId in prev ? prev : { ...prev, [nodeId]: newNoteShadow(nodeId) }))
      }
    },
    [rfInstance, currentPath]
  )

  const toggleDiagnosticsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setDiagnosticsPanelOpen((open) => !open)
  }, [])

  const togglePreferencesPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setPreferencesPanelOpen((open) => !open)
  }, [])

  const toggleStylePalettePanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setStylePalettePanelOpen((open) => !open)
  }, [])

  const toggleAlignDistributePanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setAlignDistributePanelOpen((open) => !open)
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
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setEntityHighlightNodeId(null)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setLayerPanelOpen((open) => !open)
  }, [])

  const toggleDiagramSettingsPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen(false)
    setDiagramSettingsPanelOpen((open) => !open)
  }, [])

  const toggleReferencesPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setChangesPanelOpen(false)
    setReferencesPanelOpen((open) => !open)
  }, [])

  // Recomputes the disk-vs-memory diff (epic 0117, ADR 0102) — a
  // side-effect-free reread (never recordOpenedOrSaved) via
  // rereadDiagramForDiff, diffed against the same toDiagramFile() shape the
  // real save path uses. A never-saved diagram (currentPath null) diffs
  // against createEmptyDiagram().
  const computeChangesDiff = useCallback(async () => {
    const saved = currentPath
      ? ((await window.api.rereadDiagramForDiff(currentPath)) ?? createEmptyDiagram())
      : createEmptyDiagram()
    const current = toDiagramFile(
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security
    )
    setChangesDiff(diffDiagrams(saved, current))
  }, [
    currentPath,
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security
  ])

  const toggleChangesPanel = useCallback(() => {
    setDetailsPanelNodeId(null)
    setDiagnosticsPanelOpen(false)
    setPreferencesPanelOpen(false)
    setLayerPanelOpen(false)
    setStylePalettePanelOpen(false)
    setAlignDistributePanelOpen(false)
    setDiagramSettingsPanelOpen(false)
    setReferencesPanelOpen(false)
    setChangesPanelOpen((open) => {
      const next = !open
      if (next) {
        setChangesDiff(null)
        void computeChangesDiff()
      }
      return next
    })
  }, [computeChangesDiff])

  // Persona switch (ADR 0079). Switching to the Security Matrix closes the
  // diagram-only utility-dock panels so a stale Layers/Diagnostics/etc.
  // surface isn't left floating over a view whose menu no longer offers to
  // open it. Preferences stays — it's global, valid in both personas.
  const handlePersonaChange = useCallback((next: 'diagram' | 'matrix') => {
    setPersona(next)
    if (next === 'matrix') {
      setDetailsPanelNodeId(null)
      setDiagnosticsPanelOpen(false)
      setLayerPanelOpen(false)
      setStylePalettePanelOpen(false)
      setAlignDistributePanelOpen(false)
      setDiagramSettingsPanelOpen(false)
      setReferencesPanelOpen(false)
      setChangesPanelOpen(false)
      setDefaultEdgeStylePicker(null)
    }
  }, [])

  // --- Reference images (ADR 0069) ---
  // The floating viewer windows are pure session state; the paths on
  // node.data.references are the only persisted part.
  const openReferenceWindow = useCallback((nodeId: string, path: string) => {
    setReferenceWindows((prev) =>
      prev.some((w) => w.nodeId === nodeId && w.path === path) ? prev : [...prev, { nodeId, path }]
    )
  }, [])

  const closeReferenceWindow = useCallback((nodeId: string, path: string) => {
    setReferenceWindows((prev) => prev.filter((w) => !(w.nodeId === nodeId && w.path === path)))
  }, [])

  const addReferencesToNode = useCallback(
    async (nodeId: string) => {
      if (!currentPath) {
        showAlert('Save the diagram before adding reference images.')
        return
      }
      let added: string[] | null
      try {
        added = await window.api.pickAndCopyReferences(currentPath)
      } catch (err) {
        // Surface it rather than failing silently — most often a stale
        // preload bundle after adding this API (needs a full app restart),
        // occasionally a real copy/permissions error.
        showAlert(`Could not add reference images: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
      if (!added || added.length === 0) return
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = Array.isArray(n.data?.references) ? (n.data.references as string[]) : []
          return { ...n, data: { ...n.data, references: [...existing, ...added] } }
        })
      )
      setReferenceWindows((prev) => [
        ...prev,
        ...added
          .filter((path) => !prev.some((w) => w.nodeId === nodeId && w.path === path))
          .map((path) => ({ nodeId, path }))
      ])
    },
    [currentPath, pushSnapshot, setNodes]
  )

  const removeReferenceFromNode = useCallback(
    (nodeId: string, path: string) => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = Array.isArray(n.data?.references) ? (n.data.references as string[]) : []
          const next = existing.filter((p) => p !== path)
          return { ...n, data: { ...n.data, references: next.length > 0 ? next : undefined } }
        })
      )
      setReferenceWindows((prev) => prev.filter((w) => !(w.nodeId === nodeId && w.path === path)))
    },
    [pushSnapshot, setNodes]
  )

  // DiagramContext entry point — entity/container right-click "Reference
  // images…": open a window for each of the node's references, or jump
  // straight to the file picker when it has none yet.
  const openReferencesFor = useCallback(
    (nodeId: string) => {
      // Read live node data off the React Flow instance rather than closing
      // over `nodes` — keeps this callback stable so it doesn't bust the
      // memoized DiagramContext value on every node change (ADR 0056).
      const node = rfInstance.getNode(nodeId)
      const refs = Array.isArray(node?.data?.references) ? (node.data.references as string[]) : []
      if (refs.length === 0) {
        void addReferencesToNode(nodeId)
        return
      }
      setReferenceWindows((prev) => [
        ...prev,
        ...refs
          .filter((path) => !prev.some((w) => w.nodeId === nodeId && w.path === path))
          .map((path) => ({ nodeId, path }))
      ])
    },
    [rfInstance, addReferencesToNode]
  )

  // Select just this node and frame the viewport on it. Used by the
  // References inventory panel and the Diagnostics broken-links section
  // (ADR 0084) — nothing reference-specific about it.
  const revealNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.selected === (n.id === nodeId) ? n : { ...n, selected: n.id === nodeId }))
      )
      rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 })
    },
    [setNodes, rfInstance]
  )

  // Diagnostics missing-file row actions (ADR 0084). None of these touch a
  // file on disk. A removal is *staged* — moved into stagedFileRemovals —
  // and only applied (to nodes/legend) when the diagram is saved, in
  // persistDiagram. "Dismiss" hides a row for the session. "Relink" is an
  // in-memory edit like any other (undoable, dirties, needs a save).
  const stageMissingFileRemoval = useCallback((entry: MissingFileEntry) => {
    setMissingFiles((prev) => prev.filter((m) => m.key !== entry.key))
    setStagedFileRemovals((prev) => [...prev, entry])
    markDirty()
  }, [markDirty])

  const unstageMissingFileRemoval = useCallback((entry: MissingFileEntry) => {
    setStagedFileRemovals((prev) => prev.filter((m) => m.key !== entry.key))
    setMissingFiles((prev) => [...prev, entry])
  }, [])

  const dismissMissingFile = useCallback((entry: MissingFileEntry) => {
    setDismissedFileKeys((prev) => new Set(prev).add(entry.key))
  }, [])

  const relinkMissingFile = useCallback(
    async (entry: MissingFileEntry) => {
      if (!currentPath || entry.ownerKind !== 'node') return
      let newPath: string | null = null
      if (entry.resourceKind === 'linkedDiagram') {
        newPath = await window.api.pickExistingLinkedDiagram(currentPath)
      } else if (entry.resourceKind === 'icon') {
        newPath = await window.api.pickAndCopyCustomIcon(currentPath)
      }
      if (!newPath) return
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== entry.ownerId) return n
          const d: Record<string, unknown> = { ...n.data }
          if (entry.resourceKind === 'linkedDiagram') {
            d.linkedDiagram = newPath
          } else if (entry.resourceKind === 'icon' && entry.iconSlot) {
            const icons = { ...(d.icons as Partial<Record<IconSlot, IconRef>> | undefined) }
            icons[entry.iconSlot as IconSlot] = { source: 'custom', path: newPath! }
            d.icons = icons
          }
          return { ...n, data: d }
        })
      )
      setMissingFiles((prev) => prev.filter((m) => m.key !== entry.key))
    },
    [currentPath, pushSnapshot, setNodes]
  )

  const updateGravityPresets = useCallback(
    (presets: GravityPreset[]) => {
      setGravityPresets(presets)
      markDirty()
    },
    [markDirty]
  )

  const updateDiagramMaxConnectionPointsPerSide = useCallback(
    (value: number | undefined) => {
      setDiagramMaxConnectionPointsPerSide(value)
      markDirty()
    },
    [markDirty]
  )

  // --- Flippable edge direction sets (ADR 0081) ---
  // A switch re-orients the live edges AND every history snapshot's edges
  // (so a later undo doesn't restore a stale orientation); it is not itself
  // an undo step. Set create/duplicate/delete/rename likewise just mutate
  // state and mark the diagram dirty, no snapshot.
  const rewriteHistoryEdges = useCallback((transform: (edges: Edge[]) => Edge[]) => {
    setPast((p) => p.map((s) => ({ ...s, edges: transform(s.edges) })))
    setFuture((f) => f.map((s) => ({ ...s, edges: transform(s.edges) })))
  }, [])

  const switchEdgeDirectionSet = useCallback(
    (toId: string) => {
      const fromId = activeEdgeDirectionSetId ?? edgeDirectionSets[0]?.id
      const setIds = edgeDirectionSets.map((s) => s.id)
      if (!fromId || fromId === toId || !setIds.includes(toId)) return
      const nodesById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
      const transform = (eds: Edge[]): Edge[] =>
        switchActiveDirectionSet(eds, setIds, fromId, toId, nodesById)
      setEdges(transform)
      rewriteHistoryEdges(transform)
      setActiveEdgeDirectionSetId(toId)
      markDirty()
    },
    [activeEdgeDirectionSetId, edgeDirectionSets, setEdges, rewriteHistoryEdges, markDirty]
  )

  const addEdgeDirectionSet = useCallback(
    (copyFromId?: string) => {
      const existing = edgeDirectionSets
      const source = copyFromId ? existing.find((s) => s.id === copyFromId) : undefined
      const used = new Set(existing.map((s) => s.name))
      let name: string
      if (existing.length === 0) {
        name = 'Data flow'
      } else if (source) {
        name = `${source.name} copy`
        for (let n = 2; used.has(name); n++) name = `${source.name} copy ${n}`
      } else {
        name = 'Trigger direction'
        for (let n = 2; used.has(name); n++) name = `Direction ${n}`
      }
      const newSet: EdgeDirectionSet = {
        id: `dirset-${crypto.randomUUID()}`,
        name,
        // ADR 0083: `style` is the reading's default edge style — seeds new
        // edges + drives the legend row. A fresh set gets a plain arrow.
        style: source?.style
          ? { ...source.style }
          : { stroke: DEFAULT_DIRECTION_SET_LEGEND_COLOR, endMarker: 'arrowClosed' }
      }
      const next = [...existing, newSet]
      // Per-edge records only exist at 2+ sets — seed the new set (and
      // materialise the base set's records) only once we cross that line.
      if (next.length >= 2) {
        const setIds = next.map((s) => s.id)
        const fromId = copyFromId ?? activeEdgeDirectionSetId ?? next[0].id
        const transform = (eds: Edge[]): Edge[] =>
          addDirectionSetFrom(eds, setIds, newSet.id, fromId)
        setEdges(transform)
        rewriteHistoryEdges(transform)
      }
      setEdgeDirectionSets(next)
      if (!activeEdgeDirectionSetId) setActiveEdgeDirectionSetId(next[0].id)
      markDirty()
    },
    [edgeDirectionSets, activeEdgeDirectionSetId, setEdges, rewriteHistoryEdges, markDirty]
  )

  const renameEdgeDirectionSet = useCallback(
    (id: string, name: string) => {
      setEdgeDirectionSets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
      markDirty()
    },
    [markDirty]
  )

  // The set's default edge style (ADR 0083) — seeds new edges drawn while
  // this reading is active, and drives its legend row. Does not restyle
  // existing edges.
  const updateEdgeDirectionSetStyle = useCallback(
    (id: string, patch: Partial<EdgeDirectionSetStyle>) => {
      setEdgeDirectionSets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, style: { ...s.style, ...patch } } : s))
      )
      markDirty()
    },
    [markDirty]
  )

  const deleteEdgeDirectionSet = useCallback(
    (id: string) => {
      const sets = edgeDirectionSets
      if (!sets.some((s) => s.id === id)) return
      const setIds = sets.map((s) => s.id)
      const fromActive = activeEdgeDirectionSetId ?? sets[0]?.id
      const remaining = sets.filter((s) => s.id !== id)
      const targetActive =
        remaining.length === 0 ? undefined : id === fromActive ? remaining[0].id : fromActive
      // Per-edge records only exist at 2+ sets. Below that there's nothing
      // on the edges to touch — just drop the registry entry.
      if (sets.length >= 2) {
        const nodesById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
        const transform = (eds: Edge[]): Edge[] => {
          const reoriented =
            targetActive && fromActive && targetActive !== fromActive
              ? switchActiveDirectionSet(eds, setIds, fromActive, targetActive, nodesById)
              : eds
          return remaining.length <= 1
            ? stripDirectionSets(reoriented)
            : removeDirectionSetKey(reoriented, id)
        }
        setEdges(transform)
        rewriteHistoryEdges(transform)
      }
      setEdgeDirectionSets(remaining)
      setActiveEdgeDirectionSetId(targetActive)
      markDirty()
    },
    [edgeDirectionSets, activeEdgeDirectionSetId, setEdges, rewriteHistoryEdges, markDirty]
  )

  // --- Security matrix (ADR 0082) ---

  // Diagram-level config: threat catalog, matrix membership, hide lists,
  // scales, methods. Not part of undo history (like the other catalogs).
  const updateSecurity = useCallback(
    (next: DiagramSecurity) => {
      setSecurity(next)
      markDirty()
    },
    [markDirty]
  )

  // Recursive rollup (ADR 0088). The crawl walks each linked matrix entity's
  // subtree in the main process; the result is cached here for the session
  // and only re-fetched on entering the matrix persona or an explicit
  // Refresh — never persisted, so a derived value can't go stale.
  const [securityCrawl, setSecurityCrawl] = useState<SecurityCrawlResult | null>(null)
  const refreshSecurityCrawl = useEventCallback(() => {
    if (!currentPath) {
      setSecurityCrawl(null)
      return
    }
    const nodeById = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
    const links = security.matrixEntityIds.flatMap((entityId) => {
      const link = nodeById.get(entityId)?.data?.linkedDiagram
      return typeof link === 'string' && link.trim() !== ''
        ? [{ entityId, relativePath: link }]
        : []
    })
    if (links.length === 0) {
      setSecurityCrawl({ columns: {}, warnings: [] })
      return
    }
    void window.api.crawlLinkedSecurity(currentPath, links).then(setSecurityCrawl)
  })

  // Crawl on entering the matrix persona (ADR 0088). No cooldown throttle
  // yet — that's a follow-up; today it's this + the explicit Refresh button.
  useEffect(() => {
    if (persona === 'matrix') refreshSecurityCrawl()
  }, [persona, refreshSecurityCrawl])

  // One assessment cell on an entity (`null` clears it). Routed through the
  // node history — a cell edit is undoable.
  const updateNodeSecurityCell = useCallback(
    (nodeId: string, threatId: string, cell: RiskCell | null) => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const existing = (n.data?.security as Record<string, RiskCell> | undefined) ?? {}
          const nextSec = { ...existing }
          if (cell === null) delete nextSec[threatId]
          else nextSec[threatId] = cell
          const data = { ...n.data }
          if (Object.keys(nextSec).length > 0) data.security = nextSec
          else delete data.security
          return { ...n, data }
        })
      )
      markDirty()
    },
    [setNodes, pushSnapshot, markDirty]
  )

  // Removing a threat / an entity from the matrix is destructive ("remove
  // means remove" — the user) and deliberately NOT an undo step; it also
  // strips the affected cells from every history snapshot so an unrelated
  // undo can't resurrect orphan `data.security` entries.
  const removeSecurityThreat = useCallback(
    (threatId: string) => {
      const strip = (nds: Node[]): Node[] =>
        nds.map((n) => {
          const cells = n.data?.security as Record<string, RiskCell> | undefined
          if (!cells || !(threatId in cells)) return n
          const nextSec = { ...cells }
          delete nextSec[threatId]
          const data = { ...n.data }
          if (Object.keys(nextSec).length > 0) data.security = nextSec
          else delete data.security
          return { ...n, data }
        })
      setNodes(strip)
      setPast((p) => p.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setFuture((f) => f.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setSecurity((cur) => ({
        ...cur,
        threats: cur.threats.filter((t) => t.id !== threatId),
        hiddenThreatIds: cur.hiddenThreatIds?.filter((id) => id !== threatId)
      }))
      markDirty()
    },
    [setNodes, markDirty]
  )

  const removeSecurityEntity = useCallback(
    (nodeId: string) => {
      const strip = (nds: Node[]): Node[] =>
        nds.map((n) => {
          if (n.id !== nodeId || !n.data?.security) return n
          const data = { ...n.data }
          delete data.security
          return { ...n, data }
        })
      setNodes(strip)
      setPast((p) => p.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setFuture((f) => f.map((s) => ({ ...s, nodes: strip(s.nodes) })))
      setSecurity((cur) => ({
        ...cur,
        matrixEntityIds: cur.matrixEntityIds.filter((id) => id !== nodeId),
        hiddenEntityIds: cur.hiddenEntityIds?.filter((id) => id !== nodeId)
      }))
      markDirty()
    },
    [setNodes, markDirty]
  )

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
  // checkbox, ADR 0026: enabling/disabling every member at
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

  // "Add group" and each existing group's manual resync button both call
  // this with the same key — ADR 0026. Reconciles against
  // highlightGroupSourceValues (allowedValues for a required tag, else a
  // live scan of every node/edge's metadata): a value with no entry gets a
  // new white one, an entry for a value nothing carries/allows anymore is
  // dropped, everything else untouched. Also prunes enabledHighlightIds for
  // whatever got dropped, so a removed row can't leave an orphaned
  // enabled-id behind. The effect below does the same thing automatically
  // for every *existing* group whenever its source actually changes — this
  // stays the explicit "add a group that doesn't exist yet" entry point,
  // and a manual "resync now" the automatic effect makes mostly redundant
  // but harmless to keep.
  const addOrResyncHighlightGroup = useCallback(
    (key: string) => {
      const currentValues = highlightGroupSourceValues(key, requiredTags, usedTags)
      const next = reconcileHighlightGroup(highlights, key, currentValues)
      const nextIds = new Set(next.map(highlightId))
      setHighlights(next)
      setEnabledHighlightIds((prev) => {
        const filtered = new Set([...prev].filter((id) => nextIds.has(id)))
        return filtered.size === prev.size ? prev : filtered
      })
      markDirty()
    },
    [highlights, requiredTags, usedTags, markDirty]
  )

  // Automatic resync (ADR 0026 addendum, 2026-09-23): every *existing*
  // group's entries stay in sync with their source as it changes — a new
  // allowed value added to a required tag, or a new value for a free tag
  // actually appearing somewhere in the diagram — without needing the
  // manual ↻ button. Never auto-creates a group for a key that doesn't
  // have one yet ("Add group" stays the deliberate first step).
  //
  // Deliberately NOT a useEffect: this is "adjust state as a dependency
  // changes," which react.dev's own effect guidance (and this project's
  // lint setup) flags as a synchronous-setState-in-effect anti-pattern —
  // computed here instead, directly in the render body, React's documented
  // alternative for this exact case. Cheap and safe to run every render:
  // reconcileHighlightGroup returns kept entries by the same reference, so
  // folding it over every existing key either produces the *same* array
  // (nothing changed, no setState — the overwhelmingly common case, e.g.
  // every render during an unrelated drag) or a genuinely different one
  // (setState fires once; React immediately re-renders, that pass finds
  // nothing changed, and it settles — never a loop).
  const existingHighlightKeys = [...new Set(highlights.map((h) => h.key))]
  let resyncedHighlights = highlights
  for (const key of existingHighlightKeys) {
    const currentValues = highlightGroupSourceValues(key, requiredTags, usedTags)
    const candidate = reconcileHighlightGroup(resyncedHighlights, key, currentValues)
    const unchanged =
      candidate.length === resyncedHighlights.length &&
      candidate.every((h, i) => h === resyncedHighlights[i])
    if (!unchanged) resyncedHighlights = candidate
  }
  if (resyncedHighlights !== highlights) {
    const nextIds = new Set(resyncedHighlights.map(highlightId))
    setHighlights(resyncedHighlights)
    setEnabledHighlightIds((prev) => {
      const filtered = new Set([...prev].filter((id) => nextIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
    markDirty()
  }

  const matchHighlights = useCallback(
    (metadata: Record<string, MetadataEntry> | undefined) =>
      matchingHighlights(metadata, highlights, enabledHighlightIds),
    [highlights, enabledHighlightIds]
  )

  // Search overlay (ADR 0062). Selects exactly the one matched
  // element and frames the viewport on it — the "fit-to-node/selection"
  // piece folded into search's scope. An edge has no bounding box of
  // its own to fit on, so it fits on its two endpoint nodes instead.
  const focusSearchMatch = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id }))
      )
      setEdges((eds) =>
        eds.map((e) => (e.selected === (e.id === id) ? e : { ...e, selected: e.id === id }))
      )
      const edge = edges.find((e) => e.id === id)
      if (edge) {
        rfInstance.fitView({
          nodes: [{ id: edge.source }, { id: edge.target }],
          duration: 300,
          padding: 0.5
        })
      } else {
        rfInstance.fitView({ nodes: [{ id }], duration: 300, padding: 0.5 })
      }
    },
    [edges, setNodes, setEdges, rfInstance]
  )

  // Shared "commit this match list" step — the text/deep path in
  // computeAndSetMatches and the icon path in applyIconMatches both end here.
  const applyMatchOrder = useCallback((matchedIds: Set<string>, order: string[]) => {
    setSearchMatchIds(matchedIds)
    setSearchMatchOrder(order)
    setSearchMatchCursor(0)
    setSearchRun(true)
  }, [])

  // Every element that satisfies the criteria (ADR 0096, 0097) — free text over
  // id/label/tags *and* the node's details note, an exact icon, has: facets, all
  // ANDed. A note is read from its unsaved in-memory copy when the user has one
  // open, else from disk; reading is cheap, and the search terms (label:, tag:…)
  // are how the user narrows it. With Deep search on, a node that carries a link
  // to another diagram also matches when anything in that linked subtree does —
  // so the match lands on the entity in *this* diagram, cyclable like any other.
  // Edges carry no icons, references or notes, so those criteria exclude them.
  const computeMatchIds = useCallback(
    async (criteria: SearchCriteria): Promise<Set<string>> => {
      const matchedIds = new Set<string>()
      setDeepSearchLoading(true)
      try {
        const nodeHits = await Promise.all(
          nodes.map((n) => {
            const shadow = noteShadowsRef.current[n.id]
            const searchable = searchableFromData(n.id, n.data)
            // A note actively open but never yet saved (a brand-new note, or
            // any note on a diagram that's never been saved at all) has no
            // stored path yet — data.details stays unset until the first
            // save (epic 0087's sync-on-save convention) — but it still has
            // real, searchable content sitting in its shadow. Without this,
            // elementMatchesViaDetails' `!el.details` gate would treat an
            // in-memory-only note as if it didn't exist. The placeholder
            // value is never actually read as a path below — the shadow
            // branch always wins first — so its exact contents don't matter,
            // only that it's truthy.
            const details = searchable.details ?? (shadow ? '(unsaved note)' : undefined)
            return elementMatchesWithDetails(criteria, { ...searchable, details }, async (relativePath) => {
              if (shadow) return shadow.content
              return currentPath ? window.api.readDetails(currentPath, relativePath) : ''
            })
          })
        )
        nodes.forEach((n, i) => {
          if (nodeHits[i]) matchedIds.add(n.id)
        })
        for (const e of edges) {
          if (elementMatchesCriteria(criteria, searchableFromData(e.id, e.data))) {
            matchedIds.add(e.id)
          }
        }

        if (deepSearchEnabled && currentPath && hasSearchCriteria(criteria)) {
          // The in-memory links, so a link added since the last save is searched.
          const links = nodes.flatMap((n) => {
            const link = n.data?.linkedDiagram
            return typeof link === 'string' && link.trim() !== '' && !matchedIds.has(n.id)
              ? [{ nodeId: n.id, relativePath: link }]
              : []
          })
          try {
            const linked = await window.api.searchLinkedDiagrams(currentPath, links, criteria)
            for (const id of linked.matchedNodeIds) matchedIds.add(id)
            setSearchUnreadable(linked.unreadable)
          } catch (error) {
            showAlert(
              `Couldn't search linked diagrams: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }
      } finally {
        setDeepSearchLoading(false)
      }
      return matchedIds
    },
    [nodes, edges, currentPath, deepSearchEnabled]
  )

  // The stable next/prev order: nodes in their current array order, then edges.
  const orderMatches = useCallback(
    (matchedIds: Set<string>): string[] =>
      [...nodes, ...edges].filter((el) => matchedIds.has(el.id)).map((el) => el.id),
    [nodes, edges]
  )

  // Shared by both trigger buttons (ADR 0063 split Search and
  // Isolate into two independent actions over the same underlying match
  // computation — only what happens *after* matching differs). Returns the
  // match order, empty when no criterion is set.
  const computeAndSetMatches = useCallback(async (): Promise<string[]> => {
    const criteria: SearchCriteria = criteriaFromQuery(searchQuery, searchIcon)
    if (!hasSearchCriteria(criteria)) return []
    setSearchUnreadable([])
    const matchedIds = await computeMatchIds(criteria)
    const order = orderMatches(matchedIds)
    applyMatchOrder(matchedIds, order)
    return order
  }, [searchIcon, searchQuery, computeMatchIds, orderMatches, applyMatchOrder])

  const runSearch = useCallback(async () => {
    const order = await computeAndSetMatches()
    if (order.length > 0) focusSearchMatch(order[0])
  }, [computeAndSetMatches, focusSearchMatch])

  // Isolate's own viewport action (ADR 0063) — frames every
  // match at once rather than jumping to one, the whole point of the
  // "scope the view down to a working set" framing. rfInstance.fitView
  // already computes the union bounding box for however many node ids
  // it's given, so no manual bbox math is needed here — an edge match
  // just contributes its two endpoint nodes to that set, same reasoning
  // as focusSearchMatch's single-match case above.
  const fitAllMatches = useCallback(
    (order: string[]) => {
      if (order.length === 0) return
      const nodeIds = new Set<string>()
      for (const id of order) {
        const edge = edges.find((e) => e.id === id)
        if (edge) {
          nodeIds.add(edge.source)
          nodeIds.add(edge.target)
        } else {
          nodeIds.add(id)
        }
      }
      rfInstance.fitView({
        nodes: [...nodeIds].map((id) => ({ id })),
        duration: 300,
        padding: 0.5
      })
    },
    [edges, rfInstance]
  )

  const nextSearchMatch = useCallback(() => {
    if (searchMatchOrder.length === 0) return
    const next = (searchMatchCursor + 1) % searchMatchOrder.length
    setSearchMatchCursor(next)
    focusSearchMatch(searchMatchOrder[next])
  }, [searchMatchOrder, searchMatchCursor, focusSearchMatch])

  const prevSearchMatch = useCallback(() => {
    if (searchMatchOrder.length === 0) return
    const prev = (searchMatchCursor - 1 + searchMatchOrder.length) % searchMatchOrder.length
    setSearchMatchCursor(prev)
    focusSearchMatch(searchMatchOrder[prev])
  }, [searchMatchOrder, searchMatchCursor, focusSearchMatch])

  // Shared by the query-changing (stale results shouldn't stay highlighted
  // once the query no longer matches what's on screen) and close paths.
  const clearSearchResults = useCallback(() => {
    setSearchMatchIds(new Set())
    setSearchMatchOrder([])
    setSearchMatchCursor(0)
    setSearchRun(false)
    // Isolate has no meaning without a live match set — see its own state
    // comment above.
    setIsolateActive(false)
    // Any query change or close drops icon mode too (ADR 0072) — the icon
    // and free-text searches never coexist.
    setSearchIcon(null)
    setSearchUnreadable([])
  }, [])

  // Isolate is its own independent trigger (ADR 0063, revised
  // after the user's follow-up: available from the start, not gated on
  // Search having already run) — when off, it runs the same matching
  // Search does against whatever query is currently typed, then frames
  // every match at once (fitAllMatches) instead of jumping to one node.
  // When already on, a second click just turns it off; the underlying
  // match set (and Search's own next/prev over it) is left alone —
  // Isolate is a dimming toggle layered on top of it, not a separate
  // state universe.
  const runIsolate = useCallback(async () => {
    if (isolateActive) {
      setIsolateActive(false)
      return
    }
    const order = await computeAndSetMatches()
    if (order.length === 0) return
    setIsolateActive(true)
    fitAllMatches(order)
  }, [isolateActive, computeAndSetMatches, fitAllMatches])

  const onSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      clearSearchResults()
    },
    [clearSearchResults]
  )

  const closeSearchOverlay = useCallback(() => {
    setSearchOverlayOpen(false)
    setSearchIconPicker(null)
    clearSearchResults()
  }, [clearSearchResults])

  // Shared by the Ctrl+F keydown handler and the command palette's "Open or
  // close search" row (ADR 0100) — one place for the toggle logic instead of
  // two copies drifting.
  const toggleSearchOverlay = useCallback(() => {
    if (searchOverlayOpen) closeSearchOverlay()
    else setSearchOverlayOpen(true)
  }, [searchOverlayOpen, closeSearchOverlay])

  // Auto-run on pick (ADR 0072) — same as IconPicker's own pick-and-close
  // flow: choosing an icon replaces whatever's in the text box, closes the
  // popup, and immediately runs the search + frames the first hit.
  const pickSearchIcon = useCallback(
    async (icon: IconRef) => {
      setSearchQuery('')
      setSearchIcon(icon)
      setSearchIconPicker(null)
      setIsolateActive(false)
      setSearchUnreadable([])
      const matchedIds = await computeMatchIds({
        any: [],
        labels: [],
        ids: [],
        tags: [],
        has: [],
        icon
      })
      const order = orderMatches(matchedIds)
      applyMatchOrder(matchedIds, order)
      if (order.length > 0) focusSearchMatch(order[0])
    },
    [computeMatchIds, orderMatches, applyMatchOrder, focusSearchMatch]
  )

  const toggleSearchIconPicker = useCallback((anchorRect: DOMRect) => {
    setSearchIconPicker((cur) => (cur ? null : anchorRect))
  }, [])

  const clearSearchIcon = useCallback(() => {
    setSearchIconPicker(null)
    clearSearchResults()
  }, [clearSearchResults])

  // Gathers this diagram's own direct linked-node relative paths (deeper
  // levels are discovered from disk during the walk — see ADR 0024),
  // previews the reachable subtree, confirms with the user, then copies.
  // A link resolving outside this diagram's own directory tree is never
  // followed or written to — reported as excluded, not silently skipped.
  const copyRequiredTagsToChildren = useCallback(async () => {
    if (!currentPath) {
      showAlert('Save the diagram before copying required tags to linked children.')
      return
    }
    const directChildRelativePaths = nodes
      .map((n) =>
        typeof n.data?.linkedDiagram === 'string' ? (n.data.linkedDiagram as string) : undefined
      )
      .filter((p): p is string => p !== undefined)
    if (directChildRelativePaths.length === 0) {
      showAlert('This diagram has no linked children yet.')
      return
    }
    const preview = await window.api
      .previewRequiredTagsChildren(currentPath, directChildRelativePaths)
      .catch((error: unknown) => {
        showAlert(
          `Couldn't scan linked diagrams: ${error instanceof Error ? error.message : String(error)}`
        )
        return null
      })
    if (!preview) return
    if (preview.reached.length === 0) {
      showAlert('No linked diagrams to copy to (all links were external or unreadable).')
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
        showAlert(
          `Couldn't copy required tags: ${error instanceof Error ? error.message : String(error)}`
        )
        return null
      })
    if (!result) return
    const unreadableNote =
      result.unreadable.length > 0
        ? `\n\nCouldn't be read, skipped:\n${result.unreadable.map((p) => `  ${p}`).join('\n')}`
        : ''
    showAlert(
      `Copied required tags to ${result.reached.length} linked diagram(s):\n\n` +
        result.reached.map((p) => `  ${p}`).join('\n') +
        unreadableNote
    )
  }, [currentPath, nodes, requiredTags])

  const iconPickerNode = iconPicker ? nodes.find((n) => n.id === iconPicker.nodeId) : undefined
  const iconPickerIcons = (iconPickerNode?.data?.icons ?? {}) as Partial<Record<IconSlot, IconRef>>

  const colorPickerNode = colorPicker ? nodes.find((n) => n.id === colorPicker.nodeId) : undefined
  const colorPickerStyle = (colorPickerNode?.data?.style as NodeStyle | undefined) ?? {}

  // Load a note's shadow from its file the first time its panel is opened this
  // session (a note with no file yet is seeded synchronously in
  // openDetailsPanel). Stamped before reading (see details:readWithStamp) so a
  // change in between is caught, not missed.
  useEffect(() => {
    if (!detailsPanelNodeId || detailsPanelNodeId in noteShadows) return
    const node = nodes.find((n) => n.id === detailsPanelNodeId)
    const existingPath = typeof node?.data?.details === 'string' ? node.data.details : undefined
    if (!existingPath || !currentPath) return
    const nodeId = detailsPanelNodeId
    window.api.readDetailsWithStamp(currentPath, existingPath).then(({ content, stamp }) => {
      setNoteShadows((prev) =>
        nodeId in prev ? prev : { ...prev, [nodeId]: loadedNoteShadow(nodeId, existingPath, stamp, content) }
      )
    })
  }, [detailsPanelNodeId, noteShadows, nodes, currentPath])

  // Outside-the-app edit to the note shown in the open Details panel (ADR 0092,
  // same detector as the diagram's focus check). Runs when the panel opens on an
  // already-loaded shadow (which would otherwise hide the change) and whenever
  // the window regains focus. Unedited -> adopt the disk text and say so; edited
  // -> a conflict notice with Reload / Keep mine (the save-time check still
  // guards the actual overwrite either way). Never marks anything dirty — the
  // shadow now equals the disk.
  const checkOpenDetailsForChange = useEventCallback(async () => {
    const nodeId = detailsPanelNodeId
    const shadow = nodeId ? noteShadows[nodeId] : undefined
    if (!nodeId || !currentPath || !shadow || shadow.originalPath === null) return
    const [result] = await window.api.checkFiles(currentPath, [
      { relPath: shadow.originalPath, stamp: shadow.baselineStamp }
    ])
    if (!result.changed) return
    if (!shadow.dirty) {
      const { content, stamp } = await window.api.readDetailsWithStamp(
        currentPath,
        shadow.originalPath
      )
      setNoteShadows((prev) =>
        prev[nodeId] ? { ...prev, [nodeId]: adoptDisk(prev[nodeId], content, stamp) } : prev
      )
      setDetailsNotice({ nodeId, kind: 'refreshed' })
    } else if (detailsDismissedStampRef.current[nodeId] !== result.stamp) {
      setDetailsNotice({ nodeId, kind: 'conflict' })
    }
  })

  useEffect(() => {
    if (!detailsPanelNodeId) return undefined
    void checkOpenDetailsForChange()
    const onFocus = (): void => void checkOpenDetailsForChange()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [detailsPanelNodeId, checkOpenDetailsForChange])

  const reloadOpenDetailsFromDisk = useEventCallback(async () => {
    const nodeId = detailsPanelNodeId
    const shadow = nodeId ? noteShadows[nodeId] : undefined
    if (!nodeId || !currentPath || !shadow || shadow.originalPath === null) return
    const { content, stamp } = await window.api.readDetailsWithStamp(currentPath, shadow.originalPath)
    setNoteShadows((prev) =>
      prev[nodeId] ? { ...prev, [nodeId]: adoptDisk(prev[nodeId], content, stamp) } : prev
    )
    setDetailsNotice(null)
  })

  const keepMyDetailsEdits = useEventCallback(async () => {
    const nodeId = detailsPanelNodeId
    const shadow = nodeId ? noteShadows[nodeId] : undefined
    if (!nodeId || !currentPath || !shadow || shadow.originalPath === null) return
    const [result] = await window.api.checkFiles(currentPath, [
      { relPath: shadow.originalPath, stamp: shadow.baselineStamp }
    ])
    if (result.stamp !== null) detailsDismissedStampRef.current[nodeId] = result.stamp
    setDetailsNotice(null)
  })

  // Style seeded onto a brand-new edge (ADR 0045 / ADR 0083): the global
  // default-edge-style preference, overlaid with the active edge direction
  // set's own default style if one is set. An edge drawn while a reading is
  // active is thus born in that reading's look; existing edges are never
  // touched.
  const newEdgeStyle = useMemo<EdgeStyle>(
    () => ({
      ...preferences.defaultEdgeStyle,
      ...activeDirectionSetStyle(edgeDirectionSets, activeEdgeDirectionSetId)
    }),
    [preferences.defaultEdgeStyle, edgeDirectionSets, activeEdgeDirectionSetId]
  )

  // Multi-connection-line (xyflow's own documented pattern for this,
  // reactflow.dev/examples/edges/multi-connection-line, adapted to this
  // app's own explicit-connection-point-id model rather than xyflow's
  // plain "leave sourceHandle unset" version): if other connectable nodes
  // are selected when a drag completes, every one of them gets its own
  // edge to the same target, not just the node actually dragged from.
  // Dragging from a node that *isn't* selected still only ever wires that
  // one node — this only activates via a real prior selection, never as an
  // accidental side effect of an ordinary single drag.
  //
  // The dragged node's own edge keeps the exact handle the user actually
  // dropped onto (connection.sourceHandle) — every *other* selected node
  // replicates that same handle's clockwise ordinal on the same side
  // (pointOrdinal/connectionPointAtOrdinal, connectionPoints.ts), clamped to
  // however many points that side actually has, rather than each picking
  // whichever of its own points sits nearest the target (see ADR 0059's
  // addendum — nearest-to-target looked inconsistent in real use, since
  // unrelated entities rarely face the target the same way; "the same point"
  // reads as deliberate regardless of position).
  const onConnect = useCallback(
    (connection: Connection) => {
      pushSnapshot()
      setEdges((eds) => {
        const byId = new Map(nodes.map((n) => [n.id, n]))
        const sourceNode = byId.get(connection.source)
        const fromOrdinal =
          sourceNode && connection.sourceHandle
            ? pointOrdinal(
                (sourceNode.data?.connectionPoints as ConnectionPoint[] | undefined) ?? [],
                connection.sourceHandle
              )
            : undefined
        const sourceIds = nodes
          .filter(
            (n) => n.id === connection.source || (n.selected && isConnectableNodeType(n.type))
          )
          .map((n) => n.id)
        const withNew = sourceIds.reduce((acc, sourceId) => {
          const otherNode = byId.get(sourceId)
          const sourceHandle =
            sourceId === connection.source || !otherNode || !fromOrdinal
              ? connection.sourceHandle
              : connectionPointAtOrdinal(
                  (otherNode.data?.connectionPoints as ConnectionPoint[] | undefined) ?? [],
                  fromOrdinal.side,
                  fromOrdinal.ordinal
                ).id
          return addEdge(
            {
              source: sourceId,
              target: connection.target,
              sourceHandle,
              targetHandle: connection.targetHandle,
              type: 'labeled',
              data: { metadata: seedMetadata(requiredTags), style: newEdgeStyle }
            },
            acc
          )
        }, eds)
        // Seed the new edge's per-set direction records right away when the
        // diagram has 2+ direction sets (ADR 0081), rather than lazily at
        // the next switch — otherwise reversing the edge before any switch
        // would bake the reversed orientation into *every* set.
        return edgeDirectionSets.length >= 2
          ? ensureDirectionSets(withNew, edgeDirectionSets.map((s) => s.id))
          : withNew
      })
    },
    [nodes, setEdges, pushSnapshot, requiredTags, newEdgeStyle, edgeDirectionSets]
  )

  // Grabbing an existing edge's own endpoint and redropping it elsewhere —
  // distinct from onConnect (a brand-new edge dragged from a node's
  // handle). `edgesReconnectable` on <ReactFlow> is what turns this on;
  // React Flow's own `reconnectEdge` computes the updated edge, same
  // pattern as `addEdge` above. Lets a connection that made sense on one
  // side keep making sense after entities get rearranged (e.g. "left" now
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
    connectStartRef.current = params.nodeId
      ? { nodeId: params.nodeId, handleId: params.handleId }
      : null
  }, [])

  const onReconnectStart = useCallback(() => {
    isReconnectingRef.current = true
  }, [])

  // Turns a placeholder AnchorNode (see below) into a real Entity or
  // Container, in place — same id, recentered on the anchor's own center
  // rather than its (much smaller) top-left corner. No edge update needed:
  // AnchorNode shares the same 4 handle ids ('top'/'right'/'bottom'/'left')
  // as EntityNode/ContainerNode via the same ConnectionHandles component, so
  // whatever handle the edge already attached to on the anchor stays valid
  // on the resolved node too.
  const resolveAnchorNode = useCallback(
    (nodeId: string, type: 'entity' | 'container') => {
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const centerX = n.position.x + (n.width ?? ANCHOR_SIZE) / 2
          const centerY = n.position.y + (n.height ?? ANCHOR_SIZE) / 2
          const width = type === 'entity' ? ENTITY_MIN_WIDTH * 2 : CONTAINER_MIN_WIDTH * 2
          const height = type === 'entity' ? ENTITY_MIN_HEIGHT * 2 : CONTAINER_MIN_HEIGHT * 1.5
          const metadata = seedMetadata(requiredTags)
          // An anchor never has a zIndex (ADR 0035) — resolving it
          // into a real entity/container needs one now, same default as
          // addEntityNode/addContainerNode.
          const zIndex = nextZIndex(nds, type)
          const data =
            type === 'entity'
              ? { label: 'Entity', zIndex, metadata }
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
  // and offer the same Entity/Container popup drag-to-empty-space already established.
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
        { label: 'Entity', onSelect: () => resolveAnchorNode(id, 'entity') },
        { label: 'Container', onSelect: () => resolveAnchorNode(id, 'container') }
      ])
    },
    [rfInstance, pushSnapshot, setNodes, openContextMenu, resolveAnchorNode]
  )

  // Drag-to-create: releasing a connection drag over empty canvas (rather
  // than onto a valid handle) spawns a placeholder AnchorNode — see
  // ADR 0015 and isVoidDrop's own comment for why the check is more than just
  // "is event.target the pane."
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      const origin = connectStartRef.current
      connectStartRef.current = null
      if (!origin || !isVoidDrop(event, connectionState)) return

      const point = pointFromEvent(event)
      spawnAnchorAt(point.clientX, point.clientY, (anchorId) =>
        setEdges((eds) => {
          const withNew = addEdge(
            {
              source: origin.nodeId,
              sourceHandle: origin.handleId,
              target: anchorId,
              targetHandle: 'left',
              type: 'labeled',
              data: { metadata: seedMetadata(requiredTags), style: newEdgeStyle }
            },
            eds
          )
          // Seed per-set direction records immediately at 2+ sets — see
          // onConnect above.
          return edgeDirectionSets.length >= 2
            ? ensureDirectionSets(withNew, edgeDirectionSets.map((s) => s.id))
            : withNew
        })
      )
    },
    [spawnAnchorAt, setEdges, requiredTags, newEdgeStyle, edgeDirectionSets]
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

  // Drag-and-drop counterpart to the four addXNode callbacks below (see
  // ADR 0064) — those spawn near the viewport center via spawnPosition above;
  // this places a node exactly where it was dropped, centered under the
  // drop point, and reparents it into a container the same way
  // onNodeDragStop's own intersection check does for an existing node's
  // drag. It can't reuse rfInstance.getIntersectingNodes for that though —
  // the new node isn't registered with React Flow yet at drop time — so
  // this does the equivalent bounds-overlap test manually against the
  // current containers instead, using drop-point containment (simpler
  // than full-rectangle overlap, and a closer match to "I dropped it
  // here" than the drag-existing-node heuristic needs to be). Picks
  // whichever containing container has the highest zIndex if more than
  // one contains the point (nested containers), matching what's visually
  // on top.
  const addNodeAtPosition = useCallback(
    (type: PaletteItemType, dropPoint: { x: number; y: number }) => {
      pushSnapshot()
      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        const parent = nds
          .filter((n) => n.type === 'container')
          .map((n) => {
            const abs = absolutePosition(n, byId)
            return { node: n, bounds: boundsFrom(abs.x, abs.y, n.width ?? 0, n.height ?? 0) }
          })
          .filter(
            ({ bounds }) =>
              dropPoint.x >= bounds.left &&
              dropPoint.x <= bounds.right &&
              dropPoint.y >= bounds.top &&
              dropPoint.y <= bounds.bottom
          )
          .sort(
            (a, b) =>
              ((b.node.data?.zIndex as number | undefined) ?? 0) -
              ((a.node.data?.zIndex as number | undefined) ?? 0)
          )[0]?.node

        let width: number
        let height: number
        let nodeType: string
        let data: Record<string, unknown>
        switch (type) {
          case 'entity':
            width = ENTITY_MIN_WIDTH * 2
            height = ENTITY_MIN_HEIGHT * 2
            nodeType = 'entity'
            data = {
              label: 'Entity',
              zIndex: nextZIndex(nds, 'entity'),
              metadata: seedMetadata(requiredTags),
              style: preferences.defaultStyles.entity
            }
            break
          case 'container':
            width = CONTAINER_MIN_WIDTH * 2
            height = CONTAINER_MIN_HEIGHT * 1.5
            nodeType = 'container'
            data = {
              label: 'Container',
              zIndex: nextZIndex(nds, 'container'),
              style: preferences.defaultStyles.container ?? {
                fill: 'var(--ev-c-gray-1)',
                fillOpacity: 20
              },
              metadata: seedMetadata(requiredTags)
            }
            break
          case 'text':
            width = TEXT_MIN_WIDTH * 3
            height = TEXT_MIN_HEIGHT * 2
            nodeType = 'text'
            data = {
              label: 'Text',
              rotation: 0,
              zIndex: nextZIndex(nds, 'text'),
              style: preferences.defaultStyles.text
            }
            break
          case 'line': {
            const lineLength = 160
            width = lineLength + LINE_BOUNDS_PADDING * 2
            height = LINE_BOUNDS_PADDING * 2
            nodeType = 'line'
            data = {
              label: 'Line',
              zIndex: nextZIndex(nds, 'line'),
              points: [
                { x: LINE_BOUNDS_PADDING, y: LINE_BOUNDS_PADDING },
                { x: LINE_BOUNDS_PADDING + lineLength, y: LINE_BOUNDS_PADDING }
              ]
            }
            break
          }
        }

        const topLeft = { x: dropPoint.x - width / 2, y: dropPoint.y - height / 2 }
        const position = parent
          ? subtractPosition(topLeft, absolutePosition(parent, byId))
          : topLeft
        const id = newNodeId(nodeType)
        const newNode: Node = {
          id,
          type: nodeType,
          position,
          width,
          height,
          parentId: parent?.id,
          data
        }
        return sortNodesForHierarchy([...nds, newNode])
      })
    },
    [
      pushSnapshot,
      setNodes,
      requiredTags,
      preferences.defaultStyles.entity,
      preferences.defaultStyles.container,
      preferences.defaultStyles.text
    ]
  )

  // dataTransfer's actual value isn't readable during dragover in most
  // browsers (only .types is, by design) — checking .types is enough to
  // both accept the drop and tell a palette drag apart from anything else
  // that might get dragged over the canvas (a file, browser text, ...).
  const onCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(PALETTE_ITEM_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const type = event.dataTransfer.getData(PALETTE_ITEM_DRAG_TYPE) as PaletteItemType | ''
      if (!type) return
      event.preventDefault()
      addNodeAtPosition(
        type,
        rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      )
    },
    [rfInstance, addNodeAtPosition]
  )

  const addEntityNode = useCallback(() => {
    pushSnapshot()
    const id = newNodeId('entity')
    const width = ENTITY_MIN_WIDTH * 2
    const height = ENTITY_MIN_HEIGHT * 2
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'entity',
        position: spawnPosition(width, height, nds.length),
        width,
        height,
        data: {
          label: 'Entity',
          zIndex: nextZIndex(nds, 'entity'),
          metadata: seedMetadata(requiredTags),
          style: preferences.defaultStyles.entity
        }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition, requiredTags, preferences.defaultStyles.entity])

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
        data: {
          label: 'Text',
          rotation: 0,
          zIndex: nextZIndex(nds, 'text'),
          style: preferences.defaultStyles.text
        }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition, preferences.defaultStyles.text])

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
        // opening the property panel first to see anything at all. Only
        // the fallback when the user hasn't set a real default (see
        // ADR 0048) — once they have, their own choice wins outright
        // rather than merging with this hardcoded one.
        data: {
          label: 'Container',
          zIndex: nextZIndex(nds, 'container'),
          style: preferences.defaultStyles.container ?? {
            fill: 'var(--ev-c-gray-1)',
            fillOpacity: 20
          },
          metadata: seedMetadata(requiredTags)
        }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition, requiredTags, preferences.defaultStyles.container])

  // Bulk counterpart to addEntityNode/addContainerNode — see ADR 0089. One
  // pushSnapshot/setNodes for the whole batch (one undo step), laid out in
  // a grid centered on the viewport rather than spawnPosition's small
  // per-click jitter (which exists to keep repeated single clicks visibly
  // apart, not to lay out a deliberate batch). nextZIndex is recomputed
  // against the array as it grows within the same batch, so zIndex among
  // the new nodes stays deterministic (first line = lowest).
  const addMultipleNodes = useCallback(
    (type: 'entity' | 'container', labels: string[]) => {
      if (labels.length === 0) return
      pushSnapshot()
      const width = type === 'entity' ? ENTITY_MIN_WIDTH * 2 : CONTAINER_MIN_WIDTH * 2
      const height = type === 'entity' ? ENTITY_MIN_HEIGHT * 2 : CONTAINER_MIN_HEIGHT * 1.5
      const gap = 40
      const columns = Math.ceil(Math.sqrt(labels.length))
      const rows = Math.ceil(labels.length / columns)
      const center = rfInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      })
      const originX = center.x - (columns * width + (columns - 1) * gap) / 2
      const originY = center.y - (rows * height + (rows - 1) * gap) / 2

      setNodes((nds) => {
        let acc = nds
        for (let index = 0; index < labels.length; index++) {
          const col = index % columns
          const row = Math.floor(index / columns)
          const data =
            type === 'entity'
              ? {
                  label: labels[index],
                  zIndex: nextZIndex(acc, 'entity'),
                  metadata: seedMetadata(requiredTags),
                  style: preferences.defaultStyles.entity
                }
              : {
                  label: labels[index],
                  zIndex: nextZIndex(acc, 'container'),
                  style: preferences.defaultStyles.container ?? {
                    fill: 'var(--ev-c-gray-1)',
                    fillOpacity: 20
                  },
                  metadata: seedMetadata(requiredTags)
                }
          acc = [
            ...acc,
            {
              id: newNodeId(type),
              type,
              position: {
                x: originX + col * (width + gap),
                y: originY + row * (height + gap)
              },
              width,
              height,
              data
            }
          ]
        }
        return sortNodesForHierarchy(acc)
      })
    },
    [
      setNodes,
      pushSnapshot,
      rfInstance,
      requiredTags,
      preferences.defaultStyles.entity,
      preferences.defaultStyles.container
    ]
  )

  // A default 2-point horizontal line — see ADR 0050. Points are
  // node-local (relative to position), padded the same way normalizeLineBounds
  // in LineNode.tsx keeps them after any edit, so a freshly spawned line
  // and a freshly edited one look consistent.
  const addLineNode = useCallback(() => {
    pushSnapshot()
    const id = newNodeId('line')
    const lineLength = 160
    const width = lineLength + LINE_BOUNDS_PADDING * 2
    const height = LINE_BOUNDS_PADDING * 2
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'line',
        position: spawnPosition(width, height, nds.length),
        width,
        height,
        data: {
          // Matches Entity/Container/Text's own default-label-equals-type-
          // name convention (there's no on-canvas label editing for a line
          // yet, unlike those three, but the Layers panel still needs
          // something better than "(unlabeled)" to show).
          label: 'Line',
          zIndex: nextZIndex(nds, 'line'),
          points: [
            { x: LINE_BOUNDS_PADDING, y: LINE_BOUNDS_PADDING },
            { x: LINE_BOUNDS_PADDING + lineLength, y: LINE_BOUNDS_PADDING }
          ]
        }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition])

  // Alignment guides + snap-to-shape while dragging — see ADR 0019.
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
    (
      draggedNode: Node,
      nodesToMove: Node[]
    ): { dx: number; dy: number; guideX: number[]; guideY: number[] } => {
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
          ? rawNodesToProcess.map((n) => ({
              ...n,
              position: { x: n.position.x + dx, y: n.position.y + dy }
            }))
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
            .find(
              (n) =>
                n.type === 'container' && n.id !== dragged.id && !isDescendantOf(n.id, dragged.id)
            )
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
  // "Attach contained entities" menu item — encapsulating a lot of
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
        // The container must not become a child of one of its own ancestors
        // (a parent cycle → React Flow can't position the nodes → they
        // collapse to the canvas origin), and a candidate whose bounds
        // *enclose* the container shouldn't be swallowed by it either — see
        // ADR 0075. getIntersectingNodes(_, false) matches a node that fully
        // covers the container as well as one fully inside it.
        const containerIsDescendantOf = (ofId: string): boolean => {
          let current: Node | undefined = container
          while (current?.parentId) {
            if (current.parentId === ofId) return true
            current = byId.get(current.parentId)
          }
          return false
        }
        const containerAbsBox = absolutePosition(container, byId)
        const encloses = (n: Node): boolean => {
          const abs = absolutePosition(n, byId)
          return (
            abs.x <= containerAbsBox.x &&
            abs.y <= containerAbsBox.y &&
            abs.x + (n.width ?? 0) >= containerAbsBox.x + (container.width ?? 0) &&
            abs.y + (n.height ?? 0) >= containerAbsBox.y + (container.height ?? 0)
          )
        }
        const candidateIds = new Set(
          rfInstance
            .getIntersectingNodes(container, false)
            .filter(
              (n) =>
                n.id !== containerId &&
                !n.parentId &&
                !containerIsDescendantOf(n.id) &&
                !encloses(n)
            )
            .map((n) => n.id)
        )
        if (candidateIds.size === 0) return nds
        const updated = nds.map((n) => {
          if (!candidateIds.has(n.id)) return n
          const abs = absolutePosition(n, byId)
          return { ...n, parentId: containerId, position: subtractPosition(abs, containerAbsBox) }
        })
        return sortNodesForHierarchy(updated)
      })
    },
    [pushSnapshot, rfInstance, setNodes]
  )

  // One-click inverse of drag-out / "Attach contained entities" (ADR 0075):
  // clears a node's parentId and rebases its position from parent-relative
  // to absolute so it doesn't jump. Any node type can be a container child.
  const detachFromParent = useCallback(
    (nodeId: string) => {
      pushSnapshot()
      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        const node = byId.get(nodeId)
        if (!node?.parentId) return nds
        const detached = { ...node, position: absolutePosition(node, byId) }
        delete detached.parentId
        return sortNodesForHierarchy(nds.map((n) => (n.id === nodeId ? detached : n)))
      })
    },
    [pushSnapshot, setNodes]
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
  // ADR 0049), just clones selected nodes in place with a small offset and
  // selects the clones so they're immediately draggable. Edges between
  // duplicated nodes are not duplicated — same reasoning as the clipboard
  // work: that's real clipboard-shaped complexity this shortcut isn't
  // trying to take on.
  const duplicateSelected = useCallback(() => {
    if (!nodes.some((n) => n.selected)) return
    pushSnapshot()
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected)
      if (selected.length === 0) return nds
      const clones = selected.map((n) => ({
        ...n,
        id: newNodeId(n.type ?? 'entity'),
        position: { x: n.position.x + 20, y: n.position.y + 20 },
        selected: true,
        data: { ...n.data }
      }))
      return [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), ...clones]
    })
  }, [nodes, setNodes, pushSnapshot])

  // Multi-select resize (ADR 0098): every selected node shows its own
  // NodeResizer, but React Flow only resizes the one being dragged. These
  // callbacks (called from each node's NodeResizer via context) make the
  // other selected, unlocked, resizable nodes scale by the same percentage in
  // place. Their writes bypass onNodesChange, so they add no undo snapshot of
  // their own — the dragged node's own resize change already opened one.
  const groupResizeRef = useRef<{
    primaryId: string
    primaryStart: { x: number; y: number; width: number; height: number }
    members: GroupResizeMember[]
  } | null>(null)
  const groupResize = useMemo<DiagramContextValue['groupResize']>(() => {
    const minSize: Record<string, { w: number; h: number }> = {
      entity: { w: ENTITY_MIN_WIDTH, h: ENTITY_MIN_HEIGHT },
      container: { w: CONTAINER_MIN_WIDTH, h: CONTAINER_MIN_HEIGHT },
      text: { w: TEXT_MIN_WIDTH, h: TEXT_MIN_HEIGHT }
    }
    return {
      start: (id) => {
        groupResizeRef.current = null
        const all = graphRef.current.nodes
        const primary = all.find((n) => n.id === id)
        if (!primary?.selected || primary.width == null || primary.height == null) return
        const members: GroupResizeMember[] = []
        for (const n of all) {
          const min = n.type ? minSize[n.type] : undefined
          if (n.id === id || !n.selected || n.data?.locked === true || !min) continue
          if (n.width == null || n.height == null) continue
          members.push({
            id: n.id,
            start: { x: n.position.x, y: n.position.y, width: n.width, height: n.height },
            minWidth: min.w,
            minHeight: min.h
          })
        }
        if (members.length === 0) return
        groupResizeRef.current = {
          primaryId: id,
          primaryStart: {
            x: primary.position.x,
            y: primary.position.y,
            width: primary.width,
            height: primary.height
          },
          members
        }
      },
      resize: (id, params) => {
        const group = groupResizeRef.current
        if (!group || group.primaryId !== id) return
        const boxes = scaleGroupMembers(group.members, group.primaryStart, params)
        setNodes((nds) =>
          nds.map((n) => {
            const b = boxes.get(n.id)
            return b ? { ...n, position: { x: b.x, y: b.y }, width: b.width, height: b.height } : n
          })
        )
      },
      end: () => {
        groupResizeRef.current = null
      }
    }
  }, [setNodes])

  // Modifier+drag duplicate (ADR 0099), called by useModifierDragDuplicate
  // once the pointer has actually moved. Clones the dragged selection (or just
  // the grabbed node if it wasn't selected) plus every descendant of a cloned
  // container, in place, and selects the clones so the replayed drag moves
  // *them*; the originals keep their ids, edges and position. Edges between
  // cloned nodes are cloned too (like copy/paste, unlike Ctrl+D). A clone whose
  // parent wasn't cloned stays inside that same container. Opens the gesture's
  // one undo step via beginContinuousEdit; the drag's end closes it.
  const duplicateForDrag = useEventCallback((grabbedId: string): string | null => {
    const { nodes: all, edges: allEdges } = graphRef.current
    const grabbed = all.find((n) => n.id === grabbedId)
    if (!grabbed || grabbed.data?.locked === true) return null
    const roots = grabbed.selected ? all.filter((n) => n.selected) : [grabbed]
    const ids = new Set(roots.map((n) => n.id))
    for (let grew = true; grew; ) {
      grew = false
      for (const n of all) {
        if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
          ids.add(n.id)
          grew = true
        }
      }
    }
    const idMap = new Map<string, string>()
    for (const n of all) if (ids.has(n.id)) idMap.set(n.id, newNodeId(n.type ?? 'entity'))
    const clones = all
      .filter((n) => ids.has(n.id))
      .map((n) => {
        const clone: Node = {
          ...n,
          id: idMap.get(n.id)!,
          selected: true,
          dragging: false,
          data: structuredClone(n.data)
        }
        if (n.parentId) clone.parentId = idMap.get(n.parentId) ?? n.parentId
        return clone
      })
    const edgeClones = allEdges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => {
        const data: Record<string, unknown> = { ...e.data }
        delete data.directionSets
        return {
          ...e,
          id: newNodeId('edge'),
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          selected: false,
          data
        }
      })
    beginContinuousEdit()
    setNodes((nds) =>
      sortNodesForHierarchy([
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...clones
      ])
    )
    if (edgeClones.length > 0) setEdges((eds) => [...eds, ...edgeClones])
    return idMap.get(grabbedId) ?? null
  })

  // Under Edit, via AlignDistributePanel — "Align Vertically" stacks the
  // selection top-to-bottom (all sharing the leftmost element's left edge,
  // `gapPx` of clear space between each element's bottom and the next
  // one's top); "Align Horizontally" is the same arranged left-to-right.
  // Order along the moving axis follows each element's own current
  // position (not selection order), so re-running it is idempotent.
  //
  // Computed in each node's absolute canvas position (absolutePosition),
  // not its raw — possibly parent-relative — position field, so a
  // selection spanning nodes inside different containers still measures
  // real on-screen gaps; the result is converted back to parent-relative
  // before writing, same pattern already used for reparenting (see
  // setContainerForNodes above). `n.width`/`n.height` are React Flow's own
  // measured size (matches the drag-time alignment guides' use of the same
  // fields, alignment.ts) — set once a node has actually rendered, which
  // is always true for anything selectable on screen.
  const alignSelected = useCallback(
    (axis: 'vertical' | 'horizontal', gapPx: number) => {
      const selected = nodes.filter((n) => n.selected)
      if (selected.length < 2) return
      pushSnapshot()
      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        const targets = nds.filter((n) => n.selected)
        const withAbs = targets.map((n) => ({
          node: n,
          abs: absolutePosition(n, byId),
          width: n.width ?? 0,
          height: n.height ?? 0
        }))
        const primaryAxis = axis === 'vertical' ? 'y' : 'x'
        const crossAxis = axis === 'vertical' ? 'x' : 'y'
        const primarySize = axis === 'vertical' ? 'height' : 'width'
        withAbs.sort((a, b) => a.abs[primaryAxis] - b.abs[primaryAxis])
        const crossValue = Math.min(...withAbs.map((w) => w.abs[crossAxis]))
        let cursor = withAbs[0].abs[primaryAxis]
        const nextAbs = new Map<string, { x: number; y: number }>()
        for (const w of withAbs) {
          nextAbs.set(
            w.node.id,
            axis === 'vertical' ? { x: crossValue, y: cursor } : { x: cursor, y: crossValue }
          )
          cursor += w[primarySize] + gapPx
        }
        return nds.map((n) => {
          const abs = nextAbs.get(n.id)
          if (!abs) return n
          const parent = n.parentId ? byId.get(n.parentId) : undefined
          const position = parent ? subtractPosition(abs, absolutePosition(parent, byId)) : abs
          return { ...n, position }
        })
      })
    },
    [nodes, setNodes, pushSnapshot]
  )

  // Repeated Ctrl+V of the *same* copied content cascades diagonally
  // (+20px per repeat) so pastes don't stack exactly on top of each other
  // — standard clipboard-paste convention. Resets whenever the clipboard
  // text actually changes (a new copy, or something copied elsewhere).
  const lastPasteRef = useRef<{ text: string; count: number } | null>(null)

  // Real clipboard copy/paste — see ADR 0049. Copy is a pure read (no
  // undo snapshot needed, diagram state doesn't change); paste/cut do.
  const copySelection = useCallback(() => {
    const selected = nodes.filter((n) => n.selected)
    if (selected.length === 0) return
    const payload = buildClipboardPayload(selected, edges, currentPath)
    window.api.copyToClipboard(JSON.stringify(payload))
    // A fresh copy starts a new paste-cascade sequence.
    lastPasteRef.current = null
  }, [nodes, edges, currentPath])

  const pasteFromClipboard = useCallback(() => {
    const text = window.api.readClipboardText()
    const payload = parseClipboardPayload(text)
    if (!payload || payload.nodes.length === 0) return
    const cascade = lastPasteRef.current?.text === text ? lastPasteRef.current.count + 1 : 0
    lastPasteRef.current = { text, count: cascade }

    // Viewport center, not the copied position — pasting into a different
    // window/diagram entirely (this app is one real window per diagram,
    // ADR 0023) makes "wherever it was copied from" meaningless, and even
    // same-window the view may have panned/zoomed since the copy. See
    // remapForPaste's own comment.
    const screenCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const center = rfInstance.screenToFlowPosition(screenCenter)
    const offset = cascade * 20
    const { nodes: pastedNodes, edges: pastedEdges } = remapForPaste(
      payload,
      newNodeId,
      { x: center.x + offset, y: center.y + offset },
      currentPath
    )

    pushSnapshot()
    // sortNodesForHierarchy: a pasted container + its children can arrive in
    // any order, and React Flow requires a parent earlier in the array than
    // its children — see remapForPaste (ADR 0075). Captured out of the
    // updater (rather than closing over `nodes`) so the post-paste scan
    // below sees the actual applied result, not a possibly-stale snapshot.
    let nextNodes: Node[] = []
    setNodes((nds) => {
      nextNodes = sortNodesForHierarchy([
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...pastedNodes
      ])
      return nextNodes
    })
    setEdges((eds) => [
      ...eds.map((e) => (e.selected ? { ...e, selected: false } : e)),
      ...pastedEdges
    ])
    // A cross-diagram paste can introduce a resource path (icon/details/
    // linkedDiagram/reference) that doesn't resolve at the new location —
    // rescan immediately rather than waiting for the next load or manual
    // Recheck, same "surface it the moment it happens" reasoning as a
    // compiler flagging an unresolved import right away. retargetNodeData
    // (clipboard.ts) never makes a broken reference resolve on its own, so
    // this is still the only thing that actually tells the user.
    void scanMissingFiles(nextNodes, legend, currentPath)
  }, [rfInstance, pushSnapshot, setNodes, setEdges, currentPath, legend, scanMissingFiles])

  const cutSelection = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length === 0) return
    copySelection()
    // deleteElements, not a hand-rolled filter — reuses the exact same
    // cascade React Flow's own Delete-key handling uses (container
    // children promotion, ADR 0012, is wired into onNodesChange, which
    // this goes through same as any other removal).
    rfInstance.deleteElements({ nodes: selectedNodes, edges: edges.filter((e) => e.selected) })
  }, [nodes, edges, copySelection, rfInstance])

  // Property panel writes — bypass onNodesChange/onEdgesChange
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
            ? {
                ...n,
                data: {
                  ...n.data,
                  style: { ...(n.data?.style as NodeStyle | undefined), ...patch }
                }
              }
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
            ? {
                ...e,
                data: {
                  ...e.data,
                  style: { ...(e.data?.style as EdgeStyle | undefined), ...patch }
                }
              }
            : e
        )
      )
    },
    [setEdges]
  )

  // Layer panel drag-reorder (ADR 0035) — a discrete action, not
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
          .map((n) => ({
            id: n.id,
            type: n.type,
            zIndex: (n.data?.zIndex as number | undefined) ?? 0
          }))
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

  // Metadata section writes (ADR 0022) — same bypass-onNodesChange pattern
  // as updateNodeStyle/updateEdgeStyle above; undo grouping is MetadataSection's
  // own job (it calls pushSnapshot before each commit), not duplicated here.
  const updateNodeMetadata = useCallback(
    (nodeId: string, metadata: Record<string, MetadataEntry> | undefined) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, metadata } } : n))
      )
    },
    [setNodes]
  )

  const updateEdgeMetadata = useCallback(
    (edgeId: string, metadata: Record<string, MetadataEntry> | undefined) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, metadata } } : e))
      )
    },
    [setEdges]
  )

  // Connection point count field (ADR 0036) — a discrete,
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
      const { points, handleReassignments } = setSideCustomPointCount(
        customPoints,
        side,
        totalCount
      )
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, connectionPoints: points } } : n
        )
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
          nodeIds.includes(n.id)
            ? { ...n, data: { ...n.data, locked: locked ? true : undefined } }
            : n
        )
      )
    },
    [setNodes]
  )

  // Saves the diagram AND the detail notes it owns as one operation (ADR 0092)
  // and syncs canvas state to whatever actually got written — the one place a
  // diagram is persisted to disk, so every save-adjacent flow (manual save,
  // link creation, forward link navigation) goes through the same path.
  //
  // The macro flow lives here and hides the detail: build the desired file set
  // (a note's path follows its label, derived now, never stored) -> plan
  // (planSave: which files are written/moved, is the diagram itself rewritten?)
  // -> main verifies every file it would overwrite against the disk and applies
  // the writes in the crash-safe order. A conflict writes nothing; the user is
  // asked once and the same request is re-sent with overwrite. Only files with
  // something to save are touched — editing one note does not rewrite the
  // diagram file unless a path in it changes. forceHub: the caller changed the
  // diagram itself outside the normal dirty tracking (link creation).
  const persistDiagram = useCallback(
    async (
      path: string,
      nodesToSave: Node[],
      opts?: { forceHub?: boolean }
    ): Promise<Node[]> => {
      // Apply any staged missing-file removals (ADR 0084) — this is the one
      // point they reach disk. Also drop them from `legend` and close any
      // now-orphaned reference windows.
      let savedNodes = nodesToSave
      let legendToSave = legend
      for (const entry of stagedFileRemovals) {
        const r = applyMissingFileRemoval(savedNodes, legendToSave, entry)
        savedNodes = r.nodes
        legendToSave = r.legend
      }

      // Save As / first save: paths relative to the old location are meaningless.
      const baseline = hubBaselineRef.current
      const newLocation = baseline.path !== path
      const notes: PlanNoteInput[] = []
      for (const n of savedNodes) {
        const nodeDetailsPath = typeof n.data?.details === 'string' ? n.data.details : null
        const shadow = noteShadows[n.id]
        if (nodeDetailsPath === null && !shadow) continue
        const label = typeof n.data?.label === 'string' ? n.data.label : ''
        notes.push({
          nodeId: n.id,
          desiredPath: derivedDetailsPath(path, n.id, label),
          nodeDetailsPath,
          shadow
        })
      }
      const plan = planSave({
        hubDirty: hubDirty || !!opts?.forceHub || newLocation || stagedFileRemovals.length > 0,
        newLocation,
        notes
      })

      // Sets (or, for null, removes) each listed node's note path.
      const withPaths = (list: Node[], paths: Record<string, string | null>): Node[] =>
        list.map((n) => {
          const p = paths[n.id]
          if (p === undefined || (n.data?.details ?? null) === p) return n
          const data = { ...n.data }
          if (p === null) delete data.details
          else data.details = p
          return { ...n, data }
        })
      savedNodes = withPaths(savedNodes, plan.finalPaths)

      // Where each note's node points if that note does not reach its new path
      // (held back by a conflict, or nothing to move): its old path, or none.
      const fallbackPaths: Record<string, string | null> = {}
      const sentContent: Record<string, string> = {}
      for (const op of plan.ops) {
        fallbackPaths[op.nodeId] = op.from
        if (op.kind === 'write') sentContent[op.nodeId] = op.content
      }
      const buildDiagram = (list: Node[]): DiagramFile =>
        toDiagramFile(
          list,
          edges,
          diagramMetadata,
          requiredTags,
          highlights,
          legendToSave,
          gravityPresets,
          diagramMaxConnectionPointsPerSide,
          edgeDirectionSets,
          activeEdgeDirectionSetId,
          security
        )
      const request: SaveDocumentRequest = {
        diagramPath: path,
        sessionId: sessionIdRef.current,
        diagram: buildDiagram(savedNodes),
        writeHub: plan.writeHub,
        expectedHubStamp: newLocation ? null : baseline.stamp,
        ops: plan.ops,
        fallbackPaths,
        overwrite: false
      }

      // Records what actually reached disk on each note's shadow; text typed
      // while the save was in flight stays dirty (markSaved).
      const applyNoteResults = (results: Record<string, SavedNote>): void => {
        setNoteShadows((prev) => {
          const next = { ...prev }
          for (const [id, r] of Object.entries(results)) {
            const shadow = next[id]
            if (shadow) {
              next[id] = markSaved(shadow, r.path, r.stamp, sentContent[id] ?? shadow.baselineContent)
            }
          }
          return next
        })
      }
      const completed = new Set<string>()
      let hubWrittenEver = false
      const applySaved = (o: Extract<SaveOutcome, { status: 'saved' }>): void => {
        applyNoteResults(o.notes)
        for (const id of Object.keys(o.notes)) completed.add(id)
        if (o.hubWritten) {
          hubBaselineRef.current = { path, stamp: o.hubStamp }
          hubWrittenEver = true
        }
        if (o.warnings.length > 0) showAlert(o.warnings.join('\n'))
      }
      const failure = (o: Extract<SaveOutcome, { status: 'failed' }>): Error => {
        applyNoteResults(o.notes)
        if (o.hubWritten) hubBaselineRef.current = { path, stamp: o.hubStamp }
        return new Error(
          `${o.error} (${Object.keys(o.notes).length} note file(s) had already been written; the diagram file ${o.hubWritten ? 'was' : 'was not'} written)`
        )
      }

      // Save everything that can be saved first; conflicts (edited here AND
      // changed on disk) are held back by main and handled at the end.
      const first = await window.api.saveDocument(request)
      if (first.status === 'failed') throw failure(first)
      applySaved(first)
      let aborted = false
      let hubToReload = false
      if (first.conflicts.length > 0) {
        // What is left unsaved now exists only in memory until the user decides,
        // so snapshot it BEFORE asking: a crash during the popup or after Cancel
        // must still be recoverable. The periodic autosave can't be relied on
        // here — it may not have run yet, and an older snapshot predates the
        // diagram file just written, so recovery would ignore it.
        try {
          const heldPaths: Record<string, string | null> = {}
          const drafts: Record<string, string> = {}
          const baselines: Record<string, NoteBaseline> = {}
          for (const op of plan.ops) {
            if (completed.has(op.nodeId)) continue
            heldPaths[op.nodeId] = fallbackPaths[op.nodeId]
            const shadow = noteShadows[op.nodeId]
            if (op.kind === 'write' && shadow) {
              drafts[op.nodeId] = op.content
              baselines[op.nodeId] = {
                originalPath: shadow.originalPath,
                stamp: shadow.baselineStamp,
                baselineContent: shadow.baselineContent
              }
            }
          }
          await window.api.writeRecoverySnapshot(
            path,
            sessionIdRef.current,
            buildDiagram(withPaths(savedNodes, heldPaths)),
            drafts,
            baselines
          )
        } catch {
          // Best effort — never let the safety net block the save flow.
        }
        const items: ConflictItem[] = first.conflicts.map((c) =>
          c.kind === 'hub'
            ? { key: HUB_KEY, kind: 'hub', label: 'The diagram file' }
            : {
                key: c.nodeId ?? '',
                kind: 'note',
                label: detailsNoteName(savedNodes.find((n) => n.id === c.nodeId))
              }
        )
        const decisions = await askConflictResolution(items)
        if (decisions === null) {
          aborted = true
        } else {
          // Per-file resolution (ADR 0092): what to overwrite, what to take from disk.
          const pendingOps = plan.ops.filter((op) => first.remaining.nodeIds.includes(op.nodeId))
          const resolution = resolveConflicts(pendingOps, decisions)
          for (const id of resolution.adoptDiskNodeIds) {
            delete sentContent[id] // my text is being discarded, never recorded as saved
            const shadow = noteShadows[id]
            if (!shadow || shadow.originalPath === null) continue
            const disk = await window.api.readDetailsWithStamp(path, shadow.originalPath)
            setNoteShadows((prev) =>
              prev[id] ? { ...prev, [id]: adoptDisk(prev[id], disk.content, disk.stamp) } : prev
            )
          }
          if (resolution.runOps.length > 0 || resolution.writeHub) {
            const second = await window.api.saveDocument({
              ...request,
              ops: resolution.runOps,
              writeHub: resolution.writeHub,
              overwrite: true
            })
            if (second.status === 'failed') throw failure(second)
            applySaved(second)
          }
          hubToReload = resolution.reloadHub
          // Everything is resolved now, so the snapshot taken before asking is stale
          // (it would offer to "recover" edits that were just saved or discarded). If
          // the diagram is being reloaded, autosave re-snapshots any kept note edits.
          await window.api.deleteRecoverySnapshot(path, sessionIdRef.current)
          await window.api.deleteRecoverySnapshot(null, sessionIdRef.current)
        }
      }

      // The user took the disk's version of the diagram: reload it (unsaved notes
      // are kept) and stop — the plan above was built from state that just changed.
      if (hubToReload) {
        await reloadHubRef.current?.(path)
        showAlert(
          'The diagram was reloaded from disk. Your unsaved note edits were kept — review, then save again.'
        )
        throw new SaveAbortedError()
      }

      // A note that did not complete (missing source, or still held back) leaves
      // its node pointing at the old path.
      const notDone: Record<string, string | null> = {}
      for (const op of plan.ops) if (!completed.has(op.nodeId)) notDone[op.nodeId] = fallbackPaths[op.nodeId]
      savedNodes = withPaths(savedNodes, notDone)

      // Notes of elements that no longer exist have nothing left to save.
      const liveIds = new Set(savedNodes.map((n) => n.id))
      setNoteShadows((prev) =>
        Object.keys(prev).every((id) => liveIds.has(id))
          ? prev
          : Object.fromEntries(Object.entries(prev).filter(([id]) => liveIds.has(id)))
      )

      // The diagram's own state is only finalised if it was actually written (or
      // there was nothing to write). If it was held back it stays dirty and
      // staged removals stay staged, so the next save retries them.
      if (hubWrittenEver || !plan.writeHub) {
        setNodes(savedNodes)
        if (legendToSave !== legend) setLegend(legendToSave)
        if (stagedFileRemovals.length > 0) {
          const removedRefs = new Set(
            stagedFileRemovals
              .filter((e) => e.resourceKind === 'reference')
              .map((e) => `${e.ownerId}::${e.relativePath}`)
          )
          if (removedRefs.size > 0) {
            setReferenceWindows((prev) =>
              prev.filter((w) => !removedRefs.has(`${w.nodeId}::${w.path}`))
            )
          }
          setStagedFileRemovals([])
        }
        setHubDirty(false)
        setExternalChangeStamp(null)
        dismissedStampRef.current = null
      }
      // Something stayed unsaved (the user cancelled): not a "Saved" moment.
      if (aborted) throw new SaveAbortedError()
      return savedNodes
    },
    [
      edges,
      setNodes,
      setLegend,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      stagedFileRemovals,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      hubDirty,
      noteShadows
    ]
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
        if (isSaveAborted(error)) return
        showAlert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, nodes, persistDiagram, flashSaved]
  )

  const handleSave = useCallback(() => performSave(false), [performSave])
  const handleSaveAs = useCallback(() => performSave(true), [performSave])

  // PNG export (ADR 0051). Selection outlines and resize/
  // connection-point handles render conditionally inside each node's own
  // DOM based on node.selected — deselecting everything first (flushSync
  // so the DOM actually updates before html-to-image reads it, since a
  // plain setNodes/setEdges wouldn't commit until after this function
  // returns) keeps them out of the exported image without this function
  // needing to know how each node type draws its own selected state.
  // Restored afterward either way, including on failure. choice comes from
  // ExportPngDialog, not settings directly — the dialog is the actual
  // place these get edited; preferences.pngExport* only remembers the last
  // choice so the dialog reopens prefilled.
  const handleExportPng = useCallback(
    async (choice: PngExportChoice) => {
      const viewportEl = flowWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
      if (!viewportEl) return
      const previouslySelectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
      const previouslySelectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id)
      try {
        flushSync(() => {
          // Mount every node/edge (onlyRenderVisibleElements, ADR 0073) so
          // the .react-flow__viewport clone below isn't missing off-screen
          // content.
          setIsExportingPng(true)
          setNodes((current) => current.map((n) => (n.selected ? { ...n, selected: false } : n)))
          setEdges((current) => current.map((e) => (e.selected ? { ...e, selected: false } : e)))
        })
        // Just-mounted off-screen nodes need their handle bounds measured
        // before their edges will render (EdgeWrapper returns null for an
        // edge whose endpoints aren't initialized — see loadDiagramIntoCanvas)
        // — same synchronous-measure fix, then wait a frame for the commit.
        updateNodeInternals(nodes.map((n) => n.id))
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
        const legendItems = buildExportLegendItems(
          legend,
          highlights,
          enabledHighlightIds,
          directionSetLegendRow(edgeDirectionSets, activeEdgeDirectionSetId)
        )
        const dataUrl = await captureDiagramPng(
          nodes,
          edges.map((e) => ({ source: e.source, target: e.target })),
          viewportEl,
          {
            paddingPx: choice.paddingPx,
            transparentBackground: choice.transparentBackground,
            backgroundColorOverride: choice.backgroundColorOverride,
            legend:
              legendItems.length > 0
                ? { items: legendItems, corner: choice.legendCorner, diagramPath: currentPath }
                : undefined
          }
        )
        const suggestedFilename = currentPath
          ? currentPath
              .split(/[\\/]/)
              .pop()!
              .replace(/\.chd$/, '.png')
          : 'diagram.png'
        await window.api.exportPngToFile(dataUrl, suggestedFilename)
      } catch (error) {
        showAlert(`PNG export failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setIsExportingPng(false)
        setNodes((current) =>
          current.map((n) =>
            previouslySelectedNodeIds.includes(n.id) ? { ...n, selected: true } : n
          )
        )
        setEdges((current) =>
          current.map((e) =>
            previouslySelectedEdgeIds.includes(e.id) ? { ...e, selected: true } : e
          )
        )
      }
    },
    [
      nodes,
      edges,
      setNodes,
      setEdges,
      currentPath,
      legend,
      highlights,
      enabledHighlightIds,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      updateNodeInternals
    ]
  )

  // Refs can't be read during render (React lint rule, and genuinely
  // unsafe under concurrent rendering) — so ExportPngDialog's color-swatch
  // preview is computed here, once, right as the dialog opens, rather than
  // inline in JSX on every render.
  useEffect(() => {
    if (!exportPngDialogOpen) return
    const viewportEl = flowWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    setExportPngEffectiveColorHex(
      viewportEl ? rgbStringToHex(resolveEffectiveBackgroundColor(viewportEl)) : '#ffffff'
    )
  }, [exportPngDialogOpen])

  // The one place that applies a loaded DiagramFile to all canvas state —
  // called by this window's own initial-load mount effect below (a window
  // never loads a *different* diagram into itself after that; File Open
  // and both link-navigation flows all open new windows instead, ADR
  // 0023). Also resets any panel/menu state, defensively, in case this
  // ever gets a second caller again.
  const loadDiagramIntoCanvas = useCallback(
    (
      path: string | null,
      diagram: DiagramFile,
      stamp?: Stamp,
      opts?: { keepNoteShadows?: boolean }
    ) => {
      // The hub's baseline: a fresh disk read supplies its stamp; a blank
      // diagram has none; loading recovered content over an already-read path
      // keeps the baseline of the file that is really on disk.
      if (stamp !== undefined) hubBaselineRef.current = { path, stamp }
      else if (path === null) hubBaselineRef.current = { path: null, stamp: null }
      const {
        nodes: openedNodes,
        edges: openedEdges,
        metadata: openedMetadata,
        requiredTags: openedRequiredTags,
        highlights: openedHighlights,
        legend: openedLegend,
        gravityPresets: openedGravityPresets,
        maxConnectionPointsPerSide: openedMaxConnectionPointsPerSide,
        edgeDirectionSets: openedEdgeDirectionSets,
        activeEdgeDirectionSetId: openedActiveEdgeDirectionSetId,
        security: openedSecurity,
        hierarchyNotes: openedHierarchyNotes
      } = fromDiagramFile(diagram)
      // A different diagram entirely — old undo history doesn't apply to
      // it (and, worse, undoing across a load boundary would try to
      // restore a previous diagram's nodes into the wrong file context).
      setPast([])
      setFuture([])
      setHubDirty(false)
      // React Flow measures every freshly-mounted node's real DOM size via
      // ResizeObserver and reports it back as a 'dimensions' NodeChange
      // with resizing left undefined — indistinguishable, by shape alone,
      // from onNodesChange's own "discrete edit" classification below for
      // a scripted dimension change. Harmless before dirty-tracking existed
      // (just an extra no-op undo entry), but now that pushSnapshot also marks the
      // diagram dirty, that same auto-measurement pass falsely dirtied
      // every single load. Suppressed for a short window after any load.
      suppressAutoMeasureUntilRef.current = Date.now() + 500
      setNodes(openedNodes)
      setEdges(openedEdges)
      // On a large diagram, React Flow's own passive ResizeObserver-driven
      // measurement of every node's handle bounds can take an unpredictable
      // number of render passes to fully settle (found live-testing the
      // Meridian Rail landscape, 82 nodes/84 edges: edges silently failed
      // to render — no error, since @xyflow/react's EdgeWrapper just
      // returns null for any edge whose endpoints aren't "initialized" yet
      // — sometimes never catching up on its own). updateNodeInternals
      // measures a node's handle bounds synchronously via direct DOM reads
      // (see @xyflow/system's updateNodeInternals) rather than waiting on
      // that passive observer, so forcing it for every just-loaded node
      // makes every edge resolve immediately and deterministically instead
      // of racing. Deferred one frame (rAF) since the node elements this
      // targets by data-id don't exist in the DOM until after this render
      // commits.
      requestAnimationFrame(() => updateNodeInternals(openedNodes.map((n) => n.id)))
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
      setGravityPresets(openedGravityPresets)
      setDiagramMaxConnectionPointsPerSide(openedMaxConnectionPointsPerSide)
      setEdgeDirectionSets(openedEdgeDirectionSets)
      setActiveEdgeDirectionSetId(openedActiveEdgeDirectionSetId)
      setSecurity(openedSecurity)
      setHierarchyLoadNotes(openedHierarchyNotes)
      if (opts?.keepNoteShadows) {
        // A reload replaces the diagram only — notes are independent files with their
        // own state. Unsaved note edits are kept (clean copies are just a cache and are
        // re-read on demand); edits for an element the reloaded diagram no longer has
        // can't be shown, so say so rather than dropping them silently.
        const live = new Set(openedNodes.map((n) => n.id))
        const kept: Record<string, NoteShadow> = {}
        let lost = 0
        for (const [id, shadow] of Object.entries(noteShadowsRef.current)) {
          if (!shadow.dirty) continue
          if (live.has(id)) kept[id] = shadow
          else lost++
        }
        setNoteShadows(kept)
        if (lost > 0) {
          showAlert(
            `The reloaded diagram no longer contains ${lost} element(s) whose notes had unsaved edits; those edits were discarded.`
          )
        }
      } else {
        setNoteShadows({})
      }
      detailsDismissedStampRef.current = {}
      setDetailsNotice(null)
      setExternalChangeStamp(null)
      dismissedStampRef.current = null
      setContextMenu(null)
      setIconPicker(null)
      setColorPicker(null)
      setLinePicker(null)
      setDetailsPanelNodeId(null)
      setDiagnosticsPanelOpen(false)
      setHighlightsPanelOpen(false)
      setPreferencesPanelOpen(false)
      setAlignDistributePanelOpen(false)
      setDiagramSettingsPanelOpen(false)
      setReferencesPanelOpen(false)
      setChangesPanelOpen(false)
      setChangesDiff(null)
      setReferenceWindows([])
      setSearchOverlayOpen(false)
      setSearchQuery('')
      setDeepSearchEnabled(false)
      setSearchMatchIds(new Set())
      setSearchMatchOrder([])
      setSearchMatchCursor(0)
      setSearchRun(false)
      setIsolateActive(false)
      setSearchIcon(null)
      setSearchIconPicker(null)
      setSearchUnreadable([])
      // Defensive, per ADR 0022 — reconcile against hand-edited drift on
      // every load, not just when the template is edited from within the app.
      runSync(openedRequiredTags)
      // ADR 0084 — surface missing referenced files in Diagnostics.
      void scanMissingFiles(openedNodes, openedLegend, path)
    },
    [rfInstance, setNodes, setEdges, runSync, scanMissingFiles, updateNodeInternals]
  )

  // A window opened with an initial diagram (File -> Open, or either
  // link-navigation flow) gets it via a ?path= query string on its URL —
  // read here rather than in main, so this reuses the same tested load
  // path as everything else instead of duplicating file-read logic
  // (ADR 0023). Ref-guarded, not an empty deps array, so this survives
  // React StrictMode's dev-mode double-invoke and doesn't re-fire if
  // loadDiagramIntoCanvas's identity changes across renders — see ADR 0018
  // for why this file is careful about effect double-runs.
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    const path = new URLSearchParams(window.location.search).get('path')
    if (!path) return
    window.api
      .openDiagramAtPath(path)
      .then(async ({ diagram, stamp }) => {
        loadDiagramIntoCanvas(path, diagram, stamp)
        // Crash recovery (ADR 0040) — a snapshot newer than the
        // real file means the last session ended without saving (crash or
        // force-quit). Prompted, not silently preferred, so a stale
        // recovery snapshot can never clobber a real out-of-app edit.
        const recovered = await window.api.checkRecoveryForPath(path)
        if (!recovered) return
        if (
          confirm(
            'Unsaved changes from an unexpected close were found for this diagram. Recover them?'
          )
        ) {
          loadDiagramIntoCanvas(path, recovered.diagram)
          setNoteShadows(shadowsFromSnapshot(recovered))
          markDirty()
        } else {
          window.api.deleteRecoverySnapshot(path, sessionIdRef.current)
        }
      })
      .catch((error) => {
        showAlert(`Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`)
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
      setNoteShadows(shadowsFromSnapshot(snapshot))
      markDirty()
    })
  }, [loadDiagramIntoCanvas, markDirty])

  // Periodic autosave (ADR 0040) — every 5 s (was 60 s; an edit made and then
  // killed within the minute was simply lost), but only while isDirty AND only if
  // something changed since the last snapshot (same object references = nothing
  // to write), so an idle dirty window costs nothing. Refs, not effect deps, carry the
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
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    noteShadows
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
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      noteShadows
    }
  })
  const lastSnapshotStateRef = useRef<typeof autosaveStateRef.current | null>(null)
  useEffect(() => {
    const interval = setInterval(() => {
      const s = autosaveStateRef.current
      if (!s.isDirty) return
      const last = lastSnapshotStateRef.current
      if (last && (Object.keys(s) as (keyof typeof s)[]).every((k) => last[k] === s[k])) return
      lastSnapshotStateRef.current = s
      const diagram = toDiagramFile(
        s.nodes,
        s.edges,
        s.diagramMetadata,
        s.requiredTags,
        s.highlights,
        s.legend,
        s.gravityPresets,
        s.diagramMaxConnectionPointsPerSide,
        s.edgeDirectionSets,
        s.activeEdgeDirectionSetId,
        s.security
      )
      window.api.writeRecoverySnapshot(
        s.currentPath,
        sessionIdRef.current,
        diagram,
        dirtyDrafts(s.noteShadows),
        dirtyBaselines(s.noteShadows)
      )
    }, 5_000)
    return () => clearInterval(interval)
  }, [rfInstance])

  // Real OS window close (close button, Alt+F4) — main intercepts it and
  // asks the renderer whether it's safe to proceed (ADR 0040).
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
        if (isSaveAborted(error)) return null
        showAlert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
        return null
      }
    },
    [persistDiagram]
  )

  // One-line change-count for the close-prompt's native dialog (epic 0117,
  // ADR 0102) — reads the same autosaveStateRef the autosave snapshot uses,
  // for the same "don't rebind this listener on every nodes/edges change"
  // reason. Best-effort: any failure (e.g. an unreadable file) just omits
  // the detail line rather than blocking the close flow.
  const buildCloseChangesSummary = useCallback(async (): Promise<string | undefined> => {
    const s = autosaveStateRef.current
    try {
      const saved = s.currentPath
        ? ((await window.api.rereadDiagramForDiff(s.currentPath)) ?? createEmptyDiagram())
        : createEmptyDiagram()
      const current = toDiagramFile(
        s.nodes,
        s.edges,
        s.diagramMetadata,
        s.requiredTags,
        s.highlights,
        s.legend,
        s.gravityPresets,
        s.diagramMaxConnectionPointsPerSide,
        s.edgeDirectionSets,
        s.activeEdgeDirectionSetId,
        s.security
      )
      return summarizeChanges(diffDiagrams(saved, current)) || undefined
    } catch {
      return undefined
    }
  }, [])

  useEffect(() => {
    return window.api.onCloseRequested(async () => {
      const {
        isDirty: dirtyNow,
        currentPath: pathNow,
        nodes: nodesNow
      } = closeCheckStateRef.current
      if (!dirtyNow) {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const decision = await window.api.requestCloseDecision(await buildCloseChangesSummary())
      if (decision === 'cancel') return
      if (decision === 'discard') {
        window.api.closeApproved(pathNow, sessionIdRef.current)
        return
      }
      const savedPath = await performSaveNow(nodesNow, pathNow)
      if (savedPath) window.api.closeApproved(savedPath, sessionIdRef.current)
    })
  }, [performSaveNow, buildCloseChangesSummary])

  // "Save changes, Open Here" (drop onto a dirty window) —
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

  // Drag-and-drop a .chd onto this window — attached to the
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
        showAlert('Only .chd diagram files can be opened this way.')
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
      showAlert(`Open failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [nodes, edges])

  // Always opens a new window, never replaces the current one — see
  // ADR 0023. No file is written, nothing is linked from anywhere.
  const handleNew = useCallback(() => {
    window.api.newWindow()
  }, [])

  // File -> Recent Diagrams -> (an entry). Opens/focuses a window for the
  // path exactly like following a link, except this window is reused
  // in-place if its own diagram is currently empty — same "nothing to
  // lose" rule as handleOpen/drag-and-drop. On a file that's since been
  // moved/deleted, main prunes it from the list and reports found:false —
  // the list re-renders without it once the preferences broadcast lands.
  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        const result = await window.api.openRecentDiagram(
          path,
          nodes.length === 0 && edges.length === 0
        )
        if (!result.found)
          showAlert(`Diagram not found — it may have been moved or deleted:\n${path}`)
      } catch (error) {
        showAlert(`Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [nodes, edges]
  )

  const handleClearRecent = useCallback(() => {
    updatePreferences({ recentDiagrams: [] })
  }, [updatePreferences])

  // File -> Close — NOT closing the OS window (this app's own
  // convention, confirmed with the user: a window is a diagram, not
  // necessarily disposable). Discards the current diagram back to a blank
  // one *in this same window*, reusing loadDiagramIntoCanvas — the same
  // full-state reset every other load path already goes through — rather
  // than duplicating a scattered set of individual setState(initial) calls.
  // Now that isDirty exists, the confirm() guard is skipped
  // whenever there's genuinely nothing to lose, not just when the canvas
  // happens to be empty (a diagram can be dirty while empty too — add a
  // entity, delete it again — so this is a real behavior change from before).
  const handleClose = useCallback(() => {
    if (isDirty && !confirm('Close this diagram? Any changes since the last save will be lost.'))
      return
    loadDiagramIntoCanvas(null, {
      version: 1,
      nodes: [],
      edges: []
    })
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
  // dirty-aware — a clean window reloads without prompting.
  const handleReload = useCallback(async () => {
    if (!currentPath) return
    if (
      hubDirty &&
      !confirm(
        'Reload from disk? Unsaved changes to the diagram itself will be lost (unsaved note edits are kept).'
      )
    )
      return
    try {
      const { diagram, stamp } = await window.api.openDiagramAtPath(currentPath)
      loadDiagramIntoCanvas(currentPath, diagram, stamp, { keepNoteShadows: true })
    } catch (error) {
      showAlert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [currentPath, hubDirty, loadDiagramIntoCanvas])

  // Used by the save-conflict dialog's "Take disk" for the diagram — the user has
  // already chosen, so no second confirm (unlike handleReload).
  useEffect(() => {
    reloadHubRef.current = async (path: string) => {
      try {
        const { diagram, stamp } = await window.api.openDiagramAtPath(path)
        loadDiagramIntoCanvas(path, diagram, stamp, { keepNoteShadows: true })
      } catch (error) {
        showAlert(`Couldn't reload: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }, [loadDiagramIntoCanvas])

  // Window focus is when an outside edit (another editor, git, Claude) is
  // most likely to have just happened — a cheap stat, no watcher/polling
  // (ADR 0091). Shows the toolbar banner; dismissing remembers this specific
  // change but the save-time guard still fires.
  useEffect(() => {
    if (!currentPath) return undefined
    let cancelled = false
    const check = async (): Promise<void> => {
      const baseline = hubBaselineRef.current
      if (baseline.path !== currentPath) return
      const [result] = await window.api.checkFiles(currentPath, [
        { relPath: null, stamp: baseline.stamp }
      ])
      if (cancelled) return
      setExternalChangeStamp(
        result.changed && result.stamp !== dismissedStampRef.current ? result.stamp : null
      )
    }
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [currentPath])

  const dismissExternalChange = useCallback(() => {
    dismissedStampRef.current = externalChangeStamp
    setExternalChangeStamp(null)
  }, [externalChangeStamp])

  // Opens (or focuses, if already open elsewhere) a linked diagram in its
  // own window — used by both link-navigation flows below. Never mutates
  // current state on failure — a missing or unreadable link must leave the
  // diagram containing it fully intact (ADR 0005). Does NOT save anything
  // itself — callers persist first if the parent needs it.
  const openLinkedWindow = useCallback(async (parentPath: string, relativePath: string) => {
    try {
      const result = await window.api.openLinkedInNewWindow(parentPath, relativePath)
      if (!result.found) {
        showAlert(`Linked diagram not found at ${result.resolvedPath}`)
      }
    } catch (error) {
      showAlert(
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
      try {
        await persistDiagram(parentPath, nodes)
      } catch (error) {
        if (isSaveAborted(error)) return
        throw error
      }
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
        await persistDiagram(parentPath, updatedNodes, { forceHub: true })
        await openLinkedWindow(parentPath, relativePath)
      } catch (error) {
        if (isSaveAborted(error)) return
        showAlert(
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
        await persistDiagram(parentPath, updatedNodes, { forceHub: true })
      } catch (error) {
        if (isSaveAborted(error)) return
        showAlert(`Couldn't save the link: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [nodes, persistDiagram]
  )

  // Ctrl/Cmd+click entry point for linked-diagram navigation, exposed via DiagramContext.
  // A node with no link yet shows a chooser (create new / link existing) at
  // the click point using the existing generic ContextMenu; an already-
  // linked node opens straight into a new window (ADR 0023).
  // useEventCallback, not useCallback — its body closes over nodes /
  // currentPath / the link sub-handlers (which in turn depend on the whole
  // diagram state via persistDiagram), so a useCallback here would get a
  // new identity on every edit and, through the memoized DiagramContext
  // value, re-render every node and edge (ADR 0073). It's only ever called
  // from a Ctrl/Cmd+click, so the always-latest-closure semantics are safe.
  const handleLinkClick = useEventCallback((nodeId: string, clientX: number, clientY: number) => {
    if (!currentPath) {
      showAlert('Save the diagram before linking to another diagram.')
      return
    }
    const node = nodes.find((n) => n.id === nodeId)
    const linkedPath =
      typeof node?.data?.linkedDiagram === 'string'
        ? (node.data.linkedDiagram as string)
        : undefined
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
  })

  // Copy style / "format painter" (ADR 0095). The brush is a snapshot of the
  // source's stored style taken on entry, not a live reference to the
  // selection — clicking a target changes the selection. Session-only.
  // Everything here reads the latest state through useEventCallback and the
  // React Flow instance, so none of it churns the DiagramContext value.
  const [styleBrush, setStyleBrush] = useState<StyleBrush | null>(null)
  useModifierDragDuplicate({
    enabled: !styleBrush,
    duplicate: duplicateForDrag,
    cancelGesture: endContinuousEdit
  })

  const toggleStyleBrush = useEventCallback(() => {
    if (styleBrush) {
      setStyleBrush(null)
      return
    }
    const selNodes = rfInstance.getNodes().filter((n) => n.selected)
    const selEdges = rfInstance.getEdges().filter((e) => e.selected)
    if (selNodes.length + selEdges.length !== 1) return
    const brush =
      selNodes.length === 1 ? captureNodeBrush(selNodes[0]) : captureEdgeBrush(selEdges[0])
    if (brush) setStyleBrush(brush)
  })

  // Applies the brush to whichever of the given elements accept it (same
  // type only; a mismatch is silently skipped). One undo step for the batch.
  const applyStyleBrush = useEventCallback((nodeIds: string[], edgeIds: string[]) => {
    if (!styleBrush) return
    const nodeTargets = new Set(
      rfInstance
        .getNodes()
        .filter((n) => nodeIds.includes(n.id) && brushAppliesToNode(styleBrush, n))
        .map((n) => n.id)
    )
    const edgeTargets = new Set(styleBrush.kind === 'edge' ? edgeIds : [])
    if (nodeTargets.size + edgeTargets.size === 0) return
    pushSnapshot()
    if (nodeTargets.size > 0) {
      setNodes((nds) =>
        nds.map((n) =>
          nodeTargets.has(n.id) ? { ...n, data: applyBrushToNodeData(styleBrush, n.data) } : n
        )
      )
    }
    if (edgeTargets.size > 0) {
      setEdges((eds) =>
        eds.map((e) =>
          edgeTargets.has(e.id) ? { ...e, data: applyBrushToEdgeData(styleBrush, e.data) } : e
        )
      )
    }
  })

  const pasteStyleToSelection = useEventCallback(() => {
    applyStyleBrush(
      rfInstance
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
      rfInstance
        .getEdges()
        .filter((e) => e.selected)
        .map((e) => e.id)
    )
  })

  // Plain clicks only — Ctrl/Cmd+click follows a link and Shift+click edits
  // the selection, neither should also paint.
  const onStyleBrushNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      applyStyleBrush([node.id], [])
    },
    [applyStyleBrush]
  )
  const onStyleBrushEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      applyStyleBrush([], [edge.id])
    },
    [applyStyleBrush]
  )

  // Global keyboard shortcuts. One handler rather than one useEffect
  // per shortcut, now that there are enough of these to make that
  // unwieldy. Checks both ctrlKey and metaKey throughout (not just on
  // Windows/Linux's Ctrl) — no reason to make this actively worse for Mac
  // users over a one-line check, even though macOS isn't a primary target.
  useEffect(() => {
    // Behaviour per command id; which keys reach which id (and which text-field
    // conflicts defer to native editing) is the registry's business
    // (commands.ts). A handler returning `false` declines the key press, which
    // then keeps its native behaviour.
    const handlers: Partial<Record<CommandId, () => unknown>> = {
      'file.save': handleSave,
      'file.saveAs': handleSaveAs,
      'file.open': handleOpen,
      'file.new': handleNew,
      // Universal desktop-app convention, added alongside the File -> Close
      // menu item — no shortcut existed for this action before.
      // See handleClose's own comment for what "Close" actually does here
      // (discard back to blank, not close the OS window).
      'file.close': handleClose,
      // Search overlay (ADR 0062) — provisional V1 entry point,
      // no permanent toolbar button yet (see the ADR). Not deferring to text
      // fields: same as Ctrl+S/O/N/W, opening/closing search is a reasonable
      // thing to do regardless of what else has focus.
      'search.toggle': toggleSearchOverlay,
      // Command palette (ADR 0100).
      'view.commandPalette': () => setCommandPaletteOpen(true),
      // "Changes since last save" (epic 0117, ADR 0102).
      'view.changesSinceLastSave': toggleChangesPanel,
      'selection.selectAll': selectAll,
      'edit.duplicate': duplicateSelected,
      // Ctrl+C defers to a live text selection (window.getSelection()) even
      // outside a text field — found live in the threat matrix prototype:
      // its plain service/threat names and scale descriptions aren't inputs,
      // so the text-field deferral alone didn't catch them, and
      // copySelection()'s own preventDefault() silently blocked copying that
      // text at all.
      'edit.copy': () => {
        if ((window.getSelection()?.toString().length ?? 0) > 0) return false
        copySelection()
        return true
      },
      'edit.paste': pasteFromClipboard,
      'style.copy': toggleStyleBrush,
      'style.paste': pasteStyleToSelection,
      'edit.cut': cutSelection,
      // Figma-style redo binding (Ctrl+Shift+Z), not Ctrl+Y.
      'edit.undo': undo,
      'edit.redo': redo,
      'view.fit': () => rfInstance.fitView(),
      'selection.escape': () => {
        if (commandPaletteOpen) {
          // The palette also has its own window-level Escape listener
          // (CommandPalette.tsx) — same harmless redundancy as
          // shortcutsDialogOpen just below.
          setCommandPaletteOpen(false)
        } else if (shortcutsDialogOpen) {
          setShortcutsDialogOpen(false)
        } else if (searchIconPicker) {
          // The search overlay's icon-browser popup — close just it, one
          // step before the overlay itself.
          setSearchIconPicker(null)
        } else if (detailsPanelNodeId) {
          setDetailsPanelNodeId(null)
        } else if (searchOverlayOpen) {
          closeSearchOverlay()
        } else if (diagnosticsPanelOpen) {
          setDiagnosticsPanelOpen(false)
        } else if (highlightsPanelOpen) {
          setHighlightsPanelOpen(false)
        } else if (preferencesPanelOpen) {
          setPreferencesPanelOpen(false)
        } else if (stylePalettePanelOpen) {
          setStylePalettePanelOpen(false)
        } else if (alignDistributePanelOpen) {
          setAlignDistributePanelOpen(false)
        } else if (diagramSettingsPanelOpen) {
          setDiagramSettingsPanelOpen(false)
        } else if (referencesPanelOpen) {
          setReferencesPanelOpen(false)
        } else if (changesPanelOpen) {
          setChangesPanelOpen(false)
        } else if (referenceWindows.length > 0) {
          setReferenceWindows((prev) => prev.slice(0, -1))
        } else if (iconPicker) {
          setIconPicker(null)
        } else if (colorPicker) {
          setColorPicker(null)
        } else if (linePicker) {
          setLinePicker(null)
        } else if (contextMenu) {
          setContextMenu(null)
        } else if (styleBrush) {
          setStyleBrush(null)
        } else {
          deselectAll()
        }
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      // Ctrl+A/D/C/V/X/Z are text-editing conventions — commands flagged
      // deferToTextField are skipped while a text field has focus rather than
      // hijacked for canvas actions.
      const isEditingText =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const command = findKeyCommand(event, isEditingText)
      const run = command ? handlers[command.id as CommandId] : undefined
      if (!command || !run) return
      if (run() === false) return
      if (!command.allowDefault) event.preventDefault()
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
    copySelection,
    pasteFromClipboard,
    cutSelection,
    deselectAll,
    undo,
    redo,
    rfInstance,
    detailsPanelNodeId,
    searchOverlayOpen,
    toggleSearchOverlay,
    searchIconPicker,
    shortcutsDialogOpen,
    commandPaletteOpen,
    styleBrush,
    toggleStyleBrush,
    pasteStyleToSelection,
    closeSearchOverlay,
    diagnosticsPanelOpen,
    highlightsPanelOpen,
    preferencesPanelOpen,
    stylePalettePanelOpen,
    alignDistributePanelOpen,
    diagramSettingsPanelOpen,
    referencesPanelOpen,
    changesPanelOpen,
    toggleChangesPanel,
    referenceWindows,
    iconPicker,
    colorPicker,
    linePicker,
    contextMenu
  ])

  // Drives the diagram dock's mode (item palette vs. property panel) — see
  // ADR 0013. Memoized on nodes/edges (ADR 0073) so unrelated CanvasInner
  // renders (panel toggles, colour-picker state, search) don't hand
  // DiagramDock a fresh array and re-render it + PropertyPanel every time.
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes])
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges])

  // Each node's persisted stacking order — see ADR 0035. No
  // type-based special-casing here: the "containers render behind entities"
  // look most diagrams start with is purely a consequence of the
  // load-time backfill's starting values (applyZIndexBackfill/nextZIndex),
  // not a rule enforced at render time — drag a container above an entity in
  // the layer panel and it genuinely renders above it from then on. React
  // Flow still adds its own selection elevation on top of whatever's set
  // here (elevateNodesOnSelect, on by default).
  //
  // zIndex/draggable/deletable/line-pointerEvents (deriveNodeFields, module
  // scope above) are derived from each node's own `data`/`type` — but kept
  // in sync via this effect rather than recomputed into a fresh wrapper
  // array on every render. React Flow's own adoptUserNodes (@xyflow/system)
  // only reuses a node's already-measured internal state (handle bounds,
  // measured size) when the *exact same* node object is passed to
  // <ReactFlow nodes={...}> again; a fresh wrapper object every render, for
  // every node regardless of whether that node actually changed, makes
  // React Flow treat the *entire diagram* as freshly unmeasured every
  // render. On a large diagram (found on the 82-node Meridian Rail
  // landscape, alongside the edges-don't-render bug in known-issues.md)
  // that showed up as a visible ~300ms stutter on every drag-to-select
  // boundary crossing: one node's selection toggling produced a new `nodes`
  // array, which — with a render-time wrapper — rebuilt every *other*
  // unrelated node's object too, discarding its measured state.
  //
  // deriveNodeFields returns a node's own reference unchanged when nothing
  // needs to change, so the effect's setNodes call below only replaces the
  // specific nodes whose derived fields actually drifted (and bails out of
  // the state update entirely — same array reference — when nothing did),
  // rather than touching every node on every run. A ref-based cache read
  // during render would do the same job, but this repo's react-compiler
  // lint rule (enforced as an error, not just style) disallows reading or
  // writing a ref's `.current` during render at all — this effect-based
  // "materialize the derived fields onto state itself, self-correcting"
  // approach needs no ref, at the cost of one extra render pass whenever a
  // node's derived fields genuinely change (locking it, moving it between
  // z-index tiers) rather than applying within the same render.
  useEffect(() => {
    setNodes((prev) => {
      let changed = false
      const next = prev.map((n) => {
        const derived = deriveNodeFields(n)
        if (derived !== n) changed = true
        return derived
      })
      return changed ? next : prev
    })
  }, [nodes, setNodes])
  // Memoized on `nodes` — a fresh Map every render put a new reference in
  // the edge-derive effect's dependency array below, making that effect
  // (and its setEdges call) run on *every* CanvasInner render regardless of
  // whether nodes/edges changed (ADR 0073).
  const nodeZIndexById = useMemo(
    () => new Map(nodes.map((n) => [n.id, (n.zIndex as number | undefined) ?? 0])),
    [nodes]
  )

  // Stable DOM-order tie-breaker for edges of otherwise-equal zIndex below
  // — kept from the edge-reconnect-priority work, though live debugging (2026-08-22, see
  // docs/known-issues.md) found DOM order was never actually the real
  // mechanism deciding reconnect-handle hit-testing; see SELECTED_EDGE_Z_BOOST
  // just below for the fix that actually addresses it.
  //
  // Returns `edges` itself, by reference, unless at least one edge is
  // selected — only then is the selected-last reorder built. Keeps the
  // <ReactFlow edges={...}> reference stable in the common case (nothing
  // selected), so React Flow stops re-syncing its whole edge store on
  // unrelated CanvasInner renders (ADR 0073). The reorder is only a
  // tie-breaker for edges of exactly equal computed zIndex anyway — the
  // real selected-edge priority is SELECTED_EDGE_Z_BOOST below — so
  // restricting it to "an edge is selected" loses nothing.
  const orderedEdges = useMemo(() => {
    if (!edges.some((e) => e.selected)) return edges
    return [...edges.filter((e) => !e.selected), ...edges.filter((e) => e.selected)]
  }, [edges])

  // An edge has no zIndex of its own to control — ADR 0035
  // deliberately scoped this feature to Entity/Container/Text only. Instead
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
  // was actually selected. The original `orderedEdges`-only fix
  // (DOM order) coincidentally looked like it worked in that one test
  // scenario but was never actually the operative mechanism.
  const SELECTED_EDGE_Z_BOOST = 1_000_000
  // Same "materialize onto state, don't rebuild a wrapper every render"
  // reasoning as the node-fields effect above — an edge's own zIndex isn't
  // purely a function of the edge itself (it depends on its endpoints'
  // zIndex), so this recomputes it from current `nodeZIndexById` on every
  // run rather than using a pure per-edge derive function, but still only
  // replaces (deriveEdgeFields, module scope above) the specific edges
  // whose resolved zIndex actually changed, keeping every other edge's
  // object — and therefore its LabeledEdge instance's React.memo bailout —
  // stable.
  useEffect(() => {
    setEdges((prev) => {
      let changed = false
      const next = prev.map((e) => {
        const sourceZ = nodeZIndexById.get(e.source) ?? 0
        const targetZ = nodeZIndexById.get(e.target) ?? 0
        const baseZ = (sourceZ + targetZ) / 2
        const z = e.selected ? baseZ + SELECTED_EDGE_Z_BOOST : baseZ
        const derived = deriveEdgeFields(e, z)
        if (derived !== e) changed = true
        return derived
      })
      return changed ? next : prev
    })
  }, [edges, nodeZIndexById, setEdges])

  // Plain-data projection for LayerPanel — keeps that component decoupled
  // from React Flow's own Node type, same reasoning as passing plain
  // derived data to other panels elsewhere in this file. Sorted highest
  // z-index first, matching the panel's own top-of-list-is-frontmost
  // display convention — see ADR 0035.
  // Container-nesting analysis for the Layers panel + Diagnostics (ADR 0075):
  //  - parentLabelById: the immediate parent's label, for the "in: X" badge
  //  - invertedZIds: nodes React Flow renders *above* their own parent even
  //    though this app's raw data.zIndex would put them below — the
  //    parentZ + 1 rule in @xyflow/system's calculateChildXYZ. The Layers
  //    panel sorts on raw zIndex (the value drag-to-restack edits), so these
  //    are the rows whose displayed order disagrees with what's clickable.
  //  - outgrownAdvisories: a child whose bounds escape its parent's — the
  //    entity that makes the z-inversion visible and confusing (warn only, no
  //    auto-fix).
  const hierarchyAnalysis = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const sizeOf = (n: Node): { w: number; h: number } => ({
      w: n.width ?? n.measured?.width ?? 0,
      h: n.height ?? n.measured?.height ?? 0
    })
    const parentLabelById = new Map<string, string>()
    const invertedZIds = new Set<string>()
    const outgrownAdvisories: string[] = []
    for (const n of nodes) {
      if (!n.parentId) continue
      const parent = byId.get(n.parentId)
      if (!parent) continue
      const parentLabel = String(parent.data?.label ?? '') || '(unlabeled)'
      const childLabel = String(n.data?.label ?? '') || '(unlabeled)'
      parentLabelById.set(n.id, parentLabel)

      const childZ = (n.data?.zIndex as number | undefined) ?? 0
      const parentZ = (parent.data?.zIndex as number | undefined) ?? 0
      if (parentZ >= childZ) invertedZIds.add(n.id)

      const childAbs = absolutePosition(n, byId)
      const parentAbs = absolutePosition(parent, byId)
      const c = sizeOf(n)
      const p = sizeOf(parent)
      const escapes =
        childAbs.x < parentAbs.x - 0.5 ||
        childAbs.y < parentAbs.y - 0.5 ||
        childAbs.x + c.w > parentAbs.x + p.w + 0.5 ||
        childAbs.y + c.h > parentAbs.y + p.h + 0.5
      if (escapes && c.w > 0 && c.h > 0 && p.w > 0 && p.h > 0) {
        outgrownAdvisories.push(
          `"${childLabel}" is nested inside "${parentLabel}" but extends outside it — React Flow renders a child above its parent, so clicks in the overlapping area select "${childLabel}".`
        )
      }
    }
    return { parentLabelById, invertedZIds, outgrownAdvisories }
  }, [nodes])

  const layerRows = useMemo(
    () =>
      [...nodes]
        .map((n) => ({
          id: n.id,
          type: n.type ?? 'entity',
          label: String(n.data?.label ?? ''),
          zIndex: (n.data?.zIndex as number | undefined) ?? 0,
          parentLabel: hierarchyAnalysis.parentLabelById.get(n.id) ?? null,
          parentId: n.parentId ?? null,
          rendersAboveParent: hierarchyAnalysis.invertedZIds.has(n.id)
        }))
        .sort((a, b) => b.zIndex - a.zIndex),
    [nodes, hierarchyAnalysis]
  )

  // Flat "entity → one reference path" list backing the References inventory
  // panel (ADR 0069) — a live projection of node data, owns nothing.
  const referenceRows = useMemo(
    () =>
      nodes.flatMap((n) => {
        const refs = n.data?.references
        if (!Array.isArray(refs)) return []
        return (refs as string[]).map((path) => ({
          nodeId: n.id,
          nodeLabel: String(n.data?.label ?? ''),
          path
        }))
      }),
    [nodes]
  )

  // Top menu bar (ADR 0039) — File/Edit/View, an explicit information-
  // architecture split worked out with the user alongside a planned (later
  // cancelled) left sidebar: file-level actions here, per-diagram
  // inspection panels also here for now (View), Highlights already moved
  // to its own floating popup next to Legend beforehand. Every item reuses an existing
  // handler unchanged — this menu is purely a new way to reach them, not a
  // new set of actions.
  const hasSelectedNodes = selectedNodes.length > 0

  // Standing advisories — distinct from `diagnostics` state itself
  // (required-tags backfill notices, only updated at actual sync points;
  // see DiagnosticsPanel's own comment on why `entries` is deliberately
  // generic text, anticipating exactly this kind of second, unrelated
  // check). Combined here purely for display — `diagnostics` itself keeps
  // its narrower, sync-point-driven meaning. Memoized so DiagnosticsPanel
  // (and the View-menu label) keep a stable array between unrelated renders.
  const displayedDiagnostics = useMemo(() => {
    const legendEmptyAdvisory =
      legend.length === 0 && edges.length > 0
        ? [
            'Legend is empty — consider adding at least a definition for the arrows/edges used in this diagram.'
          ]
        : []
    return [
      ...diagnostics,
      ...hierarchyLoadNotes,
      ...hierarchyAnalysis.outgrownAdvisories,
      ...legendEmptyAdvisory
    ]
  }, [diagnostics, hierarchyLoadNotes, hierarchyAnalysis, legend.length, edges.length])

  // Missing-file rows still awaiting a decision (dismissed ones hidden).
  const visibleMissingFiles = useMemo(
    () => missingFiles.filter((m) => !dismissedFileKeys.has(m.key)),
    [missingFiles, dismissedFileKeys]
  )

  // "Changes since last save" Details bucket (epic 0117, ADR 0102) — reuses
  // noteShadows' existing dirty flag (ADR 0092) directly, no new tracking.
  const detailsChangedEntries: DetailsChangedEntry[] = useMemo(
    () =>
      Object.values(noteShadows)
        .filter((s) => s.dirty)
        .map((s) => ({
          nodeId: s.nodeId,
          label: String(nodes.find((n) => n.id === s.nodeId)?.data?.label ?? '') || '(unlabeled)'
        })),
    [noteShadows, nodes]
  )
  // Count on the View-menu "Diagnostics (N)" label — undecided missing
  // files + staged removals (a nudge to save), never dismissed ones.
  const diagnosticsCount =
    displayedDiagnostics.length + visibleMissingFiles.length + stagedFileRemovals.length

  // File -> Recent Diagrams submenu — labelled with the last two path
  // segments (…/parent/name.chd), enough to tell two same-named diagrams in
  // different folders apart without the full path. Empty list -> the parent
  // item is present but disabled, so its absence never reads as a bug.
  // Sliced here too, not just in normalizePreferences — lowering the limit
  // in Preferences should shorten the menu immediately, before the next
  // full preferences reload normalizes the stored list.
  const recentDiagrams = (preferences.recentDiagrams ?? []).slice(
    0,
    Math.max(1, preferences.recentDiagramsLimit)
  )
  const recentDiagramsItem: MenuBarItem =
    recentDiagrams.length === 0
      ? { label: 'Recent Diagrams', disabled: true }
      : {
          label: 'Recent Diagrams',
          submenu: [
            ...recentDiagrams.map((path) => ({
              label: path.split(/[\\/]/).slice(-2).join('/') || path,
              title: path,
              disabled: path === currentPath,
              onSelect: () => handleOpenRecent(path)
            })),
            { label: 'Clear Recent', separatorBefore: true, onSelect: handleClearRecent }
          ]
        }

  // Mode-aware menu bar (ADR 0079). The Security Matrix persona is still a
  // render-only prototype with no Canvas-level actions of its own (its
  // calculation-mode / manage-matrix controls live inside ThreatMatrixView),
  // so for now "matrix" just hides what doesn't apply: the whole Edit menu,
  // the diagram-specific View panels, and Export as PNG. File basics
  // (New/Open/Recent/Save/Save As/Reload/Close), Preferences and About are
  // shared. Matrix-specific menus get added back as epic 0079 gives the
  // matrix real, persisted state to act on.
  const isDiagramPersona = persona === 'diagram'
  const preferencesItem: MenuBarItem = { label: 'Preferences', onSelect: togglePreferencesPanel }

  // The legend row the active edge direction set contributes (ADR 0081) —
  // shown in the Legend panel and prepended to the PNG export legend
  // whenever any direction set exists. `null` when the feature is dormant.
  const directionSetRow = directionSetLegendRow(edgeDirectionSets, activeEdgeDirectionSetId)

  const fileMenu: MenuBarMenu = {
    label: 'File',
    items: [
      { label: 'New', accelerator: acceleratorFor('file.new'), onSelect: handleNew },
      { label: 'Open…', accelerator: acceleratorFor('file.open'), onSelect: handleOpen },
      recentDiagramsItem,
      { label: 'Save', accelerator: acceleratorFor('file.save'), onSelect: handleSave },
      { label: 'Save As…', accelerator: acceleratorFor('file.saveAs'), onSelect: handleSaveAs },
      // Diagram-only for now — a "export the matrix as PNG" may make sense
      // later but isn't built.
      ...(isDiagramPersona
        ? [
            {
              label: 'Export as PNG…',
              disabled: nodes.length === 0,
              onSelect: () => setExportPngDialogOpen(true)
            }
          ]
        : []),
      { label: 'Reload', disabled: !currentPath, onSelect: handleReload },
      { label: 'Close', accelerator: acceleratorFor('file.close'), onSelect: handleClose }
    ]
  }

  const editMenu: MenuBarMenu = {
    label: 'Edit',
    items: [
      { label: 'Undo', accelerator: acceleratorFor('edit.undo'), disabled: past.length === 0, onSelect: undo },
      {
        label: 'Redo',
        accelerator: acceleratorFor('edit.redo'),
        disabled: future.length === 0,
        onSelect: redo
      },
      {
        label: 'Cut',
        accelerator: acceleratorFor('edit.cut'),
        disabled: !hasSelectedNodes,
        onSelect: cutSelection
      },
      {
        label: 'Copy',
        accelerator: acceleratorFor('edit.copy'),
        disabled: !hasSelectedNodes,
        onSelect: copySelection
      },
      // Not disabled on an empty/invalid clipboard — same silent no-op
      // as the keyboard shortcut, avoids a synchronous clipboard read on
      // every render just to compute this menu's enabled state.
      { label: 'Paste', accelerator: acceleratorFor('edit.paste'), onSelect: pasteFromClipboard },
      {
        label: 'Align / Distribute…',
        disabled: selectedNodes.length < 2,
        onSelect: toggleAlignDistributePanel
      },
      {
        // Reaches the same action as the edge context menu's "Reverse
        // direction" (ADR 0087), for a selection made by box-select or
        // "Select all edges" where a right-click on one edge isn't the
        // natural gesture.
        label:
          selectedEdges.length > 1
            ? `Reverse edge direction (${selectedEdges.length})`
            : 'Reverse edge direction',
        disabled: selectedEdges.length === 0,
        onSelect: () => reverseEdges(selectedEdges.map((e) => e.id))
      }
    ]
  }

  const commandPaletteItem: MenuBarItem = {
    label: 'Command palette…',
    accelerator: acceleratorFor('view.commandPalette'),
    onSelect: () => setCommandPaletteOpen(true)
  }

  const viewMenu: MenuBarMenu = {
    label: 'View',
    items: isDiagramPersona
      ? [
          commandPaletteItem,
          {
            label: `Diagnostics${diagnosticsCount > 0 ? ` (${diagnosticsCount})` : ''}`,
            onSelect: toggleDiagnosticsPanel
          },
          {
            label: 'Changes since last save…',
            accelerator: acceleratorFor('view.changesSinceLastSave'),
            onSelect: toggleChangesPanel
          },
          { label: 'Layers', onSelect: toggleLayerPanel },
          {
            label: `References${referenceRows.length > 0 ? ` (${referenceRows.length})` : ''}`,
            onSelect: toggleReferencesPanel
          },
          { label: 'Style Palette', onSelect: toggleStylePalettePanel },
          { label: 'Diagram settings', onSelect: toggleDiagramSettingsPanel },
          preferencesItem
        ]
      : [commandPaletteItem, preferencesItem]
  }

  const helpMenu: MenuBarMenu = {
    label: 'Help',
    items: [
      { label: 'Keyboard shortcuts…', onSelect: () => setShortcutsDialogOpen(true) },
      { label: 'About', onSelect: () => setAboutDialogOpen(true) }
    ]
  }

  const menus: MenuBarMenu[] = isDiagramPersona
    ? [fileMenu, editMenu, viewMenu, helpMenu]
    : [fileMenu, viewMenu, helpMenu]

  // Command palette (ADR 0100): every menu leaf above, flattened, plus the
  // few keyboard-only actions that have a real handler but no menu item of
  // their own (see the ADR for why exactly these six).
  const extraPaletteActions: ExtraPaletteAction[] = isDiagramPersona
    ? [
        {
          id: 'edit.duplicate',
          title: 'Duplicate selection',
          category: 'Edit',
          shortcut: acceleratorFor('edit.duplicate'),
          run: duplicateSelected
        },
        {
          id: 'selection.selectAll',
          title: 'Select everything',
          category: 'Selection',
          shortcut: acceleratorFor('selection.selectAll'),
          run: selectAll
        },
        {
          id: 'style.copy',
          title: 'Copy style',
          category: 'Style',
          shortcut: acceleratorFor('style.copy'),
          run: toggleStyleBrush
        },
        {
          id: 'style.paste',
          title: 'Apply copied style to selection',
          category: 'Style',
          shortcut: acceleratorFor('style.paste'),
          run: pasteStyleToSelection
        },
        {
          id: 'view.fit',
          title: 'Fit the whole diagram in view',
          category: 'View',
          shortcut: acceleratorFor('view.fit'),
          run: () => rfInstance.fitView()
        },
        {
          id: 'search.toggle',
          title: 'Open or close search',
          category: 'Search',
          shortcut: acceleratorFor('search.toggle'),
          run: toggleSearchOverlay
        }
      ]
    : []
  const paletteActions = buildPaletteActions(menus, extraPaletteActions)

  // Whichever named palette is active (ADR 0068), resolved live —
  // memoized on the two fields it depends on so the Context value below
  // keeps a stable identity between unrelated settings changes.
  const activeStylePalette = useMemo(
    () => effectiveStylePalette(preferences.stylePalettes, preferences.activeStylePaletteId),
    [preferences.stylePalettes, preferences.activeStylePaletteId]
  )

  // useCallback (not an inline arrow on <DiagramDock>) so memo(DiagramDock)
  // can actually bail on unrelated CanvasInner renders (ADR 0073).
  const setDefaultStyle = useCallback(
    (type: 'entity' | 'container' | 'text', style: NodeStyle) =>
      updatePreferences({ defaultStyles: { ...preferences.defaultStyles, [type]: style } }),
    [updatePreferences, preferences.defaultStyles]
  )

  // Memoized so a high-frequency state change elsewhere in CanvasInner (e.g.
  // dragging a native color-input handle, which can fire dozens of onChange
  // events per second) doesn't force every node/edge to re-render just
  // because this object got a new identity — every consumer subscribes via
  // useContext, which bypasses their own React.memo wrapper entirely (that
  // only guards against prop changes from a parent, not a Context
  // subscription). See ADR 0056. Every function here is already
  // useCallback-stable; effectiveGravityPresets() returns its input
  // reference unchanged when non-empty, so this only recomputes when one of
  // these values has genuinely, referentially changed.
  const diagramContextValue: DiagramContextValue = useMemo(
    () => ({
      diagramPath: currentPath,
      openContextMenu,
      openIconPicker,
      openColorPicker,
      openDetailsPanel,
      openReferencesFor,
      openReferenceWindow,
      addReferencesToNode,
      removeReferenceFromNode,
      handleLinkClick,
      beginContinuousEdit,
      endContinuousEdit,
      pushSnapshot,
      attachContainedNodes,
      detachFromParent,
      groupResize,
      matchHighlights,
      edgeStraightSegmentLength: preferences.edgeStraightSegmentLength,
      maxConnectionPointsPerSide:
        diagramMaxConnectionPointsPerSide ?? preferences.maxConnectionPointsPerSide,
      theme,
      entityHighlightNodeId,
      paletteColors: activeStylePalette.colors,
      paletteFonts: activeStylePalette.fonts,
      gravityPresets: effectiveGravityPresets(
        gravityPresets,
        preferences.gravityPresetsUserDefault
      ),
      searchMatchIds,
      isolateActive,
      isolateOpacity: preferences.isolateOpacity,
      selectAllOfType
    }),
    [
      currentPath,
      openContextMenu,
      openIconPicker,
      openColorPicker,
      openDetailsPanel,
      openReferencesFor,
      openReferenceWindow,
      addReferencesToNode,
      removeReferenceFromNode,
      handleLinkClick,
      beginContinuousEdit,
      endContinuousEdit,
      pushSnapshot,
      attachContainedNodes,
      detachFromParent,
      groupResize,
      matchHighlights,
      preferences.edgeStraightSegmentLength,
      preferences.maxConnectionPointsPerSide,
      diagramMaxConnectionPointsPerSide,
      theme,
      entityHighlightNodeId,
      activeStylePalette,
      gravityPresets,
      preferences.gravityPresetsUserDefault,
      searchMatchIds,
      isolateActive,
      preferences.isolateOpacity,
      selectAllOfType
    ]
  )

  return (
    <DiagramContext.Provider value={diagramContextValue}>
      {/* Outer app shell: [canvas view [diagram dock]] [utility dock], nested
          not flat — see ADR 0013. */}
      <div className="app-shell">
        <div className="canvas-view">
          <div className="toolbar">
            <MenuBar menus={menus} />
            {/* Persona selector sits after the File/Edit/View/Help menus, not
                before — the menus are the primary navigation, the persona
                switch is a mode toggle (per the user). */}
            <select
              className="toolbar-persona-select"
              value={persona}
              onChange={(event) => handlePersonaChange(event.target.value as 'diagram' | 'matrix')}
              title="Switch view"
              aria-label="Switch view"
            >
              <option value="diagram">Diagram</option>
              <option value="matrix">Security Matrix (prototype)</option>
            </select>
            {styleBrush && (
              <span className="toolbar-style-brush" role="status">
                Applying style — click{' '}
                {styleBrush.kind === 'edge' ? 'an edge' : `a ${styleBrush.nodeType}`}
                <button type="button" onClick={() => setStyleBrush(null)}>
                  Stop (Esc)
                </button>
              </span>
            )}
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
            {detailsNotice && detailsNotice.nodeId === detailsPanelNodeId && (
              <span className="toolbar-external-change" role="status">
                {detailsNoteName(nodes.find((n) => n.id === detailsNotice.nodeId))}
                {detailsNotice.kind === 'refreshed'
                  ? ' — updated from disk (changed outside the app).'
                  : ' — changed outside the app, and you have unsaved edits.'}
                {detailsNotice.kind === 'refreshed' ? (
                  <button type="button" onClick={() => setDetailsNotice(null)}>
                    OK
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => void reloadOpenDetailsFromDisk()}>
                      Reload (discard mine)
                    </button>
                    <button type="button" onClick={() => void keepMyDetailsEdits()}>
                      Keep mine
                    </button>
                  </>
                )}
              </span>
            )}
            {externalChangeStamp && (
              <span className="toolbar-external-change" role="alert">
                {isDirty
                  ? 'Changed outside the app — and you have unsaved changes.'
                  : 'Changed outside the app.'}
                <button type="button" onClick={handleReload}>
                  Reload
                </button>
                <button type="button" onClick={dismissExternalChange}>
                  Ignore
                </button>
              </span>
            )}
            {/* Default-edge-style swatch — diagram-only; nothing in the
                Security Matrix persona draws edges (ADR 0079). */}
            {isDiagramPersona && (
              <button
                type="button"
                className="toolbar-edge-style-swatch"
                title="Default style for newly drawn edges"
                aria-label="Default style for newly drawn edges"
                onClick={(event) =>
                  setDefaultEdgeStylePicker(event.currentTarget.getBoundingClientRect())
                }
              >
                <svg width="28" height="16" viewBox="0 0 28 16">
                  <line
                    x1="2"
                    y1="8"
                    x2={preferences.defaultEdgeStyle.endMarker === 'none' ? 26 : 20}
                    y2="8"
                    stroke={preferences.defaultEdgeStyle.stroke ?? 'currentColor'}
                    strokeWidth={preferences.defaultEdgeStyle.strokeWidth ?? 2}
                    strokeDasharray={
                      DEFAULT_EDGE_SWATCH_DASH[preferences.defaultEdgeStyle.lineStyle ?? 'solid']
                    }
                  />
                  {preferences.defaultEdgeStyle.endMarker !== 'none' && (
                    <polygon
                      points="20,3 26,8 20,13"
                      fill={preferences.defaultEdgeStyle.stroke ?? 'currentColor'}
                    />
                  )}
                </svg>
              </button>
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          {persona === 'matrix' ? (
            <ThreatMatrixView
              nodes={nodes}
              security={security}
              combineMethod={securityCombineMethod}
              aggregateMethod={securityAggregateMethod}
              onCombineMethodChange={setSecurityCombineMethod}
              onAggregateMethodChange={setSecurityAggregateMethod}
              crawl={securityCrawl}
              onRefreshCrawl={refreshSecurityCrawl}
              onOpenLinkedDiagram={(relativePath) => {
                if (currentPath) void window.api.openLinkedInNewWindow(currentPath, relativePath)
              }}
              onChange={updateSecurity}
              onRemoveThreat={removeSecurityThreat}
              onRemoveEntity={removeSecurityEntity}
              onCellChange={updateNodeSecurityCell}
            />
          ) : (
            <div className="canvas-view-body">
              <div
                className={`canvas-view-flow${
                  styleBrush
                    ? ` style-brush-active style-brush-${styleBrush.kind === 'node' ? styleBrush.nodeType : 'edge'}`
                    : ''
                }`}
                ref={flowWrapperRef}
                onDragOver={onCanvasDragOver}
                onDrop={onCanvasDrop}
              >
                <EdgeMarkerDefs />
                {peek && peekNode && (
                  <PeekCard
                    key={peek.nodeId}
                    target={peek}
                    label={typeof peekNode.data?.label === 'string' ? peekNode.data.label : ''}
                    detailsPath={
                      typeof peekNode.data?.details === 'string' ? peekNode.data.details : undefined
                    }
                    linkedPath={
                      typeof peekNode.data?.linkedDiagram === 'string'
                        ? peekNode.data.linkedDiagram
                        : undefined
                    }
                    metadata={peekNode.data?.metadata as Record<string, MetadataEntry> | undefined}
                    diagramPath={currentPath}
                    shadowContent={noteShadows[peek.nodeId]?.content}
                  />
                )}
                <ReactFlow
                  nodes={nodes}
                  edges={orderedEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  // Only mount nodes/edges intersecting the viewport — see
                  // ADR 0073. Nodes carry width/height (fromDiagramFile) so
                  // their bounds are known before measurement. Disabled
                  // during PNG export so the capture sees the whole diagram.
                  onlyRenderVisibleElements={!isExportingPng}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDrag={onNodeDrag}
                  onNodeDragStop={onNodeDragStop}
                  onNodeClick={onStyleBrushNodeClick}
                  onEdgeClick={onStyleBrushEdgeClick}
                  onNodeMouseEnter={peekBindings.onNodeMouseEnter}
                  onNodeMouseLeave={peekBindings.onNodeMouseLeave}
                  onConnect={onConnect}
                  onConnectStart={onConnectStart}
                  onConnectEnd={onConnectEnd}
                  onReconnect={onReconnect}
                  onReconnectStart={onReconnectStart}
                  onReconnectEnd={onReconnectEnd}
                  edgesReconnectable
                  // A little smaller than React Flow's own default (10) — and
                  // kept equal to main.css's `.react-flow__edgeupdater` `r`
                  // value, so the visible dot on a selected edge
                  // matches the actual grabbable area exactly rather than
                  // over- or under-promising it.
                  reconnectRadius={8}
                  // Previously never set at all (silently React Flow's own
                  // 0.5/2 library defaults) until a large diagram made
                  // "zoom out further" a real ask — now a real Setting
                  // (PreferencesPanel.tsx) rather than hardcoded.
                  minZoom={preferences.minZoom}
                  maxZoom={preferences.maxZoom}
                  onEdgeContextMenu={onEdgeContextMenu}
                  connectionMode={ConnectionMode.Loose}
                  defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                  connectionLineComponent={MultiConnectionLine}
                  selectionMode={
                    preferences.dragSelectRequiresFullEnclosure
                      ? SelectionMode.Full
                      : SelectionMode.Partial
                  }
                  deleteKeyCode={['Delete', 'Backspace']}
                  multiSelectionKeyCode="Shift" // frees Ctrl/Cmd+click for linked-diagram navigation
                  colorMode={theme}
                  // Overrides React Flow's own light/dark default background
                  // — ADR 0048. Setting plain `backgroundColor`
                  // here does nothing visible: the actual paint comes from
                  // <Background>'s own absolutely-positioned SVG
                  // (.react-flow__background), which reads the CSS custom
                  // property --xy-background-color, not the literal
                  // background-color, on whichever ancestor defines it — see
                  // node_modules/@xyflow/react/dist/style.css. undefined
                  // here is a no-op (React drops it from the style object),
                  // so this falls back to the theme default exactly like
                  // today whenever the user hasn't set one.
                  style={
                    {
                      // Theme-adaptive (ADR 0034) like every other
                      // explicit color in this app — a background picked
                      // while looking at one theme shouldn't stay bit-for-
                      // bit identical (and potentially illegible) after
                      // switching to the other.
                      '--xy-background-color': themeAdaptiveColor(
                        preferences.canvasBackgroundColor,
                        theme
                      ),
                      // Read directly by LabeledEdge's stroke when selected
                      // (ADR 0056) — kept off DiagramContext deliberately:
                      // this value only ever matters to whichever edge is
                      // currently selected (usually zero or one of many), so
                      // threading it through Context would re-render every
                      // edge on every change regardless of selection. A CSS
                      // var updates the browser's paint directly, with no
                      // React re-render of any edge at all, selected or not.
                      '--selected-edge-highlight-color': preferences.selectedEdgeHighlightColor
                    } as React.CSSProperties
                  }
                  fitView
                >
                  <Background />
                  <Controls>
                    <ControlButton
                      title="Show legend"
                      aria-label="Show legend"
                      onClick={(event) =>
                        toggleLegendPanel(event.currentTarget.getBoundingClientRect())
                      }
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <circle cx="5" cy="7" r="2.5" fill="currentColor" />
                        <line x1="10" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" />
                        <circle cx="5" cy="17" r="2.5" fill="currentColor" />
                        <line
                          x1="10"
                          y1="17"
                          x2="20"
                          y2="17"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </ControlButton>
                    <ControlButton
                      title={`Highlights${highlights.length > 0 ? ` (${highlights.length})` : ''}`}
                      aria-label="Show highlights"
                      onClick={(event) =>
                        toggleHighlightsPanel(event.currentTarget.getBoundingClientRect())
                      }
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
                onAddEntity={addEntityNode}
                onAddText={addTextNode}
                onAddContainer={addContainerNode}
                onAddLine={addLineNode}
                onCreateMultipleEntities={() => setBulkCreateType('entity')}
                onCreateMultipleContainers={() => setBulkCreateType('container')}
                onUpdateNodeStyle={updateNodeStyle}
                onUpdateEdgeStyle={updateEdgeStyle}
                onUpdateTransform={updateTransform}
                onUpdateLocked={updateLocked}
                onUpdateNodeMetadata={updateNodeMetadata}
                onUpdateEdgeMetadata={updateEdgeMetadata}
                onSetConnectionPointCount={setConnectionPointCount}
                maxConnectionPointsPerSide={
                  diagramMaxConnectionPointsPerSide ?? preferences.maxConnectionPointsPerSide
                }
                requiredTags={requiredTags}
                beginContinuousEdit={beginContinuousEdit}
                endContinuousEdit={endContinuousEdit}
                pushSnapshot={pushSnapshot}
                onSetDefaultStyle={setDefaultStyle}
                styleBrushActive={styleBrush !== null}
                onToggleStyleBrush={toggleStyleBrush}
              />
            </div>
          )}
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
                colorPicker.kind === 'fill'
                  ? colorPickerStyle.fillOpacity
                  : colorPickerStyle.strokeOpacity
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
          {isDiagramPersona && defaultEdgeStylePicker && (
            <StylePicker
              anchorRect={defaultEdgeStylePicker}
              onPick={(patch) => {
                // Whole-object replace, not merged into the existing
                // default — picking a preset here means "this preset is
                // now the default," same as picking one for a single edge
                // replaces that edge's look rather than layering on top.
                updatePreferences({ defaultEdgeStyle: patch })
                setDefaultEdgeStylePicker(null)
              }}
              onClose={() => setDefaultEdgeStylePicker(null)}
            />
          )}
          {legendPanelOpen && (
            <LegendPanel
              diagramPath={currentPath}
              legend={legend}
              directionSetRow={directionSetRow}
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
          {searchOverlayOpen && (
            <SearchOverlay
              query={searchQuery}
              onQueryChange={onSearchQueryChange}
              deepSearchEnabled={deepSearchEnabled}
              onToggleDeepSearch={() => setDeepSearchEnabled((v) => !v)}
              deepSearchAvailable={currentPath !== null}
              deepSearchLoading={deepSearchLoading}
              unreadableLinks={searchUnreadable}
              onSubmit={runSearch}
              searchRun={searchRun}
              matchCount={searchMatchOrder.length}
              currentIndex={searchMatchCursor}
              onNext={nextSearchMatch}
              onPrev={prevSearchMatch}
              isolateActive={isolateActive}
              onToggleIsolate={runIsolate}
              diagramPath={currentPath}
              searchIcon={searchIcon}
              iconPickerOpen={searchIconPicker !== null}
              onToggleIconPicker={toggleSearchIconPicker}
              onClearIcon={clearSearchIcon}
              queryProblems={searchQueryProblems}
              onClose={closeSearchOverlay}
            />
          )}
          {searchIconPicker && (
            <div
              className="icon-search-popup nodrag nopan"
              style={{
                left: Math.max(8, searchIconPicker.right - 220),
                top: Math.min(searchIconPicker.bottom + 6, window.innerHeight - 320)
              }}
            >
              <IconBrowser diagramPath={currentPath} onPick={pickSearchIcon} />
            </div>
          )}
        </div>
        <UtilityDock>
          {detailsPanelNodeId && (
            <DetailsPanel
              title={detailsPanelTitle(nodes.find((n) => n.id === detailsPanelNodeId))}
              content={noteShadows[detailsPanelNodeId]?.content ?? ''}
              onChange={(content) => {
                // The one edit site: the note's own dirty flag, not the diagram's.
                setNoteShadows((prev) => ({
                  ...prev,
                  [detailsPanelNodeId]: editNote(
                    prev[detailsPanelNodeId] ?? newNoteShadow(detailsPanelNodeId),
                    content
                  )
                }))
              }}
              onClose={() => {
                const closingId = detailsPanelNodeId
                setDetailsPanelNodeId(null)
                setDetailsNotice(null)
                // A note nobody edited needs no in-memory copy: next open reads it fresh.
                setNoteShadows((prev) => {
                  if (!prev[closingId] || prev[closingId].dirty) return prev
                  const next = { ...prev }
                  delete next[closingId]
                  return next
                })
              }}
            />
          )}
          {diagnosticsPanelOpen && (
            <DiagnosticsPanel
              entries={displayedDiagnostics}
              missingFiles={visibleMissingFiles}
              stagedRemovals={stagedFileRemovals}
              onRecheck={() => {
                runSync(requiredTags)
                void scanMissingFiles(graphRef.current.nodes, legend, currentPath)
              }}
              onRevealNode={revealNode}
              onRelink={relinkMissingFile}
              onDismiss={dismissMissingFile}
              onStageRemoval={stageMissingFileRemoval}
              onUnstageRemoval={unstageMissingFileRemoval}
              onClose={() => setDiagnosticsPanelOpen(false)}
            />
          )}
          {changesPanelOpen && (
            <ChangesPanel
              diff={changesDiff}
              detailsChanged={detailsChangedEntries}
              neverSaved={currentPath === null}
              onRefresh={() => void computeChangesDiff()}
              onReveal={focusSearchMatch}
              onClose={() => setChangesPanelOpen(false)}
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
          {referencesPanelOpen && (
            <ReferencesPanel
              diagramPath={currentPath}
              rows={referenceRows}
              onReveal={revealNode}
              onOpen={openReferenceWindow}
              onClose={() => setReferencesPanelOpen(false)}
            />
          )}
          {preferencesPanelOpen && (
            <PreferencesPanel
              preferences={preferences}
              onChange={updatePreferences}
              onClose={() => setPreferencesPanelOpen(false)}
            />
          )}
          {alignDistributePanelOpen && (
            <AlignDistributePanel
              disabled={selectedNodes.length < 2}
              onAlign={alignSelected}
              onClose={() => setAlignDistributePanelOpen(false)}
            />
          )}
          {stylePalettePanelOpen && (
            <StylePalettePanel
              palettes={preferences.stylePalettes}
              activePaletteId={preferences.activeStylePaletteId}
              defaultStyles={preferences.defaultStyles}
              defaultEdgeStyle={preferences.defaultEdgeStyle}
              canvasBackgroundColor={preferences.canvasBackgroundColor}
              theme={theme}
              onChangePalettes={(stylePalettes, activeStylePaletteId) =>
                updatePreferences({ stylePalettes, activeStylePaletteId })
              }
              onChangeCanvasBackgroundColor={(canvasBackgroundColor) =>
                updatePreferences({ canvasBackgroundColor })
              }
              onClearDefault={(type) =>
                type === 'edge'
                  ? updatePreferences({ defaultEdgeStyle: {} })
                  : updatePreferences({
                      defaultStyles: { ...preferences.defaultStyles, [type]: undefined }
                    })
              }
              onClose={() => setStylePalettePanelOpen(false)}
            />
          )}
          {diagramSettingsPanelOpen && (
            <DiagramSettingsPanel
              maxConnectionPointsPerSide={diagramMaxConnectionPointsPerSide}
              preferencesDefault={preferences.maxConnectionPointsPerSide}
              onChangeMaxConnectionPoints={updateDiagramMaxConnectionPointsPerSide}
              requiredTags={requiredTags}
              usedTags={usedTags}
              onChangeRequiredTags={updateRequiredTags}
              onCopyRequiredTagsToChildren={copyRequiredTagsToChildren}
              gravityPresets={gravityPresets}
              onChangeGravityPresets={updateGravityPresets}
              gravityPresetsUserDefault={preferences.gravityPresetsUserDefault}
              onSetGravityPresetsUserDefault={(presets) =>
                updatePreferences({ gravityPresetsUserDefault: presets })
              }
              onClearGravityPresetsUserDefault={() =>
                updatePreferences({ gravityPresetsUserDefault: undefined })
              }
              edgeDirectionSets={edgeDirectionSets}
              activeEdgeDirectionSetId={activeEdgeDirectionSetId}
              onSwitchEdgeDirectionSet={switchEdgeDirectionSet}
              onCreateEdgeDirectionSet={() => addEdgeDirectionSet()}
              onDuplicateEdgeDirectionSet={(id) => addEdgeDirectionSet(id)}
              onRenameEdgeDirectionSet={renameEdgeDirectionSet}
              onUpdateEdgeDirectionSetStyle={updateEdgeDirectionSetStyle}
              onDeleteEdgeDirectionSet={deleteEdgeDirectionSet}
              onClose={() => setDiagramSettingsPanelOpen(false)}
            />
          )}
        </UtilityDock>
        {referenceWindows.map((w, index) => {
          const owner = nodes.find((n) => n.id === w.nodeId)
          // A window whose owning entity or reference is gone (deleted,
          // undone) just stops rendering — no stale windows left behind.
          const stillAttached =
            owner &&
            Array.isArray(owner.data?.references) &&
            (owner.data.references as string[]).includes(w.path)
          if (!stillAttached) return null
          return (
            <ReferenceWindow
              key={`${w.nodeId}::${w.path}`}
              diagramPath={currentPath}
              nodeId={w.nodeId}
              path={w.path}
              ownerLabel={String(owner?.data?.label ?? '')}
              index={index}
              onClose={() => closeReferenceWindow(w.nodeId, w.path)}
              onRemove={() => removeReferenceFromNode(w.nodeId, w.path)}
            />
          )
        })}
        {aboutDialogOpen && <AboutDialog onClose={() => setAboutDialogOpen(false)} />}
        {shortcutsDialogOpen && <ShortcutsDialog onClose={() => setShortcutsDialogOpen(false)} />}
        {commandPaletteOpen && (
          <CommandPalette actions={paletteActions} onClose={() => setCommandPaletteOpen(false)} />
        )}
        <AlertDialog />
        <ConflictDialog />
        {bulkCreateType && (
          <BulkCreateDialog
            typeLabel={bulkCreateType}
            onClose={() => setBulkCreateType(null)}
            onConfirm={(labels) => {
              addMultipleNodes(bulkCreateType, labels)
              setBulkCreateType(null)
            }}
          />
        )}
        {exportPngDialogOpen && (
          <ExportPngDialog
            initial={{
              paddingPx: preferences.pngExportPaddingPx,
              transparentBackground: preferences.pngExportTransparentBackground,
              backgroundColorOverride: preferences.pngExportBackgroundColorOverride,
              legendCorner: preferences.pngExportLegendCorner
            }}
            effectiveCanvasColorHex={exportPngEffectiveColorHex}
            hasLegendContent={
              legend.length > 0 || enabledHighlightIds.size > 0 || directionSetRow !== null
            }
            onClose={() => setExportPngDialogOpen(false)}
            onConfirm={(choice: PngExportChoice) => {
              setExportPngDialogOpen(false)
              updatePreferences({
                pngExportPaddingPx: choice.paddingPx,
                pngExportTransparentBackground: choice.transparentBackground,
                pngExportBackgroundColorOverride: choice.backgroundColorOverride,
                pngExportLegendCorner: choice.legendCorner
              })
              handleExportPng(choice)
            }}
          />
        )}
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
