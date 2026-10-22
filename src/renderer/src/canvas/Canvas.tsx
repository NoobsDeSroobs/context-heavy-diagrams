import { showAlert } from '../ui/alerts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { isSaveAborted } from '../document/saveAborted'
import {
  adoptDisk,
  dirtyBaselines,
  dirtyDrafts,
  editNote,
  loadedNoteShadow,
  newNoteShadow,
  type NoteShadow,
  type Stamp
} from '@shared/document/documentSave'
import ConflictDialog from '../document/ConflictDialog'
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
  type OnBeforeDelete,
  type OnConnectStartParams
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  createEmptyDiagram,
  serializeDiagram,
  type ConnectionPoint,
  type ConnectionPointSide,
  type DiagramFile,
  type EdgeStyle,
  type GravityPreset,
  type IconRef,
  type IconSlot,
  type JsonValue,
  type LinePoint,
  type MetadataEntry,
  type NodeStyle,
  type RequiredTagDefinition
} from '@shared/diagram'
import { diffDiagrams, summarizeChanges } from '@shared/document/changesSinceSave'
import EntityNode, { ENTITY_MIN_WIDTH, ENTITY_MIN_HEIGHT } from '../nodes/EntityNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from '../nodes/TextNode'
import ContainerNode, { CONTAINER_MIN_WIDTH, CONTAINER_MIN_HEIGHT } from '../nodes/ContainerNode'
import { scaleGroupMembers, type GroupResizeMember } from './groupResize'
import LineNode, { LINE_BOUNDS_PADDING } from '../nodes/LineNode'
import DiagramSettingsPanel from '../diagram-settings/DiagramSettingsPanel'
import { effectiveGravityPresets } from '../nodes/lineGravityPresets'
import LabeledEdge from '../edges/LabeledEdge'
import EdgeMarkerDefs from '../edges/edgeMarkers'
import { markerUrl } from '../edges/markerIds'
import DiagramContext, { type DiagramContextValue } from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import IconPicker from '../icons/IconPicker'
import IconBrowser from '../icons/IconBrowser'
import ColorPickerPopup from '../styling/ColorPickerPopup'
import StylePicker from '../styling/StylePicker'
import DetailsPanel from '../details/DetailsPanel'
import DiagnosticsPanel from '../diagnostics/DiagnosticsPanel'
import ChangesPanel, { type DetailsChangedEntry } from '../document/ChangesPanel'
import HighlightsPanel from '../tagging/HighlightsPanel'
import SearchOverlay from '../search/SearchOverlay'
import LegendPanel from '../legend/LegendPanel'
import MenuBar, { type MenuBarMenu, type MenuBarItem } from '../MenuBar'
import LayerPanel from '../layers/LayerPanel'
import { reorderZIndex } from '@shared/canvas/zIndexOrdering'
import {
  connectionPointAtOrdinal,
  pointOrdinal,
  reassignConnectionPointHandles,
  setSideCustomPointCount
} from '../nodes/connectionPoints'
import { nearestSegmentIndex, type PathPoint } from '@shared/geometry/bendablePath'
import { nearestWaypointGap } from '@shared/geometry/orthogonalPath'
import {
  activeDirectionSetStyle,
  directionSetLegendRow,
  ensureDirectionSets,
  reverseEdgeDirection
} from '../edges/edgeDirectionSets'
import { absolutePosition, subtractPosition } from '../nodes/nodePosition'
import MultiConnectionLine from '../edges/MultiConnectionLine'
import PreferencesPanel from '../preferences/PreferencesPanel'
import AlignDistributePanel from '../alignment/AlignDistributePanel'
import AboutDialog from '../AboutDialog'
import { AI_INSTRUCTIONS } from '@shared/ai/aiInstructions'
import { summarizeAiFolderResult } from '@shared/ai/aiFolderResult'
import ShortcutsDialog from '../ShortcutsDialog'
import CommandPalette from '../CommandPalette'
import { buildPaletteActions, type ExtraPaletteAction } from '../paletteActions'
import { acceleratorFor, findKeyCommand, type CommandId } from '../commands'
import AlertDialog from '../ui/AlertDialog'
import ExportImageDialog, { type ImageExportChoice } from '../export/ExportImageDialog'
import { buildDiagramSvg } from '../export/exportSvg'
import BulkCreateDialog from '../bulk-create/BulkCreateDialog'
import StylePalettePanel from '../styling/StylePalettePanel'
import ReferenceWindow from '../references/ReferenceWindow'
import ReferencesPanel from '../references/ReferencesPanel'
import DiagramDock from '../DiagramDock'
import { PALETTE_ITEM_DRAG_TYPE, type PaletteItemType } from '../palette/ItemPalette'
import UtilityDock from '../UtilityDock'
import AlignmentGuides from '../alignment/AlignmentGuides'
import { SNAP_THRESHOLD_PX, boundsFrom, computeSnap } from '../alignment/alignment'
import { buildClipboardPayload, parseClipboardPayload, remapForPaste } from './clipboard'
import { resolveDeletion } from './containerRemoval'
import { warnIfSavedWithNewer } from '../document/fileVersionWarning'
import type { TransformPatch } from '../properties/transformPatch'
import { useTheme } from '../styling/theme'
import { useEventCallback } from './useEventCallback'
import { useHistory } from './useHistory'
import { usePanels } from './usePanels'
import type { CanvasApi } from './canvasApi'
import { useSearch } from '../search/useSearch'
import { useReferences } from '../references/useReferences'
import { useStyleBrush } from '../styling/useStyleBrush'
import { useLegendLinePick } from '../legend/useLegendLinePick'
import { useLegend } from '../legend/useLegend'
import { useHighlights } from '../tagging/useHighlights'
import { useDiagnostics } from '../diagnostics/useDiagnostics'
import { useEdgeDirectionSets } from '../edges/useEdgeDirectionSets'
import { useThreatMatrix } from '../threat-matrix/useThreatMatrix'
import { useDirtyState } from '../document/useDirtyState'
import { useExternalChange } from '../document/useExternalChange'
import { useSave } from '../document/useSave'
import { useModifierDragDuplicate } from './useModifierDragDuplicate'
import { useDetailsPeek } from '../details/useDetailsPeek'
import PeekCard from '../details/PeekCard'
import { effectiveStylePalette, usePreferences } from '../preferences/preferences'
import {
  captureDiagramPng,
  resolveEffectiveBackgroundColor,
  rgbStringToHex
} from '../export/exportPng'
import { buildExportLegendItems } from '@shared/legend/legendItems'
import ThreatMatrixView from '../threat-matrix/ThreatMatrixView'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import {
  deriveNodeFields,
  deriveEdgeFields,
  newNodeId,
  nextZIndex,
  isConnectableNodeType
} from './nodeFields'
import { isVoidDrop, pointFromEvent, visibleCanvasCenter } from './screenGeometry'
import { sortNodesForHierarchy, removeContainerReparenting } from './hierarchy'
import { resolveEndpointPosition } from '../edges/endpointPosition'
import { detailsPanelTitle, detailsNoteName } from '../details/detailsLabels'
import { shadowsFromSnapshot } from '../document/noteShadows'
import { toDiagramFile, fromDiagramFile } from '../document/diagramConversion'
import { seedMetadata } from '../tagging/metadataSync'
import { syncEdgeMetadata, syncNodeMetadata } from '../tagging/syncElements'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts.
const nodeTypes = {
  entity: EntityNode,
  text: TextNode,
  container: ContainerNode,
  line: LineNode
}
const edgeTypes = { labeled: LabeledEdge }

// Static, at module scope, so React Flow gets a stable reference (same reason as
// nodeTypes/edgeTypes above): EdgeWrapper reads defaultEdgeOptions through its own unguarded
// useStore selector, so a fresh object per render would re-render every edge.
//
// markerEnd is a raw 'url(#id)' string pointing at this app's context-stroke marker
// (edgeMarkers.tsx), not RF's { type: MarkerType.ArrowClosed }. RF colours that one from a
// `defaultColor` this app never sets, so it stayed stock grey and washed out on a light PNG export.
// RF passes a string through untouched (createMarkerIds only acts on object markers), and the
// arrowhead then inherits whatever colour the edge draws in, live or exported.
const DEFAULT_EDGE_OPTIONS = {
  type: 'labeled',
  markerEnd: markerUrl('arrowClosed')
}

// Toolbar default-edge-style swatch preview only — deliberately a scaled-
// down echo of LabeledEdge.tsx's own DASH_ARRAY, not a shared import; the
// swatch is a small honest preview, not a real edge render.
const DEFAULT_EDGE_SWATCH_DASH: Record<'solid' | 'dashed' | 'dotted', string | undefined> = {
  solid: undefined,
  dashed: '4 3',
  dotted: '1.5 2'
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
  const { hubDirty, setHubDirty, noteShadows, setNoteShadows, noteShadowsRef, isDirty, markDirty } =
    useDirtyState()
  // Reloads the diagram file from disk keeping unsaved note edits — set once
  // loadDiagramIntoCanvas exists (it is declared after persistDiagram).
  const reloadHubRef = useRef<((path: string) => Promise<void>) | null>(null)
  const {
    hubBaselineRef,
    externalChangeStamp,
    setExternalChangeStamp,
    dismissedStampRef,
    dismissExternalChange
  } = useExternalChange(currentPath)
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
  // Diagram-level metadata/requiredTags (ADR 0022) — analogous to
  // currentPath: file-scoped state with no React Flow home of its own,
  // reset on every load, carried into every save via toDiagramFile.
  // The `savedWith` of the file that was loaded (ADR 0118); undefined for a new or
  // marker-less diagram. A ref, not state: nothing renders from it.
  const loadedSavedWithRef = useRef<string | undefined>(undefined)
  const [diagramMetadata, setDiagramMetadata] = useState<Record<string, JsonValue>>({})
  const [requiredTags, setRequiredTags] = useState<RequiredTagDefinition[]>([])
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
  // Edge hover (the hover-revealed bend-point handles of catmull-rom edges, ADR 0057) is tracked
  // per edge inside LabeledEdge, not here (ADR 0073): one shared hoveredEdgeId materialized onto
  // edge.data rebuilt the whole edges array on every hover.
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  // Command palette (ADR 0100).
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  // Which image export the dialog is open for, if any (PNG, ADR 0051; SVG, ADR 0124).
  const [exportDialogFormat, setExportDialogFormat] = useState<'png' | 'svg' | null>(null)
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

  // Latest nodes/edges mirrored into a ref (from an effect), so callbacks that only read the
  // current graph (pushSnapshot, undo/redo, openDetailsPanel) needn't list nodes/edges in their
  // useCallback deps. Those callbacks go through the memoized DiagramContext value (ADR 0056);
  // churning their identity on every change re-rendered every node and edge on every edit, drag and
  // hover (ADR 0073). Reading a ref inside a callback, not during render, is allowed by the
  // react-hooks lint rules; same pattern as useDetailsPeek and openReferencesFor.
  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  useEffect(() => {
    graphRef.current = { nodes, edges }
  }, [nodes, edges])

  // Which node/handle a connection drag started from — set in onConnectStart,
  // read (and cleared) in onConnectEnd to spawn a new entity when the drag is
  // released over empty canvas instead of a valid handle. See ADR 0107.
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  // The Entity just created by an empty-canvas edge drop (spawnEntityAt),
  // which should open straight into label editing. Transient renderer state
  // — deliberately not on the node's data, so it never reaches the file or
  // an undo snapshot. The node's label clears it once editing has started.
  const [pendingLabelEditId, setPendingLabelEditId] = useState<string | null>(null)
  const clearPendingLabelEdit = useCallback(() => setPendingLabelEditId(null), [])

  // React Flow fires BOTH onReconnectStart and the generic onConnectStart for the same drag of an
  // existing edge's endpoint (its internal `_onConnectStart` composite calls onReconnectStart right
  // before onConnectStart; verified in @xyflow/react's source). Without this flag, a reconnect
  // dropped on empty canvas fired both onConnectEnd (drag-to-empty-space) and onReconnectEnd, each
  // spawning its own node and edge: "two edges end up connected to the new node". Set in
  // onReconnectStart, read by onConnectStart to skip arming connectStartRef for a gesture
  // onReconnectEnd already owns, reset in onReconnectEnd when the gesture ends.
  const isReconnectingRef = useRef(false)

  const {
    past,
    future,
    setPast,
    setFuture,
    pushSnapshot,
    beginContinuousEdit,
    endContinuousEdit,
    undo,
    redo
  } = useHistory({ graphRef, setNodes, setEdges, markDirty })

  const canvasApi: CanvasApi = {
    rfInstance,
    graphRef,
    setNodes,
    setEdges,
    pushSnapshot,
    markDirty,
    currentPath
  }

  const {
    legend,
    setLegend,
    legendPanelOpen,
    setLegendPanelOpen,
    legendPanelAnchor,
    addLegendEntry,
    updateLegendEntry,
    removeLegendEntry,
    toggleLegendPanel
  } = useLegend(canvasApi)

  const {
    highlights,
    setHighlights,
    enabledHighlightIds,
    setEnabledHighlightIds,
    highlightsPanelOpen,
    setHighlightsPanelOpen,
    highlightsPanelAnchor,
    toggleHighlightsPanel,
    addHighlight,
    updateHighlightColor,
    removeHighlight,
    toggleHighlightEnabled,
    toggleHighlightGroup,
    usedTags,
    addOrResyncHighlightGroup,
    matchHighlights
  } = useHighlights(canvasApi, nodes, edges, requiredTags)

  const {
    diagnostics,
    hierarchyLoadNotes,
    setHierarchyLoadNotes,
    stagedFileRemovals,
    setStagedFileRemovals,
    visibleMissingFiles,
    runSync,
    scanMissingFiles,
    stageMissingFileRemoval,
    unstageMissingFileRemoval,
    dismissMissingFile,
    relinkMissingFile
  } = useDiagnostics(canvasApi)

  const {
    edgeDirectionSets,
    setEdgeDirectionSets,
    activeEdgeDirectionSetId,
    setActiveEdgeDirectionSetId,
    switchEdgeDirectionSet,
    addEdgeDirectionSet,
    renameEdgeDirectionSet,
    updateEdgeDirectionSetStyle,
    deleteEdgeDirectionSet
  } = useEdgeDirectionSets(canvasApi, { setPast, setFuture })

  const {
    detailsPanelNodeId,
    setDetailsPanelNodeId,
    diagnosticsPanelOpen,
    setDiagnosticsPanelOpen,
    preferencesPanelOpen,
    setPreferencesPanelOpen,
    layerPanelOpen,
    setLayerPanelOpen,
    entityHighlightNodeId,
    setEntityHighlightNodeId,
    stylePalettePanelOpen,
    setStylePalettePanelOpen,
    alignDistributePanelOpen,
    setAlignDistributePanelOpen,
    diagramSettingsPanelOpen,
    setDiagramSettingsPanelOpen,
    referencesPanelOpen,
    setReferencesPanelOpen,
    changesPanelOpen,
    setChangesPanelOpen,
    changesDiff,
    setChangesDiff,
    persona,
    openDetailsPanel,
    toggleDiagnosticsPanel,
    togglePreferencesPanel,
    toggleStylePalettePanel,
    toggleAlignDistributePanel,
    toggleLayerPanel,
    toggleDiagramSettingsPanel,
    toggleReferencesPanel,
    toggleChangesPanelWith,
    handlePersonaChange
  } = usePanels(canvasApi, { setNoteShadows, setDefaultEdgeStylePicker })

  const {
    security,
    setSecurity,
    securityCombineMethod,
    setSecurityCombineMethod,
    securityAggregateMethod,
    setSecurityAggregateMethod,
    securityCrawl,
    updateSecurity,
    refreshSecurityCrawl,
    updateNodeSecurityCell,
    removeSecurityThreat,
    removeSecurityEntity
  } = useThreatMatrix(canvasApi, persona, { setPast, setFuture })

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
      // Deleting a container promotes its children instead of removing them (ADR 0012), handled
      // apart from React Flow's default remove-change application. RF cascades a delete to every
      // descendant, but onBeforeDelete (resolveDeletion, ADR 0116) has already cut that down to
      // what was asked for: the container plus any child selected too. So a `remove` for a
      // non-container is a real deletion and passes through; a container's removal is replaced by
      // reparenting its surviving children.
      const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id))
      const containerRemovalIds = Array.from(removedIds).filter(
        (removedId) => nodes.find((n) => n.id === removedId)?.type === 'container'
      )
      const passthroughChanges = containerRemovalIds.length
        ? changes.filter((c) => !(c.type === 'remove' && containerRemovalIds.includes(c.id)))
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

  // Narrows React Flow's cascading delete to what was actually asked for: a
  // deleted container's children are promoted (and keep their edges) unless they
  // were selected too (ADR 0012, ADR 0116). Runs for the Delete key, cut and
  // anything else that goes through deleteElements.
  const onBeforeDelete = useCallback<OnBeforeDelete>(
    async ({ nodes: cascadedNodes, edges: cascadedEdges }) =>
      resolveDeletion(cascadedNodes, cascadedEdges),
    []
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

  // Replaces the selection with every element of one type (ADR 0065). Exposed in each type's
  // right-click context menu (EntityNode/ContainerNode/TextNode/LineNode/onEdgeContextMenu), not
  // the top menu bar, which has no submenu support. Whole-type only; finer filtering (e.g. "edges
  // with this routing style") is an open question.
  // Declared early, before selectAll/deselectAll: onEdgeContextMenu needs it, and a useCallback's
  // deps array is evaluated at render time, unlike the callback body, so a later declaration would
  // be a real temporal-dead-zone error.
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

  // Flips the direction of every edge in `ids` in one action (ADR 0087). reverseEdgeDirection
  // (edges/edgeDirectionSets.ts) is a pure Edge -> Edge that swaps endpoints and handles and the
  // direction-tied visuals (points order, labelPosition); mapping it over N edges under one
  // snapshot makes the batch one undo step. With a direction set active, each edge's per-set record
  // is refreshed from these live fields at the next switch/save, so only the active reading is
  // reversed. Declared early for the same deps-array reason as selectAllOfType.
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
    [
      openContextMenu,
      rfInstance,
      nodes,
      edges,
      pushSnapshot,
      setEdges,
      reverseEdges,
      selectAllOfType
    ]
  )

  // Recomputes the disk-vs-memory diff (ADR 0102) — a
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
    security,
    setChangesDiff
  ])

  const toggleChangesPanel = useCallback(
    () => toggleChangesPanelWith(() => void computeChangesDiff()),
    [toggleChangesPanelWith, computeChangesDiff]
  )

  const {
    referenceWindows,
    setReferenceWindows,
    openReferenceWindow,
    closeReferenceWindow,
    addReferencesToNode,
    removeReferenceFromNode,
    openReferencesFor
  } = useReferences(canvasApi)

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

  const updateRequiredTags = useCallback(
    (tags: RequiredTagDefinition[]) => {
      setRequiredTags(tags)
      runSync(tags)
      markDirty()
    },
    [runSync, markDirty]
  )

  const {
    searchOverlayOpen,
    searchQuery,
    deepSearchEnabled,
    setDeepSearchEnabled,
    deepSearchLoading,
    searchRun,
    searchMatchIds,
    searchMatchOrder,
    searchMatchCursor,
    searchIcon,
    searchIconPicker,
    setSearchIconPicker,
    searchQueryProblems,
    searchUnreadable,
    isolateActive,
    focusSearchMatch,
    runSearch,
    nextSearchMatch,
    prevSearchMatch,
    runIsolate,
    onSearchQueryChange,
    closeSearchOverlay,
    toggleSearchOverlay,
    pickSearchIcon,
    toggleSearchIconPicker,
    clearSearchIcon,
    resetSearch
  } = useSearch(canvasApi, nodes, edges, noteShadowsRef)

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
        nodeId in prev
          ? prev
          : { ...prev, [nodeId]: loadedNoteShadow(nodeId, existingPath, stamp, content) }
      )
    })
  }, [detailsPanelNodeId, noteShadows, nodes, currentPath, setNoteShadows])

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
    const { content, stamp } = await window.api.readDetailsWithStamp(
      currentPath,
      shadow.originalPath
    )
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

  // Multi-connection-line, after xyflow's documented pattern
  // (reactflow.dev/examples/edges/multi-connection-line) adapted to explicit connection-point ids:
  // if other connectable nodes are selected when a drag completes, each gets its own edge to the
  // same target. Dragging from an unselected node wires only that node, so this never happens as a
  // side effect of an ordinary drag.
  //
  // The dragged node's edge keeps the exact handle dropped onto (connection.sourceHandle). Every
  // other selected node reuses that handle's clockwise ordinal on the same side
  // (pointOrdinal/connectionPointAtOrdinal in connectionPoints.ts), clamped to the points that side
  // has, rather than picking its own point nearest the target (ADR 0059 addendum: nearest-to-target
  // looked inconsistent, since unrelated entities rarely face the target the same way, while "the
  // same point" reads as deliberate).
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
          ? ensureDirectionSets(
              withNew,
              edgeDirectionSets.map((s) => s.id)
            )
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

  // Anchors new nodes to the middle of whatever part of the canvas is
  // currently visible, not a fixed canvas-coordinate origin — on a large,
  // panned/zoomed-into diagram, a fixed spawn point is very likely off
  // whatever the user is actually looking at. `index` adds a small bounded
  // jitter (wraps every 5) so repeated clicks don't stack exactly on top of
  // each other, without letting position drift indefinitely over a long
  // session the way the old length-based offset did.
  const spawnPosition = useCallback(
    (width: number, height: number, index: number): { x: number; y: number } => {
      const center = rfInstance.screenToFlowPosition(visibleCanvasCenter())
      const jitter = (index % 5) * 24
      return { x: center.x - width / 2 + jitter, y: center.y - height / 2 + jitter }
    },
    [rfInstance]
  )

  // Drag-and-drop counterpart to the addXNode callbacks below (ADR 0064): those spawn near the
  // viewport centre via spawnPosition, this places a node centred under the drop point and
  // reparents it into a container as onNodeDragStop does. It can't use
  // rfInstance.getIntersectingNodes because the new node isn't registered with React Flow at drop
  // time, so it tests drop-point containment against the current containers by hand (simpler than
  // rectangle overlap, and closer to "I dropped it here"). Of several containing (nested)
  // containers, the highest zIndex wins, matching what is visually on top.
  // `presetId` lets a caller that must reference the new node right away (spawnEntityAt, wiring an
  // edge to it) choose the id up front.
  const addNodeAtPosition = useCallback(
    (type: PaletteItemType, dropPoint: { x: number; y: number }, presetId?: string) => {
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
        const id = presetId ?? newNodeId(nodeType)
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

  // Shared tail of onConnectEnd/onReconnectEnd once isVoidDrop has confirmed a drop on genuine
  // empty canvas: create an Entity centred on the drop point (same defaults and container
  // reparenting as a palette drop, ADR 0107), let the caller wire whichever edge end needs it (the
  // one part that differs between a new edge and an existing edge's endpoint), and drop the Entity
  // straight into label editing. The Entity and the edge share one undo step (addNodeAtPosition
  // takes the snapshot).
  const spawnEntityAt = useCallback(
    (clientX: number, clientY: number, wireEdge: (entityId: string) => void): void => {
      const id = newNodeId('entity')
      addNodeAtPosition('entity', rfInstance.screenToFlowPosition({ x: clientX, y: clientY }), id)
      wireEdge(id)
      setPendingLabelEditId(id)
    },
    [rfInstance, addNodeAtPosition]
  )

  // Drag-to-create: releasing a connection drag over empty canvas (rather
  // than onto a valid handle) spawns an Entity there — see isVoidDrop's own
  // comment for why the check is more than just "is event.target the pane."
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      const origin = connectStartRef.current
      connectStartRef.current = null
      if (!origin || !isVoidDrop(event, connectionState)) return

      const point = pointFromEvent(event)
      spawnEntityAt(point.clientX, point.clientY, (entityId) =>
        setEdges((eds) => {
          const withNew = addEdge(
            {
              source: origin.nodeId,
              sourceHandle: origin.handleId,
              target: entityId,
              targetHandle: 'left',
              type: 'labeled',
              data: { metadata: seedMetadata(requiredTags), style: newEdgeStyle }
            },
            eds
          )
          // Seed per-set direction records immediately at 2+ sets — see
          // onConnect above.
          return edgeDirectionSets.length >= 2
            ? ensureDirectionSets(
                withNew,
                edgeDirectionSets.map((s) => s.id)
              )
            : withNew
        })
      )
    },
    [spawnEntityAt, setEdges, requiredTags, newEdgeStyle, edgeDirectionSets]
  )

  // Grabbing an existing edge's own endpoint and dropping it on empty
  // canvas — the reconnect-side counterpart of onConnectEnd above, same
  // Entity outcome. React Flow hands us the edge and which end
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
      spawnEntityAt(point.clientX, point.clientY, (entityId) =>
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
              ? { ...e, source: entityId, sourceHandle: 'left' }
              : { ...e, target: entityId, targetHandle: 'left' }
          })
        )
      )
    },
    [spawnEntityAt, setEdges]
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
      const center = rfInstance.screenToFlowPosition(visibleCanvasCenter())
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

  // Alignment guides and snap-to-shape while dragging (ADR 0019), shared by onNodeDrag (every tick)
  // and onNodeDragStop (once more on release, which is necessary; see there). Snap comes from the
  // lead dragged node only; a multi-node drag applies the same delta to every node, preserving
  // their relative offsets. A dragged node's own descendants move with it, and comparing against
  // them is meaningless (a container always "aligns" with its contents) and draws distracting
  // guides, so they are excluded.
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

  // Fires every drag tick with the live (pre-snap) position already applied to
  // `node`/`draggedNodes` by React Flow's onNodesChange pass, then nudges it by the snap delta in a
  // follow-up setNodes call, which wins as the tick's final state. RF recomputes each tick's drag
  // position from the drag's start plus total pointer movement, not incrementally, so the
  // correction isn't fought: it holds the snapped position while the pointer stays within the
  // threshold, like a Figma or Illustrator smart guide.
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

  // Drag into/out of a container: fires once at the end of a drag, after onNodesChange has applied
  // the final positions (so each node's `.position` is its drop position). No pushSnapshot:
  // reparenting belongs to the gesture whose start already snapshotted via beginContinuousEdit.
  //
  // React Flow's third callback arg is every node that moved in the drag, not just the one under
  // the cursor, and a multi-selected drag must reparent each against its own geometry, or only the
  // grabbed node ends up attached.
  //
  // Re-applies the snap correction onNodeDrag did, recomputed fresh (the pointer may have moved
  // since the last tick). This is not redundant: RF commits one final position straight from the
  // raw pointer (XYDrag's drag-end calls updateNodePositions before onNodeDragStop), overwriting
  // onNodeDrag's per-tick corrections, so without it a node snaps while dragging and jumps back to
  // the unsnapped position on release.
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

  // Modifier+drag duplicate (ADR 0099), called by useModifierDragDuplicate once the pointer has
  // moved. Clones the dragged selection (or just the grabbed node if unselected) plus every
  // descendant of a cloned container, in place, and selects the clones so the replayed drag moves
  // them; the originals keep their ids, edges and position. Edges between cloned nodes are cloned
  // too (like copy/paste, unlike Ctrl+D), and a clone whose parent wasn't cloned stays in that
  // container. The gesture's one undo step opens via beginContinuousEdit and closes at drag end.
  const duplicateForDrag = useEventCallback((grabbedId: string): string | null => {
    const { nodes: all, edges: allEdges } = graphRef.current
    const grabbed = all.find((n) => n.id === grabbedId)
    if (!grabbed || grabbed.data?.locked === true) return null
    const roots = grabbed.selected ? all.filter((n) => n.selected) : [grabbed]
    const ids = new Set(roots.map((n) => n.id))
    for (let grew = true; grew;) {
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

  // Under Edit, via AlignDistributePanel: "Align Vertically" stacks the selection top to bottom,
  // all sharing the leftmost element's left edge with `gapPx` of clear space between neighbours;
  // "Align Horizontally" is the same left to right. Order along the moving axis follows each
  // element's current position, not selection order, so re-running it is idempotent.
  //
  // Works in absolute canvas positions (absolutePosition), not the possibly parent-relative
  // `position`, so a selection spanning different containers still measures real on-screen gaps;
  // results are converted back to parent-relative before writing (as in setContainerForNodes
  // above). `n.width`/`n.height` are React Flow's measured size, as in the drag-time guides
  // (alignment.ts); always set for anything selectable on screen.
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
    const center = rfInstance.screenToFlowPosition(visibleCanvasCenter(true))
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

  // Locked (ADR 0043): blocks drag/resize/rotate and accidental delete via the
  // canvas, see docs/file-format.md's `locked` field. `false` is written
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

  const { showSavedFlash, persistDiagram, handleSave, handleSaveAs, performSaveNow } = useSave(
    canvasApi,
    {
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      setLegend,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security,
      stagedFileRemovals,
      setStagedFileRemovals,
      hubDirty,
      setHubDirty,
      noteShadows,
      setNoteShadows,
      setReferenceWindows,
      setCurrentPath,
      sessionIdRef,
      loadedSavedWithRef,
      reloadHubRef,
      hubBaselineRef,
      dismissedStampRef,
      setExternalChangeStamp
    }
  )

  // PNG export (ADR 0051). Selection outlines and resize/connection-point handles render inside
  // each node based on node.selected, so everything is deselected first (flushSync, so the DOM
  // updates before html-to-image reads it; a plain setNodes/setEdges would commit only after this
  // function returns). That keeps them out of the image without knowing how each node type draws
  // its selected state. Restored afterwards, including on failure. `choice` comes from
  // ExportImageDialog, which is where these values are edited; preferences.pngExport* only remembers
  // the last choice so the dialog reopens prefilled.
  const handleExportPng = useCallback(
    async (choice: ImageExportChoice) => {
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

  // SVG export (ADR 0124): rendered from the diagram's data, not from the DOM, so unlike the PNG
  // export it needs no deselecting, no mounting of off-screen elements and no waiting for a frame.
  // A node that has no stored size is given the size React Flow measured for it.
  const handleExportSvg = useCallback(
    async (choice: ImageExportChoice) => {
      try {
        const sized = nodes.map((n) =>
          n.width == null && n.measured?.width != null && n.measured.height != null
            ? { ...n, width: n.measured.width, height: n.measured.height }
            : n
        )
        const diagram = toDiagramFile(
          sized,
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
        const fileName = currentPath ? currentPath.split(/[\\/]/).pop()! : 'diagram.chd'
        const svg = await buildDiagramSvg(diagram, {
          theme,
          paddingPx: choice.paddingPx,
          transparentBackground: choice.transparentBackground,
          backgroundColorHex: choice.backgroundColorOverride ?? exportPngEffectiveColorHex,
          legendCorner: choice.legendCorner,
          enabledHighlightIds: [...enabledHighlightIds],
          edgeStraightSegmentLength: preferences.edgeStraightSegmentLength,
          diagramPath: currentPath,
          title: fileName.replace(/\.chd$/, '')
        })
        await window.api.exportSvgToFile(svg, fileName.replace(/\.chd$/, '') + '.svg')
      } catch (error) {
        showAlert(`SVG export failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [
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
      currentPath,
      theme,
      exportPngEffectiveColorHex,
      enabledHighlightIds,
      preferences.edgeStraightSegmentLength
    ]
  )

  // Refs can't be read during render (React lint rule, and genuinely
  // unsafe under concurrent rendering) — so ExportImageDialog's color-swatch
  // preview is computed here, once, right as the dialog opens, rather than
  // inline in JSX on every render.
  useEffect(() => {
    if (!exportDialogFormat) return
    const viewportEl = flowWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    setExportPngEffectiveColorHex(
      viewportEl ? rgbStringToHex(resolveEffectiveBackgroundColor(viewportEl)) : '#ffffff'
    )
  }, [exportDialogFormat])

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
      // Anything the load repaired by itself (a dangling container reference, a missing zIndex, a
      // required tag reset, a stale security reference, ...) makes the file differ from what is on
      // disk, so it counts as a change to save (ADR 0128): compare what a save would write with
      // what was read.
      const wouldSave = toDiagramFile(
        syncNodeMetadata(openedNodes, openedRequiredTags, []),
        syncEdgeMetadata(openedEdges, openedRequiredTags, []),
        openedMetadata,
        openedRequiredTags,
        openedHighlights,
        openedLegend,
        openedGravityPresets,
        openedMaxConnectionPointsPerSide,
        openedEdgeDirectionSets,
        openedActiveEdgeDirectionSetId,
        openedSecurity
      )
      // savedWith is stamped by the save itself, and a zIndex the file leaves out is a default (ADR
      // 0035) that never changes how the diagram looks (diagrams written by hand or by an assistant
      // usually omit it), so neither counts.
      const filledZIndex = new Map(wouldSave.nodes.map((n) => [n.id, n.zIndex]))
      const asRead: DiagramFile = {
        ...diagram,
        savedWith: undefined,
        nodes: diagram.nodes.map((n) =>
          n.zIndex === undefined ? { ...n, zIndex: filledZIndex.get(n.id) } : n
        )
      }
      const repairedOnLoad = serializeDiagram(wouldSave) !== serializeDiagram(asRead)
      // A different diagram entirely — old undo history doesn't apply to
      // it (and, worse, undoing across a load boundary would try to
      // restore a previous diagram's nodes into the wrong file context).
      setPast([])
      setFuture([])
      setHubDirty(repairedOnLoad)
      // React Flow measures every freshly mounted node's DOM size via ResizeObserver and reports a
      // 'dimensions' NodeChange with resizing undefined, which by shape alone looks like
      // onNodesChange's "discrete edit" below. That was a harmless extra undo entry until
      // pushSnapshot also marked the diagram dirty; then the auto-measurement pass falsely dirtied
      // every load. Suppressed for a short window after any load.
      suppressAutoMeasureUntilRef.current = Date.now() + 500
      setNodes(openedNodes)
      setEdges(openedEdges)
      // On a large diagram, React Flow's passive ResizeObserver measurement of node handle bounds
      // can take an unpredictable number of render passes to settle. On the Meridian Rail landscape
      // (82 nodes, 84 edges), edges silently failed to render, with no error because
      // @xyflow/react's EdgeWrapper returns null for edges whose endpoints aren't initialized, and
      // sometimes never caught up. updateNodeInternals measures handle bounds synchronously from
      // the DOM (@xyflow/system), so forcing it for every just-loaded node makes every edge resolve
      // immediately instead of racing. Deferred one frame (rAF) because the node elements it
      // targets by data-id don't exist until this render commits.
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
      // The version that last wrote this file (ADR 0118): kept so a save does not
      // lower it, and compared with this app's to warn about a newer file.
      loadedSavedWithRef.current = diagram.savedWith
      void warnIfSavedWithNewer(path, diagram.savedWith)
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
      resetSearch()
      // Defensive, per ADR 0022 — reconcile against hand-edited drift on
      // every load, not just when the template is edited from within the app.
      runSync(openedRequiredTags)
      // ADR 0084 — surface missing referenced files in Diagnostics.
      void scanMissingFiles(openedNodes, openedLegend, path)
    },
    [
      setNodes,
      setEdges,
      runSync,
      scanMissingFiles,
      updateNodeInternals,
      resetSearch,
      setLegend,
      setLegendPanelOpen,
      setHighlights,
      setEnabledHighlightIds,
      setHighlightsPanelOpen,
      setHierarchyLoadNotes,
      setEdgeDirectionSets,
      setActiveEdgeDirectionSetId,
      setSecurity,
      setAlignDistributePanelOpen,
      setChangesDiff,
      setChangesPanelOpen,
      setDetailsPanelNodeId,
      setDiagnosticsPanelOpen,
      setDiagramSettingsPanelOpen,
      setPreferencesPanelOpen,
      setReferencesPanelOpen,
      setPast,
      setFuture,
      setHubDirty,
      setNoteShadows,
      noteShadowsRef,
      setReferenceWindows,
      hubBaselineRef,
      dismissedStampRef,
      setExternalChangeStamp
    ]
  )

  // A window opened with an initial diagram (File -> Open, or either link-navigation flow) gets it
  // via a ?path= query string, read here rather than in main so it reuses the tested load path (ADR
  // 0023). Ref-guarded, not an empty deps array, so it survives StrictMode's dev double-invoke and
  // doesn't re-fire if loadDiagramIntoCanvas's identity changes (ADR 0018 covers why this file is
  // careful about effect double-runs).
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
        showAlert(
          `Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }, [loadDiagramIntoCanvas, markDirty, setNoteShadows])

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
  }, [loadDiagramIntoCanvas, markDirty, setNoteShadows])

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
      const diagram: DiagramFile = {
        ...toDiagramFile(
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
        ),
        savedWith: loadedSavedWithRef.current
      }
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

  // One-line change-count for the close-prompt's native dialog (ADR 0102) —
  // reads the same autosaveStateRef the autosave snapshot uses,
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
        showAlert(
          `Couldn't open ${path}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, edges]
  )

  const handleClearRecent = useCallback(() => {
    updatePreferences({ recentDiagrams: [] })
  }, [updatePreferences])

  // File -> Close does not close the OS window: a window is a diagram, not necessarily disposable.
  // It resets the current diagram to a blank one in the same window through loadDiagramIntoCanvas,
  // the full-state reset every load path uses, instead of scattered setState(initial) calls. The
  // confirm() guard is skipped whenever isDirty says there is nothing to lose, not only when the
  // canvas is empty (a diagram can be dirty while empty: add an entity, delete it).
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
        showAlert(
          `Couldn't save the link: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, persistDiagram]
  )

  // Ctrl/Cmd+click entry point for linked-diagram navigation, exposed via DiagramContext. A node
  // without a link gets a chooser (create new / link existing) at the click point through the
  // generic ContextMenu; a linked node opens straight into a new window (ADR 0023).
  // useEventCallback, not useCallback: the body closes over nodes, currentPath and link
  // sub-handlers that depend on the whole diagram state, so a useCallback would change identity on
  // every edit and, through the memoized DiagramContext value, re-render every node and edge (ADR
  // 0073). It is only called from a Ctrl/Cmd+click, so always-latest-closure semantics are safe.
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

  const {
    styleBrush,
    setStyleBrush,
    toggleStyleBrush,
    pasteStyleToSelection,
    onStyleBrushNodeClick,
    onStyleBrushEdgeClick
  } = useStyleBrush(canvasApi)
  useModifierDragDuplicate({
    enabled: !styleBrush,
    duplicate: duplicateForDrag,
    cancelGesture: endContinuousEdit
  })

  const {
    legendLinePick,
    requestLegendLinePick,
    cancelLegendLinePick,
    abortLegendLinePick,
    onEdgeClick
  } = useLegendLinePick(theme, onStyleBrushEdgeClick)

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
      // "Changes since last save" (ADR 0102).
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
        } else if (legendLinePick) {
          abortLegendLinePick()
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
    setSearchIconPicker,
    shortcutsDialogOpen,
    commandPaletteOpen,
    legendLinePick,
    abortLegendLinePick,
    styleBrush,
    setStyleBrush,
    toggleStyleBrush,
    pasteStyleToSelection,
    closeSearchOverlay,
    diagnosticsPanelOpen,
    setAlignDistributePanelOpen,
    setChangesPanelOpen,
    setDetailsPanelNodeId,
    setDiagnosticsPanelOpen,
    setDiagramSettingsPanelOpen,
    setPreferencesPanelOpen,
    setReferencesPanelOpen,
    setStylePalettePanelOpen,
    highlightsPanelOpen,
    setHighlightsPanelOpen,
    preferencesPanelOpen,
    stylePalettePanelOpen,
    alignDistributePanelOpen,
    diagramSettingsPanelOpen,
    referencesPanelOpen,
    changesPanelOpen,
    toggleChangesPanel,
    referenceWindows,
    setReferenceWindows,
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

  // Each node's persisted stacking order (ADR 0035). No type-based special-casing here: the
  // "containers behind entities" look comes only from the load-time backfill's starting values
  // (applyZIndexBackfill/nextZIndex), not from a render-time rule, so a container dragged above an
  // entity in the layer panel renders above it from then on. React Flow still adds its own
  // selection elevation (elevateNodesOnSelect, on by default).
  //
  // zIndex/draggable/deletable/line-pointerEvents (deriveNodeFields, module scope) come from each
  // node's `data`/`type`, but are kept in sync by this effect instead of rebuilt into a fresh
  // wrapper array every render. React Flow's adoptUserNodes (@xyflow/system) reuses a node's
  // measured internal state (handle bounds, size) only when the exact same node object is passed
  // again; a new wrapper per node per render makes RF treat the whole diagram as unmeasured every
  // render. On a large diagram (the 82-node Meridian Rail landscape) that was a ~300ms stutter at
  // every drag-to-select boundary crossing: one selection toggle produced a new `nodes` array and,
  // with render-time wrappers, rebuilt every unrelated node too (see also the edges-don't-render
  // entry in known-issues.md).
  //
  // deriveNodeFields returns a node's own reference when nothing changes, so the setNodes below
  // replaces only nodes whose derived fields drifted, and bails out entirely (same array) when none
  // did. A ref-based cache read during render would do the same, but this repo's react-compiler
  // lint rule (an error) forbids reading or writing a ref's `.current` during render. Materializing
  // the derived fields onto state, self-correcting, needs no ref, at the cost of one extra render
  // when a node's derived fields really change (locking it, moving it between z-index tiers).
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

  // Stable DOM-order tie-breaker for edges of otherwise equal zIndex. It dates from the
  // reconnect-priority work, but DOM order turned out not to be what decides reconnect-handle
  // hit-testing (docs/known-issues.md); SELECTED_EDGE_Z_BOOST below is the real fix.
  //
  // Returns `edges` itself, by reference, unless an edge is selected; only then is the
  // selected-last reorder built. That keeps the <ReactFlow edges> reference stable in the common
  // case, so React Flow doesn't re-sync its whole edge store on unrelated CanvasInner renders (ADR
  // 0073). Restricting the reorder to "an edge is selected" loses nothing, since it only breaks
  // ties.
  const orderedEdges = useMemo(() => {
    if (!edges.some((e) => e.selected)) return edges
    return [...edges.filter((e) => !e.selected), ...edges.filter((e) => e.selected)]
  }, [edges])

  // An edge has no zIndex of its own (ADR 0035 scoped that to Entity/Container/Text): it sits at
  // the midpoint of its endpoints' current stacking, computed here next to orderedEdges and never
  // persisted.
  //
  // Selected edges are pushed well above that range. React Flow renders each edge in its own `<svg
  // style={{ zIndex }}>` wrapper (a real CSS z-index per edge, not shared paint order), and that
  // zIndex comes from this midpoint computation plus `elevateEdgesOnSelect`, which defaults to
  // false and was never enabled here. So selection had no effect on which edge won at a shared
  // connection point: converging edges resolved by whichever endpoint pair averaged a higher zIndex
  // (docs/known-issues.md). The earlier orderedEdges-only fix (DOM order) only looked like it
  // worked in one test scenario.
  const SELECTED_EDGE_Z_BOOST = 1_000_000
  // Same "materialize onto state, don't rebuild a wrapper every render" reasoning as the
  // node-fields effect above. An edge's zIndex depends on its endpoints' zIndex, so it is
  // recomputed from the current `nodeZIndexById` on each run, but only the edges whose resolved
  // zIndex changed are replaced (deriveEdgeFields, module scope), keeping every other edge's
  // object, and so its LabeledEdge React.memo bailout, stable.
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

  // Plain-data projection for LayerPanel, keeping it decoupled from React Flow's Node type. Sorted
  // highest zIndex first, matching the panel's top-is-frontmost convention (ADR 0035).
  // Container-nesting analysis for the Layers panel and Diagnostics (ADR 0075):
  // - parentLabelById: the immediate parent's label, for the "in: X" badge
  // - invertedZIds: nodes React Flow renders above their own parent even though raw data.zIndex
  //   would put them below (the parentZ + 1 rule in @xyflow/system's calculateChildXYZ). The Layers
  //   panel sorts on raw zIndex, which is what drag-to-restack edits, so these are the rows whose
  //   displayed order disagrees with what is clickable.
  // - outgrownAdvisories: a child whose bounds escape its parent's, which makes the inversion
  //   visible and confusing (warn only, no auto-fix).
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
  // architecture split: file-level actions here, per-diagram
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

  // "Changes since last save" Details bucket (ADR 0102) — reuses
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

  // Mode-aware menu bar (ADR 0079). The Security Matrix persona is still a render-only prototype
  // with no Canvas-level actions (its controls live inside ThreatMatrixView), so "matrix" just
  // hides what doesn't apply: the Edit menu, the diagram-specific View panels and Export as PNG.
  // File basics, Preferences and About are shared. Matrix-specific menus come back once the matrix
  // has persisted state to act on.
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
              onSelect: () => setExportDialogFormat('png')
            },
            {
              label: 'Export as SVG…',
              disabled: nodes.length === 0,
              onSelect: () => setExportDialogFormat('svg')
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
      {
        label: 'Undo',
        accelerator: acceleratorFor('edit.undo'),
        disabled: past.length === 0,
        onSelect: undo
      },
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

  // AI menu (ADR 0103): between View and Help; hidden by the
  // `aiFeaturesEnabled` preference, and omitted rather than rendered empty
  // when it has no items.
  const aiMenuItems: MenuBarItem[] = [
    {
      label: 'Enable AI assistance in a folder…',
      onSelect: () => {
        window.api
          .enableAiInFolder()
          .then((result) => {
            if (result) showAlert(summarizeAiFolderResult(result))
          })
          .catch((err) =>
            showAlert(
              `Could not set up AI assistance: ${err instanceof Error ? err.message : String(err)}`
            )
          )
      }
    },
    // Claude Desktop exists for Windows and macOS only (ADR 0110).
    ...(window.api.platform === 'win32' || window.api.platform === 'darwin'
      ? [
          {
            label: 'Install Claude Desktop extension…',
            onSelect: () => {
              window.api
                .installClaudeExtension()
                .catch((err) =>
                  showAlert(
                    `Could not install the Claude Desktop extension: ${err instanceof Error ? err.message : String(err)}`
                  )
                )
            }
          }
        ]
      : []),
    {
      label: 'Copy AI instructions',
      onSelect: () => {
        window.api.copyToClipboard(AI_INSTRUCTIONS)
        // The dialog's Copy button re-copies the instructions, not this
        // confirmation text (ADR 0104).
        showAlert(
          'Copied the AI instructions to your clipboard. Paste them into a chat with Claude (or another AI assistant), then attach or paste your .chd file.',
          AI_INSTRUCTIONS
        )
      }
    }
  ]
  const aiMenu: MenuBarMenu | null =
    preferences.aiFeaturesEnabled && aiMenuItems.length > 0
      ? {
          label: 'AI',
          // Always visible when the menu is open (ADR 0103): anything an assistant
          // reads is sent to its provider.
          notice: 'Could cause data leaks: what an AI assistant reads is sent to its provider.',
          items: aiMenuItems
        }
      : null

  const menus: MenuBarMenu[] = [
    fileMenu,
    ...(isDiagramPersona ? [editMenu] : []),
    viewMenu,
    ...(aiMenu ? [aiMenu] : []),
    helpMenu
  ]

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

  // Memoized so a high-frequency state change elsewhere in CanvasInner (e.g. dragging a native
  // colour-input handle, dozens of onChange events per second) doesn't re-render every node and
  // edge just because this object got a new identity: consumers subscribe via useContext, which
  // bypasses their React.memo wrapper (that only guards parent prop changes). See ADR 0056. Every
  // function here is useCallback-stable, and effectiveGravityPresets() returns its input reference
  // when non-empty, so this recomputes only when a value really changed.
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
      selectAllOfType,
      pendingLabelEditId,
      clearPendingLabelEdit
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
      selectAllOfType,
      pendingLabelEditId,
      clearPendingLabelEdit
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
            {legendLinePick && (
              <span className="toolbar-style-brush" role="status">
                Legend: click an edge to copy its line
                <button type="button" onClick={abortLegendLinePick}>
                  Cancel (Esc)
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
                }${legendLinePick ? ' legend-line-pick' : ''}`}
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
                  onBeforeDelete={onBeforeDelete}
                  onNodeDrag={onNodeDrag}
                  onNodeDragStop={onNodeDragStop}
                  onNodeClick={onStyleBrushNodeClick}
                  onEdgeClick={onEdgeClick}
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
                  // Overrides React Flow's light/dark default background (ADR 0048). Plain
                  // `backgroundColor` does nothing visible: the paint comes from <Background>'s
                  // absolutely positioned SVG (.react-flow__background), which reads the CSS custom
                  // property --xy-background-color on whichever ancestor defines it
                  // (node_modules/@xyflow/react/dist/style.css). `undefined` is a no-op (React
                  // drops it from the style object), so the theme default applies when none is set.
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
                      // Read directly by LabeledEdge's stroke when selected (ADR 0056), kept off
                      // DiagramContext on purpose: it matters only to the selected edge (usually
                      // zero or one of many), so threading it through Context would re-render every
                      // edge on every change. A CSS variable updates the browser's paint with no
                      // React re-render of any edge.
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
              onRequestLinePick={requestLegendLinePick}
              onCancelLinePick={cancelLegendLinePick}
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
        {exportDialogFormat && (
          <ExportImageDialog
            format={exportDialogFormat}
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
            onClose={() => setExportDialogFormat(null)}
            onConfirm={(choice: ImageExportChoice) => {
              setExportDialogFormat(null)
              updatePreferences({
                pngExportPaddingPx: choice.paddingPx,
                pngExportTransparentBackground: choice.transparentBackground,
                pngExportBackgroundColorOverride: choice.backgroundColorOverride,
                pngExportLegendCorner: choice.legendCorner
              })
              if (exportDialogFormat === 'svg') handleExportSvg(choice)
              else handleExportPng(choice)
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
