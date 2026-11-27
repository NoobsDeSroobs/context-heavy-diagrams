import { showAlert } from '../ui/alerts'
import { useZoomedConnectionHandles } from './useZoomedConnectionHandles'
import { AUTO_HANDLE } from '../nodes/connectionPoints'
import {
  currentAutoHandles,
  currentPointSlides,
  publishPointSlides,
  resolveAutoHandles
} from '../nodes/pointSlideStore'
import { pointSlides } from '@shared/geometry/springPoints'
import { effectiveDiagramFont } from '@shared/styling/fontStack'
import { checkDiagram } from '@shared/conformance/check'
import { hiddenLabels } from '@shared/layout/labelClearance'
import { useConformance } from '../conformance/useConformance'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  editNote,
  loadedNoteShadow,
  newNoteShadow,
  orphanedNoteEdits,
  recoveredNoteShadow,
  type NoteShadow,
  type Stamp
} from '@shared/document/documentSave'
import ConflictDialog from '../document/ConflictDialog'
import SaveAsDialog from '../document/SaveAsDialog'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  ConnectionMode,
  SelectionMode,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type HandleType,
  type Node,
  type NodeChange,
  type OnBeforeDelete,
  type OnConnectStartParams,
  type ReactFlowState
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
  type VisibilitySet,
  type Story,
  type IconRef,
  type IconSlot,
  type JsonValue,
  type LinePoint,
  type MetadataEntry,
  type NodeStyle,
  type RequiredTagDefinition
} from '@shared/diagram'
import { diffDiagrams, type ChangedElement } from '@shared/document/changesSinceSave'
import { resetElement } from './resetElement'
import { ENTITY_MIN_WIDTH, ENTITY_MIN_HEIGHT } from '../nodes/EntityNode'
import { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from '../nodes/TextNode'
import { CONTAINER_MIN_WIDTH, CONTAINER_MIN_HEIGHT } from '../nodes/ContainerNode'
import { scaleGroupMembers, type GroupResizeMember } from './groupResize'
import { LINE_BOUNDS_PADDING } from '../nodes/LineNode'
import { nodeTypes, edgeTypes, DEFAULT_EDGE_OPTIONS, HIDE_ATTRIBUTION } from './flowTypes'
import DiagramSettingsPanel from '../diagram-settings/DiagramSettingsPanel'
import { effectiveGravityPresets } from '../nodes/lineGravityPresets'
import EdgeMarkerDefs from '../edges/edgeMarkers'
import CrossingPeekOf from '../edges/CrossingPeekOf'
import { useModifierHeldClass } from '../edges/useModifierHeldClass'
import { useCarryEdgePoints } from '../edges/useCarryEdgePoints'
import { usePrefersReducedMotion } from '../edges/usePrefersReducedMotion'
import { edgeAnimationIsOn } from '@shared/preferences/preferences'
import { portalNotices, portalNumbers } from '@shared/portals/portals'
import DiagramContext, { type DiagramContextValue } from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu'
import IconPicker from '../icons/IconPicker'
import IconBrowser from '../icons/IconBrowser'
import ColorPickerPopup from '../styling/ColorPickerPopup'
import StylePicker from '../styling/StylePicker'
import EdgeLinePreview from '../styling/EdgeLinePreview'
import NotesPanel from '../notes/NotesPanel'
import DiagnosticsPanel from '../diagnostics/DiagnosticsPanel'
import type { LayoutEntry } from '../layout/LayoutSection'
import ChangesPanel, { type NotesChangedEntry } from '../document/ChangesPanel'
import HighlightsPanel from '../tagging/HighlightsPanel'
import SearchOverlay from '../search/SearchOverlay'
import LegendPanel from '../legend/LegendPanel'
import MenuBar from '../MenuBar'
import LayerPanel from '../layers/LayerPanel'
import { reorderZIndex } from '@shared/canvas/zIndexOrdering'
import {
  connectionPointAtOrdinal,
  pointOrdinal,
  reassignConnectionPointHandles,
  setSideCustomPointCount
} from '../nodes/connectionPoints'
import { nearestSegmentIndex, type PathPoint } from '@shared/geometry/bendablePath'
import {
  nearestPointOnRoute,
  nearestWaypointGap,
  orthogonalRouteVertices
} from '@shared/geometry/orthogonalPath'
import type { Side } from '@shared/geometry/side'
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
import ShortcutsDialog from '../ShortcutsDialog'
import GlossaryDialog from '../GlossaryDialog'
import CommandPalette from '../CommandPalette'
import { findKeyCommand, type CommandId } from '../commands'
import { connectionToNewEntity, reconnectToNewEntity } from './edgeDrop'
import { classifyNodeChanges } from './nodeChangeKind'
import AlertDialog from '../ui/AlertDialog'
import ExportImageDialog, { type ImageExportChoice } from '../export/ExportImageDialog'
import BulkCreateDialog from '../bulk-create/BulkCreateDialog'
import type { PreparedElement } from '@shared/bulk-create/prepare'
import StylePalettePanel from '../styling/StylePalettePanel'
import ReferenceWindow from '../references/ReferenceWindow'
import ReferencesPanel from '../references/ReferencesPanel'
import DiagramDock from '../DiagramDock'
import {
  PALETTE_ITEM_DRAG_TYPE,
  PALETTE_STENCIL_KIND_DRAG_TYPE,
  type PaletteItemType
} from '../palette/ItemPalette'
import { swapStencilKind } from '../nodes/stencilSwap'
import type { ContainerLabelSide } from '@shared/nodes/containerLabel'
import {
  DEFAULT_END_OUTCOME,
  DEFAULT_END_REACH,
  DEFAULT_FLOW_POSITION,
  stencilKind,
  stencilLabelOutside
} from '@shared/stencils/kinds'
import {
  labelPositionOf,
  offsetFrom,
  offsetOf,
  type LabelPosition
} from '@shared/stencils/labelPlacement'
import { stencilLegendRows } from '@shared/legend/legendItems'
import UtilityDock from '../UtilityDock'
import AlignmentGuides from '../alignment/AlignmentGuides'
import { SNAP_THRESHOLD_PX, boundsFrom, computeSnap } from '../alignment/alignment'
import { buildClipboardPayload, parseClipboardPayload, remapForPaste } from './clipboard'
import { waypointEdgeHidden } from './edgeCulling'
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
import { visibleFilter, strayAdvisory } from '@shared/visibility/visibility'
import { lockedForPresenting, withVisibility, setIdsOf } from '../visibility/hiding'
import { useVisibilitySets } from '../visibility/useVisibilitySets'
import VisibilitySetsPanel from '../visibility/VisibilitySetsPanel'
import { useStories } from '../stories/useStories'
import { useStoryFade } from '../stories/useStoryFade'
import { usePresenterActivity } from '../stories/usePresenterActivity'
import { storyStrayAdvisory } from '@shared/visibility/story'
import StoriesPanel from '../stories/StoriesPanel'
import PresenterBar from '../stories/PresenterBar'
import { useDiagnostics } from '../diagnostics/useDiagnostics'
import { useIconPackProblems } from '../diagnostics/useIconPackProblems'
import type { IconPackNote } from '@shared/icons/schema'
import { useEdgeDirectionSets } from '../edges/useEdgeDirectionSets'
import { useThreatMatrix } from '../threat-matrix/useThreatMatrix'
import { useDirtyState } from '../document/useDirtyState'
import { useOutsideChanges } from '../document/useOutsideChanges'
import OutsideChangeNotice from '../document/OutsideChangeNotice'
import IconPackOffer from '../icons/IconPackOffer'
import { useSave } from '../document/useSave'
import { useWindowLifecycle } from '../document/useWindowLifecycle'
import { useWindowTitle } from '../document/useWindowTitle'
import { useDocumentCommands } from '../document/useDocumentCommands'
import { useLinks } from '../links/useLinks'
import { useImageExport } from '../export/useImageExport'
import { useMenus } from '../useMenus'
import { useModifierDragDuplicate } from './useModifierDragDuplicate'
import { useNotesPeek } from '../notes/useNotesPeek'
import PeekCard from '../notes/PeekCard'
import RevisionDialog from '../compare/RevisionDialog'
import { effectiveStylePalette, usePreferences } from '../preferences/preferences'
import ThreatMatrixView from '../threat-matrix/ThreatMatrixView'
import { themeAdaptiveColor } from '../styling/themeAdaptiveColor'
import {
  edgeStyleFromLegendLine,
  newEdgeLineEntry,
  withRoutingOf,
  withNewEdgeLine
} from '@shared/legend/newEdgeLine'
import { deriveNodeFields, deriveEdgeFields, newNodeId, nextZIndex } from './nodeFields'
import { connectionSourceIds } from './multiConnection'
import { isVoidDrop, pointFromEvent, visibleCanvasCenter } from './screenGeometry'
import { sortNodesForHierarchy, removeContainerReparenting } from './hierarchy'
import { resolveEndpointPosition } from '../edges/endpointPosition'
import { notesPanelTitle, noteName, noteSaveState } from '../notes/notesLabels'
import { toDiagramFile, fromDiagramFile } from '../document/diagramConversion'
import { seedMetadata } from '@shared/tagging/metadataSync'
import { syncEdgeMetadata, syncNodeMetadata } from '../tagging/syncElements'

// The minimap's size in pixels (React Flow's own default), fixed so the corner button knows where
// the minimap's top-right corner is.
const MINIMAP_WIDTH = 200
const MINIMAP_HEIGHT = 150

function CanvasInner(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([])
  const carryPoints = useCarryEdgePoints(nodes, edges, setEdges)
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
  useWindowTitle(currentPath, isDirty)
  // Reloads the diagram file from disk keeping unsaved note edits — set once
  // loadDiagramIntoCanvas exists (it is declared after persistDiagram).
  const reloadHubRef = useRef<((path: string) => Promise<void>) | null>(null)
  // What this window last read or wrote of the diagram file: the baseline the window-focus check
  // and the save-time conflict check compare against (ADR 0040).
  const hubBaselineRef = useRef<{ path: string | null; stamp: Stamp }>({ path: null, stamp: null })
  // Diagram-level metadata/requiredTags (ADR 0022) — analogous to
  // currentPath: file-scoped state with no React Flow home of its own,
  // reset on every load, carried into every save via toDiagramFile.
  // The `savedWith` of the file that was loaded (ADR 0118); undefined for a new or
  // marker-less diagram. A ref, not state: nothing renders from it.
  const loadedSavedWithRef = useRef<string | undefined>(undefined)
  // What the loaded file says about the installed icon packs it uses (ADR 0188): the text the
  // Diagnostics panel shows for a pack this machine lacks, and what a save keeps for it.
  const [iconPackNotes, setIconPackNotes] = useState<IconPackNote[]>([])
  const [diagramMetadata, setDiagramMetadata] = useState<Record<string, JsonValue>>({})
  const [requiredTags, setRequiredTags] = useState<RequiredTagDefinition[]>([])
  // Line bend preset catalog — same file-scoped,
  // persisted treatment as highlights/legend above. Raw/possibly-empty;
  // effectiveGravityPresets resolves "empty" to this app's own built-in
  // four wherever it's actually consumed (DiagramContext's own value below).
  const [gravityPresets, setGravityPresets] = useState<GravityPreset[]>([])
  // Diagram-level override for max connection points per side
  // (ADR 0052): undefined means "not overridden," same file-scoped/reset-
  // on-load treatment as gravityPresets above.
  const [diagramMaxConnectionPointsPerSide, setDiagramMaxConnectionPointsPerSide] = useState<
    number | undefined
  >(undefined)
  // The diagram's own font, same file-scoped treatment as the override above.
  const [diagramFontFamily, setDiagramFontFamily] = useState<string | undefined>(undefined)
  // The catalogue of visibility sets (ADR 0194): file-scoped and persisted like the legend, reset
  // on load. Which sets are shown is session state and is not kept here.
  const [visibilitySets, setVisibilitySets] = useState<VisibilitySet[]>([])
  // The stories told over those sets (ADR 0194): file-scoped and persisted the same way. The step
  // being shown is session state and lives in the story hook.
  const [stories, setStories] = useState<Story[]>([])
  // Which sets are hidden right now: session state, never saved, empty when a diagram opens.
  const [hiddenSetIds, setHiddenSetIds] = useState<Set<string>>(() => new Set())
  // The rule of ADR 0194 for the current catalogue and choice: whether an element is visible.
  const isVisibleElement = useMemo(
    () => visibleFilter(visibilitySets, hiddenSetIds),
    [visibilitySets, hiddenSetIds]
  )
  // Edge hover (the hover-revealed bend-point handles of catmull-rom edges) is tracked
  // per edge inside LabeledEdge, not here: one shared hoveredEdgeId materialized onto
  // edge.data rebuilt the whole edges array on every hover.
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const [glossaryDialogOpen, setGlossaryDialogOpen] = useState(false)
  // Command palette.
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  // Which git revision to compare with (ADR 0132): the dialog that asks.
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  // Right-click on the ItemPalette Entity/Container button.
  const [bulkCreateType, setBulkCreateType] = useState<'entity' | 'container' | null>(null)
  // Toolbar's own "current pen style" swatch — reuses
  // StylePicker unchanged, same anchorRect convention as
  // linePicker above, just targeting preferences.defaultEdgeStyle instead of
  // one edge's data.style.
  const [defaultEdgeStylePicker, setDefaultEdgeStylePicker] = useState<DOMRect | null>(null)
  // Global app preference, not diagram content — see preferences.ts.
  // Deliberately not reset by loadDiagramIntoCanvas below; only the panel's
  // open/closed UI state is.
  const { preferences, updatePreferences } = usePreferences()
  // Whether animated edges move: the person's choice if they made one, else what the
  // system's reduced-motion setting says. View -> Animate edges and its shortcut make an explicit
  // choice, the opposite of what is drawn now.
  const systemReducesMotion = usePrefersReducedMotion()
  const edgeAnimationOn = edgeAnimationIsOn(preferences.animateEdges, systemReducesMotion)
  const toggleEdgeAnimation = useCallback(
    () => updatePreferences({ animateEdges: edgeAnimationOn ? 'off' : 'on' }),
    [updatePreferences, edgeAnimationOn]
  )
  // The minimap is a per-person display choice: the corner button and View -> Minimap
  // flip it.
  const minimapOn = preferences.showMinimap
  // The zoom buttons of the corner panel: hidden unless the person asks for them.
  const zoomControlsOn = preferences.showZoomControls
  const toggleZoomControls = useCallback(
    () => updatePreferences({ showZoomControls: !zoomControlsOn }),
    [updatePreferences, zoomControlsOn]
  )
  const toggleMinimap = useCallback(
    () => updatePreferences({ showMinimap: !minimapOn }),
    [updatePreferences, minimapOn]
  )
  useModifierHeldClass()
  // What is drawn: the diagram's font, else the personal default.
  const effectiveFontFamily = effectiveDiagramFont(diagramFontFamily, preferences.defaultFontFamily)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const [iconPicker, setIconPicker] = useState<{ nodeId: string; anchorRect: DOMRect } | null>(null)
  // "Fill…"/"Border…" (nodes) and "Line style…" (edges) context-menu
  // popups. Two separate pieces of state since they target
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
  // Editing a node's note doesn't write to disk immediately — it's just
  // draft state here, flushed as part of the main save flow.
  const rfInstance = useReactFlow()
  const connectionRadius = useZoomedConnectionHandles()
  const { peek, bindings: peekBindings } = useNotesPeek()
  const peekNode = peek ? rfInstance.getNode(peek.nodeId) : undefined
  // The same hold-Ctrl peek on an edge, while crossings are marked: which containers it
  // goes between. It lives beside the note peek, as the one hook already tracks key and pointer.
  const { peek: edgePeek, bindings: edgePeekBindings } = useNotesPeek()
  const updateNodeInternals = useUpdateNodeInternals()
  // Scopes the PNG export capture to this window's own
  // .react-flow__viewport rather than a bare document-wide query — no
  // functional difference today (one ReactFlow per window), just avoids
  // relying on that staying true.
  const flowWrapperRef = useRef<HTMLDivElement>(null)

  // Latest nodes/edges mirrored into a ref (from an effect), so callbacks that only read the
  // current graph (pushSnapshot, undo/redo, openNotesPanel) needn't list nodes/edges in their
  // useCallback deps. Those callbacks go through the memoized DiagramContext value;
  // churning their identity on every change re-rendered every node and edge on every edit, drag and
  // hover. Reading a ref inside a callback, not during render, is allowed by the
  // react-hooks lint rules; same pattern as useNotesPeek and openReferencesFor.
  const graphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  useEffect(() => {
    graphRef.current = { nodes, edges }
  }, [nodes, edges])

  // Which node/handle a connection drag started from — set in onConnectStart,
  // read (and cleared) in onConnectEnd to spawn a new entity when the drag is
  // released over empty canvas instead of a valid handle.
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
    isContinuousEdit,
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

  const visibilitySetsUi = useVisibilitySets(
    canvasApi,
    nodes,
    edges,
    visibilitySets,
    setVisibilitySets,
    hiddenSetIds,
    setHiddenSetIds
  )
  const setVisibilitySetsPanelOpen = visibilitySetsUi.setPanelOpen
  // The elements in no set, which a story cannot hide (ADR 0194): the Stories panel says how many.
  const unassignedCount = useMemo(
    () => [...nodes, ...edges].filter((e) => (setIdsOf(e)?.length ?? 0) === 0).length,
    [nodes, edges]
  )
  // Search and isolate do not see what the sets hide (ADR 0194).
  const searchableNodes = useMemo(
    () => (hiddenSetIds.size === 0 ? nodes : nodes.filter((n) => isVisibleElement(setIdsOf(n)))),
    [nodes, hiddenSetIds, isVisibleElement]
  )
  const searchableEdges = useMemo(
    () => (hiddenSetIds.size === 0 ? edges : edges.filter((e) => isVisibleElement(setIdsOf(e)))),
    [edges, hiddenSetIds, isVisibleElement]
  )

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

  // The legend rows for the kinds of step and event in use (ADR 0080). Hiding them is for this
  // session only: nothing about it is saved with the diagram.
  const [showStencilLegend, setShowStencilLegend] = useState(true)
  // Gates on the edges that cross a container's border: a switch for this session, off
  // because most diagrams do not care about crossings and it adds to the canvas.
  const [showCrossings, setShowCrossings] = useState(false)
  // The number each portalled edge shows (typed, else from the order in the file). Kept as one
  // object until a number changes, so selecting or editing an edge does not re-render every edge
  // through the context.
  const portalNumberKey = useMemo(
    () =>
      JSON.stringify([
        ...portalNumbers(
          edges.map((e) => ({
            id: e.id,
            style: (e.data?.style as EdgeStyle | undefined) ?? undefined
          }))
        )
      ]),
    [edges]
  )
  const portalNumberMap = useMemo(
    () => new Map<string, number>(JSON.parse(portalNumberKey) as [string, number][]),
    [portalNumberKey]
  )
  const [edgeLengths] = useState(() => new Map<string, () => number>())
  const toggleCrossings = useCallback(() => setShowCrossings((on) => !on), [])
  const stencilRows = useMemo(
    () =>
      stencilLegendRows(
        nodes.map((n) => ({
          type: n.type,
          data: {
            kind: typeof n.data?.kind === 'string' ? n.data.kind : undefined,
            outcome: n.data?.outcome,
            reach: n.data?.reach
          }
        }))
      ),
    [nodes]
  )

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
    removeHighlightGroup,
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
    notesPanelNodeId,
    setNotesPanelNodeId,
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
    storiesPanelOpen,
    setStoriesPanelOpen,
    changesPanelOpen,
    setChangesPanelOpen,
    changesDiff,
    setChangesDiff,
    persona,
    openNotesPanel,
    toggleDiagnosticsPanel,
    togglePreferencesPanel,
    showPreferencesPanel,
    toggleStylePalettePanel,
    toggleAlignDistributePanel,
    toggleLayerPanel,
    toggleDiagramSettingsPanel,
    toggleReferencesPanel,
    toggleStoriesPanel,
    toggleChangesPanelWith,
    handlePersonaChange
  } = usePanels(canvasApi, { setNoteShadows, setDefaultEdgeStylePicker })

  // Stories drive which sets are hidden (ADR 0194).
  const storiesUi = useStories(
    canvasApi,
    stories,
    setStories,
    visibilitySets,
    hiddenSetIds,
    visibilitySetsUi.setHidden,
    storiesPanelOpen
  )
  const storiesPresenting = storiesUi.presenting
  // The presenter fades what appears and disappears between steps (ADR 0194).
  const storyFade = useStoryFade(storiesPresenting, nodes, edges, visibilitySets, hiddenSetIds)
  // The presenter's bar shows when the mouse moves and goes when it is still (ADR 0194).
  const presenterAwake = usePresenterActivity(storiesPresenting)
  const handlePresenterKey = storiesUi.handlePresenterKey
  const resetStories = storiesUi.reset
  // The floating sets panel is put away before the presentation starts.
  const presentStoryFrom = storiesUi.present
  const presentStory = useCallback(() => {
    setVisibilitySetsPanelOpen(false)
    presentStoryFrom()
  }, [presentStoryFrom, setVisibilitySetsPanelOpen])

  // One notice for the diagram and every note that changed outside the app (ADR 0040).
  const outsideChanges = useOutsideChanges({
    currentPath,
    hubBaselineRef,
    hubDirty,
    noteShadows,
    setNoteShadows,
    noteLabel: (nodeId) => noteName(nodes.find((n) => n.id === nodeId)),
    notesPanelNodeId,
    reloadHubRef
  })
  const { clear: clearOutsideChanges, reset: resetOutsideChanges } = outsideChanges

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
      const { starting, ending, discrete } = classifyNodeChanges(changes)
      if (starting) beginContinuousEdit()
      else if (discrete) pushSnapshot()
      if (ending) endContinuousEdit()
      // Deleting a container promotes its children instead of removing them (ADR 0012), handled
      // apart from React Flow's default remove-change application. RF cascades a delete to every
      // descendant, but onBeforeDelete (resolveDeletion) has already cut that down to
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
  // were selected too (ADR 0012). Runs for the Delete key, cut and
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
      // A gesture that opened its undo step (beginContinuousEdit) already has its snapshot, so an
      // edge-data update inside it, such as sliding a label, does not add one per move.
      if (changes.some((change) => change.type !== 'select') && !isContinuousEdit()) pushSnapshot()
      onEdgesChangeBase(changes)
    },
    [onEdgesChangeBase, pushSnapshot, isContinuousEdit]
  )

  const openContextMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    setContextMenu({ x, y, items })
  }, [])

  // Replaces the selection with every element of one type. Exposed in each type's
  // right-click context menu (EntityNode/ContainerNode/TextNode/LineNode/onEdgeContextMenu), not
  // the top menu bar, which has no submenu support. Whole-type only; finer filtering (e.g. "edges
  // with this routing style") is an open question.
  // Declared early, before selectAll/deselectAll: onEdgeContextMenu needs it, and a useCallback's
  // deps array is evaluated at render time, unlike the callback body, so a later declaration would
  // be a real temporal-dead-zone error.
  const selectAllOfType = useCallback(
    (type: 'entity' | 'container' | 'text' | 'line' | 'stencil' | 'edge') => {
      // A hidden element is never selected (ADR 0194).
      setNodes((nds) =>
        nds.map((n) => {
          const want = n.type === type && isVisibleElement(setIdsOf(n))
          return n.selected === want ? n : { ...n, selected: want }
        })
      )
      setEdges((eds) =>
        eds.map((e) => {
          const want = type === 'edge' && isVisibleElement(setIdsOf(e))
          return e.selected === want ? e : { ...e, selected: want }
        })
      )
    },
    [setNodes, setEdges, isVisibleElement]
  )

  // Flips the direction of every edge in `ids` in one action. reverseEdgeDirection
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

  // A double-click on a behaviour or an edge opens its label for writing, empty or not: the label of
  // a small shape sits outside it and an empty one has nothing to hit. A double-click on a label
  // already open is the text field's own (selecting a word), and is left alone.
  const onLabelDoubleClick = useCallback(
    (event: React.MouseEvent, element: Node | Edge): void => {
      if (storiesPresenting) return
      if (element.type !== 'stencil' && !('source' in element)) return
      if ((event.target as HTMLElement).closest('textarea, input')) return
      setPendingLabelEditId(element.id)
    },
    [storiesPresenting]
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
      // one and leaves the selection alone.
      const reverseTargetIds =
        edge.selected && edges.some((e) => e.selected && e.id !== edge.id)
          ? edges.filter((e) => e.selected).map((e) => e.id)
          : [edge.id]
      // A right-angled edge shows no dot on its points, so a point is removed by right-clicking
      // close to it.
      const edgeRouting = (edge.data?.style as EdgeStyle | undefined)?.routingStyle
      const edgePoints = (edge.data?.points as LinePoint[] | undefined) ?? []
      const reach = 14 / rfInstance.getViewport().zoom
      const nearIndex =
        edgeRouting === 'step' || edgeRouting === 'smoothstep'
          ? edgePoints.findIndex((p) => Math.hypot(p.x - clickPoint.x, p.y - clickPoint.y) <= reach)
          : -1
      const removePointItems =
        nearIndex >= 0
          ? [
              {
                label: 'Remove point',
                onSelect: () => {
                  pushSnapshot()
                  setEdges((eds) =>
                    eds.map((e) =>
                      e.id === edge.id
                        ? {
                            ...e,
                            data: {
                              ...e.data,
                              points: edgePoints.filter((_, i) => i !== nearIndex)
                            }
                          }
                        : e
                    )
                  )
                }
              }
            ]
          : []
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
          label: 'Attach automatically',
          onSelect: () => {
            pushSnapshot()
            setEdges((eds) =>
              eds.map((e) =>
                e.id === edge.id ? { ...e, sourceHandle: null, targetHandle: null } : e
              )
            )
          }
        },
        {
          label: 'Fix to current points',
          onSelect: () => {
            const picked = currentAutoHandles().get(edge.id)
            if (!picked) return
            pushSnapshot()
            setEdges((eds) =>
              eds.map((e) =>
                e.id === edge.id
                  ? {
                      ...e,
                      sourceHandle: e.sourceHandle || picked.sourceHandle || null,
                      targetHandle: e.targetHandle || picked.targetHandle || null
                    }
                  : e
              )
            )
          }
        },
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
            const picked = currentAutoHandles().get(edge.id)
            const source = resolveEndpointPosition(
              edge.source,
              edge.sourceHandle || picked?.sourceHandle,
              nodeById,
              currentPointSlides()
            )
            const target = resolveEndpointPosition(
              edge.target,
              edge.targetHandle || picked?.targetHandle,
              nodeById,
              currentPointSlides()
            )
            const newPoint: LinePoint = { x: clickPoint.x, y: clickPoint.y }

            let newPoints: LinePoint[]
            let newRoutingStyle: EdgeStyle['routingStyle']
            if (routingStyle === 'step' || routingStyle === 'smoothstep') {
              // Keep the right-angled routing; the new waypoint just gets
              // forced into the orthogonal path. Insert it in the
              // gap of [source, ...points, target] it's nearest to.
              //
              // The point goes onto the drawn route, not where the pointer happened to be a few
              // units beside it, which would give the stubs at each end a jog.
              const sideOf = (d: { x: number; y: number } | undefined): Side =>
                !d ? 'left' : d.x > 0 ? 'right' : d.x < 0 ? 'left' : d.y > 0 ? 'bottom' : 'top'
              const onRoute = nearestPointOnRoute(
                orthogonalRouteVertices(
                  source,
                  sideOf(source.direction),
                  points,
                  target,
                  sideOf(target.direction)
                ),
                clickPoint
              )
              newPoint.x = onRoute.x
              newPoint.y = onRoute.y
              const gap = nearestWaypointGap(source, points, target, onRoute)
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
              // catmull-rom routing in the first place — no prior
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
        },
        ...removePointItems,
        {
          // Back to the routing's own default: every point (from "Add point here" or from dragging a
          // segment) and the label's slide along the line go; the routing style, the connection
          // points and the look stay.
          label:
            reverseTargetIds.length > 1
              ? `Reset route (${reverseTargetIds.length})`
              : 'Reset route',
          onSelect: () => {
            const ids = new Set(reverseTargetIds)
            pushSnapshot()
            setEdges((eds) =>
              eds.map((e) => {
                if (!ids.has(e.id)) return e
                const style = { ...(e.data?.style as EdgeStyle | undefined) }
                delete style.labelPosition
                return { ...e, data: { ...e.data, points: [], style } }
              })
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

  // Recomputes the disk-vs-memory diff — a
  // side-effect-free reread (never recordOpenedOrSaved) via
  // rereadDiagramForDiff, diffed against the same toDiagramFile() shape the
  // real save path uses. A never-saved diagram (currentPath null) diffs
  // against createEmptyDiagram().
  // What a save would write right now: the window's own version of the diagram.
  const buildCurrentDiagram = useCallback(
    () =>
      toDiagramFile(
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
        diagramFontFamily,
        visibilitySets,
        stories
      ),
    [
      nodes,
      edges,
      diagramMetadata,
      requiredTags,
      highlights,
      legend,
      gravityPresets,
      diagramMaxConnectionPointsPerSide,
      diagramFontFamily,
      visibilitySets,
      stories,
      edgeDirectionSets,
      activeEdgeDirectionSetId,
      security
    ]
  )

  const computeChangesDiff = useCallback(async () => {
    const saved = currentPath
      ? ((await window.api.rereadDiagramForDiff(currentPath)) ?? createEmptyDiagram())
      : createEmptyDiagram()
    setChangesDiff(diffDiagrams(saved, buildCurrentDiagram()))
  }, [currentPath, buildCurrentDiagram, setChangesDiff])

  // "Reset to saved" on a row of the changes panel: puts that one element back as the saved file
  // has it, as one undoable edit, and refreshes the list. The saved file is read again so the
  // reset never works from a list gone stale; it is read the way a load reads it, so the element
  // is the same shape the canvas holds.
  const refreshChanges = useEventCallback(() => void computeChangesDiff())
  // Bumped by a reset; the effect below then recomputes the list once React has applied it.
  const [changesRefreshTick, setChangesRefreshTick] = useState(0)
  useEffect(() => {
    if (changesRefreshTick > 0) refreshChanges()
  }, [changesRefreshTick, refreshChanges])
  // Puts one element back as "earlier" (a version of this diagram) has it, as one undoable edit.
  // Returns why it could not, or null when it was done. Shared by the changes panel (earlier = the
  // saved file) and the compare window (earlier = the version it shows).
  const putElementBack = useEventCallback(
    (
      earlier: DiagramFile,
      element: { kind: 'node' | 'edge'; id: string; changeType: ChangedElement['changeType'] }
    ): string | null => {
      // Edges are shown in the active reading's orientation; the earlier one must be too.
      const earlierGraph = fromDiagramFile({ ...earlier, activeEdgeDirectionSetId })
      const result = resetElement(
        graphRef.current,
        { nodes: earlierGraph.nodes, edges: earlierGraph.edges },
        element.kind,
        element.id,
        element.changeType
      )
      if (!result.ok) return result.message
      pushSnapshot()
      setNodes(result.nodes)
      setEdges(result.edges)
      setChangesRefreshTick((tick) => tick + 1)
      return null
    }
  )
  const resetChangedElement = useEventCallback(async (element: ChangedElement) => {
    const savedFile = currentPath
      ? await window.api.rereadDiagramForDiff(currentPath)
      : createEmptyDiagram()
    if (!savedFile) {
      showAlert('The saved file could not be read, so nothing was reset.')
      return
    }
    const problem = putElementBack(savedFile, element)
    if (problem) showAlert(problem)
  })

  // A revert asked for in a compare window of this diagram (ADR 0132): the same action, with the
  // earlier version that window shows.
  useEffect(
    () =>
      window.api.onCompareRevertRequest((request) => {
        const problem = putElementBack(request.base, {
          kind: request.kind,
          id: request.id,
          changeType: request.change
        })
        void window.api.answerCompareRevert(
          request.requestId,
          problem === null ? { ok: true } : { ok: false, message: problem }
        )
      }),
    [putElementBack]
  )

  // Compare the file on disk with the same file at a git revision (ADR 0132). Whatever stops it
  // (no git, not a repository, an unknown revision) comes back as a sentence to show.
  const compareWithGit = useCallback(
    async (revision: string) => {
      if (!currentPath) return
      const result = await window.api.compareWithGit(currentPath, revision)
      if (!result.ok) showAlert(result.message ?? 'The comparison could not be made.')
    },
    [currentPath]
  )

  // "Review changes" on the changed-on-disk banner: opens the compare window with this window's
  // version as the earlier one and the file as it is on disk now as the later one, so the
  // reviewer sees what the outside edit did without leaving for git.
  const reviewDiskChanges = useCallback(async () => {
    if (!currentPath) return
    const onDisk = await window.api.rereadDiagramForDiff(currentPath)
    if (!onDisk) {
      showAlert('The file on disk could not be read, so there is nothing to compare.')
      return
    }
    await window.api.openCompareWindow({
      base: buildCurrentDiagram(),
      next: onDisk,
      diagramPath: currentPath,
      title: `Review changes: ${currentPath.split(/[/\\]/).pop()} (this window → file on disk)`
    })
  }, [currentPath, buildCurrentDiagram])

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
  // — nothing reference-specific about it.
  const revealNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.selected === (n.id === nodeId) ? n : { ...n, selected: n.id === nodeId }))
      )
      rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 })
    },
    [setNodes, rfInstance]
  )

  // Select one edge and frame the two elements it joins (a row of the Diagnostics layout section).
  const revealEdge = useCallback(
    (entry: LayoutEntry) => {
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
      setEdges((eds) =>
        eds.map((e) =>
          e.selected === (e.id === entry.edgeId) ? e : { ...e, selected: e.id === entry.edgeId }
        )
      )
      rfInstance.fitView({
        nodes: [{ id: entry.sourceId }, { id: entry.targetId }],
        duration: 300,
        padding: 0.5
      })
    },
    [setNodes, setEdges, rfInstance]
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

  const updateDiagramFontFamily = useCallback(
    (value: string | undefined) => {
      setDiagramFontFamily(value)
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
  } = useSearch(canvasApi, searchableNodes, searchableEdges, noteShadowsRef)

  // Gathers this diagram's own direct linked-node relative paths (deeper
  // levels are discovered from disk during the walk),
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
  // openNotesPanel). Stamped before reading (see notes:readWithStamp) so a
  // change in between is caught, not missed.
  useEffect(() => {
    if (!notesPanelNodeId || notesPanelNodeId in noteShadows) return
    const node = nodes.find((n) => n.id === notesPanelNodeId)
    const existingPath = typeof node?.data?.notes === 'string' ? node.data.notes : undefined
    if (!existingPath || !currentPath) return
    const nodeId = notesPanelNodeId
    window.api.readNotesWithStamp(currentPath, existingPath).then(({ content, stamp }) => {
      setNoteShadows((prev) =>
        nodeId in prev
          ? prev
          : { ...prev, [nodeId]: loadedNoteShadow(nodeId, existingPath, stamp, content) }
      )
    })
  }, [notesPanelNodeId, noteShadows, nodes, currentPath, setNoteShadows])

  // Style seeded onto a brand-new edge: the global
  // default-edge-style preference, overlaid with the active edge direction
  // set's own default style if one is set. An edge drawn while a reading is
  // active is thus born in that reading's look; existing edges are never
  // touched.
  // The legend line new edges follow, when the diagram has marked one: its look replaces the
  // personal default, so a new edge means what the legend says. The colour is the one the legend shows
  // in the theme now, stored the way an edge stores a colour.
  const newEdgeLine = useMemo(() => newEdgeLineEntry(legend), [legend])
  const defaultEdgeLook = useMemo<EdgeStyle>(
    () =>
      newEdgeLine
        ? withRoutingOf(
            edgeStyleFromLegendLine(
              newEdgeLine,
              newEdgeLine.color !== undefined
                ? themeAdaptiveColor(newEdgeLine.color, theme)
                : undefined
            ),
            preferences.defaultEdgeStyle
          )
        : preferences.defaultEdgeStyle,
    [newEdgeLine, theme, preferences.defaultEdgeStyle]
  )
  const newEdgeStyle = useMemo<EdgeStyle>(
    () => ({
      ...defaultEdgeLook,
      ...activeDirectionSetStyle(edgeDirectionSets, activeEdgeDirectionSetId)
    }),
    [defaultEdgeLook, edgeDirectionSets, activeEdgeDirectionSetId]
  )

  // Multi-connection-line, after xyflow's documented pattern
  // (reactflow.dev/examples/edges/multi-connection-line) adapted to explicit connection-point ids:
  // if the node a drag starts from is selected along with other connectable nodes, each gets its
  // own edge to the same target. Dragging from an unselected node wires only that node, so this
  // never happens as a side effect of an ordinary drag (connectionSourceIds).
  //
  // The dragged node's edge keeps the exact handle dropped onto (connection.sourceHandle). Every
  // other selected node reuses that handle's clockwise ordinal on the same side
  // (pointOrdinal/connectionPointAtOrdinal in connectionPoints.ts), clamped to the points that side
  // has, rather than picking its own point nearest the target (nearest-to-target
  // looked inconsistent, since unrelated entities rarely face the target the same way, while "the
  // same point" reads as deliberate).
  const onConnect = useCallback(
    (dropped: Connection) => {
      // The central target names no point: that end attaches by itself.
      const connection: Connection = {
        ...dropped,
        sourceHandle: dropped.sourceHandle === AUTO_HANDLE ? null : dropped.sourceHandle,
        targetHandle: dropped.targetHandle === AUTO_HANDLE ? null : dropped.targetHandle
      }
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
        const sourceIds = connectionSourceIds(nodes, connection.source, connection.target)
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
        // diagram has 2+ direction sets, rather than lazily at
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
    (oldEdge: Edge, dropped: Connection) => {
      pushSnapshot()
      const newConnection: Connection = {
        ...dropped,
        sourceHandle: dropped.sourceHandle === AUTO_HANDLE ? null : dropped.sourceHandle,
        targetHandle: dropped.targetHandle === AUTO_HANDLE ? null : dropped.targetHandle
      }
      setEdges((eds) => {
        const stored = eds.find((e) => e.id === oldEdge.id)
        const known = new Set(eds.map((e) => e.id))
        return reconnectEdge(oldEdge, newConnection, eds).map((e) => {
          if (!stored || (e.id !== oldEdge.id && known.has(e.id))) return e
          // The end that was not dragged keeps what the file says, a point or none: the handle React
          // Flow was given for it is the one the automatic attachment chose.
          const sameSource =
            newConnection.source === oldEdge.source &&
            newConnection.sourceHandle === oldEdge.sourceHandle
          const sameTarget =
            newConnection.target === oldEdge.target &&
            newConnection.targetHandle === oldEdge.targetHandle
          return {
            ...e,
            sourceHandle: sameSource ? stored.sourceHandle : e.sourceHandle,
            targetHandle: sameTarget ? stored.targetHandle : e.targetHandle
          }
        })
      })
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

  // Drag-and-drop counterpart to the addXNode callbacks below: those spawn near the
  // viewport centre via spawnPosition, this places a node centred under the drop point and
  // reparents it into a container as onNodeDragStop does. It can't use
  // rfInstance.getIntersectingNodes because the new node isn't registered with React Flow at drop
  // time, so it tests drop-point containment against the current containers by hand (simpler than
  // rectangle overlap, and closer to "I dropped it here"). Of several containing (nested)
  // containers, the highest zIndex wins, matching what is visually on top.
  // `presetId` lets a caller that must reference the new node right away (spawnEntityAt, wiring an
  // edge to it) choose the id up front.
  const addNodeAtPosition = useCallback(
    (
      type: PaletteItemType,
      dropPoint: { x: number; y: number },
      presetId?: string,
      kindId?: string
    ) => {
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
          case 'stencil': {
            const kind = stencilKind(kindId)
            width = kind.size.width
            height = kind.size.height
            nodeType = 'stencil'
            data = {
              label: kind.defaultLabel,
              kind: kind.id,
              zIndex: nextZIndex(nds, 'stencil')
            }
            break
          }
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
  // reparenting as a palette drop), let the caller wire whichever edge end needs it (the
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
              ...connectionToNewEntity(origin, entityId),
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
          // `handleType` here is React Flow's own "oppositeHandle" type — the FIXED end that's
          // staying put, not the one being dragged (grabbing the source anchor passes the
          // *target*'s type, and vice versa), so reconnectToNewEntity reads it the inverse way.
          eds.map((e) => (e.id === edge.id ? reconnectToNewEntity(e, handleType, entityId) : e))
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
        rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        undefined,
        type === 'stencil' ? event.dataTransfer.getData(PALETTE_STENCIL_KIND_DRAG_TYPE) : undefined
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

  // A stencil of the given kind (ADR 0080) near the viewport centre.
  const addStencilNode = useCallback(
    (kindId: string) => {
      pushSnapshot()
      const kind = stencilKind(kindId)
      const id = newNodeId('stencil')
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'stencil',
          position: spawnPosition(kind.size.width, kind.size.height, nds.length),
          width: kind.size.width,
          height: kind.size.height,
          data: {
            label: kind.defaultLabel,
            kind: kind.id,
            zIndex: nextZIndex(nds, 'stencil')
          }
        }
      ])
    },
    [setNodes, pushSnapshot, spawnPosition]
  )

  // Changes the kind of these stencils, one undo step (ADR 0080).
  const setStencilKind = useCallback(
    (nodeIds: string[], kindId: string) => {
      const ids = new Set(nodeIds)
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => (ids.has(n.id) && n.type === 'stencil' ? swapStencilKind(n, kindId) : n))
      )
    },
    [setNodes, pushSnapshot]
  )

  // Sets how these ends finish and how far they reach, and whether these events start a flow or sit
  // in one, one undo step. The defaults (success, this path, in the flow) are stored as nothing, and a
  // field is only set on the kinds that have it.
  const setStencilState = useCallback(
    (nodeIds: string[], change: { outcome?: string; reach?: string; flowPosition?: string }) => {
      const ids = new Set(nodeIds)
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (!ids.has(n.id) || n.type !== 'stencil') return n
          const kind = stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined)
          const data = { ...n.data }
          if (kind.endsFlow && change.outcome !== undefined) {
            data.outcome = change.outcome === DEFAULT_END_OUTCOME ? undefined : change.outcome
          }
          if (kind.endsFlow && change.reach !== undefined) {
            data.reach = change.reach === DEFAULT_END_REACH ? undefined : change.reach
          }
          if (kind.positioned && change.flowPosition !== undefined) {
            data.flowPosition =
              change.flowPosition === DEFAULT_FLOW_POSITION ? undefined : change.flowPosition
          }
          return { ...n, data }
        })
      )
    },
    [setNodes, pushSnapshot]
  )

  // Moves the label of these small shapes to another side, or sets it free where it is, one undo
  // step. A label made free keeps its place, so it does not jump.
  const setStencilLabelPosition = useCallback(
    (nodeIds: string[], position: LabelPosition) => {
      const ids = new Set(nodeIds)
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) => {
          if (!ids.has(n.id) || n.type !== 'stencil') return n
          const kind = stencilKind(typeof n.data?.kind === 'string' ? n.data.kind : undefined)
          if (!stencilLabelOutside(kind.id)) return n
          const was = labelPositionOf(n.data?.labelPosition)
          if (was === position) return n
          const shape = {
            x: 0,
            y: 0,
            width: n.width ?? n.measured?.width ?? kind.size.width,
            height: n.height ?? n.measured?.height ?? kind.size.height
          }
          const labelOffset =
            position === 'free'
              ? (offsetOf(n.data?.labelOffset) ?? offsetFrom(was, shape, { width: 70, height: 16 }))
              : undefined
          return {
            ...n,
            data: {
              ...n.data,
              labelPosition: position === 'below' ? undefined : position,
              labelOffset
            }
          }
        })
      )
    },
    [setNodes, pushSnapshot]
  )

  // Moves the label of these containers to another side, one undo step.
  const setContainerLabelSide = useCallback(
    (nodeIds: string[], side: ContainerLabelSide) => {
      const ids = new Set(nodeIds)
      pushSnapshot()
      setNodes((nds) =>
        nds.map((n) =>
          ids.has(n.id) && n.type === 'container'
            ? { ...n, data: { ...n.data, labelPosition: side === 'top' ? undefined : side } }
            : n
        )
      )
    },
    [setNodes, pushSnapshot]
  )

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
        // the fallback when the user hasn't set a real default
        // — once they have, their own choice wins outright
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

  // Bulk counterpart to addEntityNode/addContainerNode for a
  // table paste, whose elements arrive with their metadata and note. One
  // pushSnapshot/setNodes for the whole batch (one undo step), laid out in
  // a grid centered on the viewport rather than spawnPosition's small
  // per-click jitter (which exists to keep repeated single clicks visibly
  // apart, not to lay out a deliberate batch). nextZIndex is recomputed
  // against the array as it grows within the same batch, so zIndex among
  // the new nodes stays deterministic (first line = lowest).
  const addMultipleNodes = useCallback(
    (type: 'entity' | 'container', elements: PreparedElement[]) => {
      if (elements.length === 0) return
      const labels = elements.map((e) => e.label)
      // Ids are made up front: the notes below are kept by node id, and an updater function may run
      // more than once.
      const ids = elements.map(() => newNodeId(type))
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
                  metadata: elements[index].metadata,
                  style: preferences.defaultStyles.entity
                }
              : {
                  label: labels[index],
                  zIndex: nextZIndex(acc, 'container'),
                  style: preferences.defaultStyles.container ?? {
                    fill: 'var(--ev-c-gray-1)',
                    fillOpacity: 20
                  },
                  metadata: elements[index].metadata
                }
          acc = [
            ...acc,
            {
              id: ids[index],
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
      // A note is a file written at the next Save (ADR 0040): until then it is an unsaved note with
      // no file yet, like one typed into a new element's panel.
      const notes = elements.flatMap((e, index) => (e.note ? [[ids[index], e.note] as const] : []))
      if (notes.length > 0) {
        setNoteShadows((prev) => ({
          ...prev,
          ...Object.fromEntries(
            notes.map(([id, note]) => [id, recoveredNoteShadow(id, null, note)])
          )
        }))
      }
    },
    [
      setNodes,
      setNoteShadows,
      pushSnapshot,
      rfInstance,
      preferences.defaultStyles.entity,
      preferences.defaultStyles.container
    ]
  )

  // A default 2-point horizontal line. Points are
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
      carryPoints.endDrag()
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
    [rfInstance, setNodes, computeGroupSnap, carryPoints]
  )

  // Ctrl/Cmd held when a drag starts: the points of an edge with only one end in the drag follow
  // the end they are nearest to.
  const onNodeDragStart = useCallback(
    (event: { ctrlKey: boolean; metaKey: boolean }) => {
      carryPoints.beginDrag(event.ctrlKey || event.metaKey)
    },
    [carryPoints]
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
        // ADR 0012. getIntersectingNodes(_, false) matches a node that fully
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

  // One-click inverse of drag-out / "Attach contained entities" (ADR 0012):
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
    // A hidden element is never selected (ADR 0194).
    setNodes((nds) =>
      nds.map((n) => (n.selected || !isVisibleElement(setIdsOf(n)) ? n : { ...n, selected: true }))
    )
    setEdges((eds) =>
      eds.map((e) => (e.selected || !isVisibleElement(setIdsOf(e)) ? e : { ...e, selected: true }))
    )
  }, [setNodes, setEdges, isVisibleElement])

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)))
  }, [setNodes, setEdges])

  // No clipboard involved (deliberately simpler than real copy/paste),
  // just clones selected nodes in place with a small offset and
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

  // Multi-select resize: every selected node shows its own
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

  // Modifier+drag duplicate, called by useModifierDragDuplicate once the pointer has
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

  // Real clipboard copy/paste. Copy is a pure read (no
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
    // its children — see remapForPaste (ADR 0012). Captured out of the
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
    // A cross-diagram paste can introduce a resource path (icon/notes/
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

  // Layer panel drag-reorder — a discrete action, not
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

  // Connection point count field — a discrete,
  // structural action rather than a style patch: it can both reposition
  // and delete/create points on the target node, and reassign edges off
  // any point it removes. `totalCount` is the side's whole point count,
  // same number the property panel shows and edits directly — no
  // default/custom split to convert between (that split was removed).
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

  // Locked: blocks drag/resize/rotate and accidental delete via the
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
      diagramFontFamily,
      visibilitySets,
      stories,
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
      iconPackNotes,
      reloadHubRef,
      hubBaselineRef,
      clearOutsideChanges
    }
  )

  const {
    exportDialogFormat,
    setExportDialogFormat,
    exportPngEffectiveColorHex,
    isExportingPng,
    handleExportPng,
    handleExportSvg,
    handleExportDrawio
  } = useImageExport(canvasApi, {
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    diagramFontFamily,
    visibilitySets,
    hiddenSetIds,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    enabledHighlightIds,
    showCrossings,
    theme,
    preferences,
    flowWrapperRef,
    updateNodeInternals
  })

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
        fontFamily: openedFontFamily,
        edgeDirectionSets: openedEdgeDirectionSets,
        activeEdgeDirectionSetId: openedActiveEdgeDirectionSetId,
        security: openedSecurity,
        visibilitySets: openedVisibilitySets,
        stories: openedStories,
        hierarchyNotes: openedHierarchyNotes
      } = fromDiagramFile(diagram)
      // Anything the load repaired by itself (a dangling container reference, a missing zIndex, a
      // required tag reset, a stale security reference, ...) makes the file differ from what is on
      // disk, so it counts as a change to save (ADR 0040): compare what a save would write with
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
        openedSecurity,
        openedFontFamily,
        openedVisibilitySets,
        openedStories
      )
      // savedWith and iconPacks are written by the save itself, and a zIndex the file leaves out is a
      // default that never changes how the diagram looks (diagrams written by hand or by
      // an assistant usually omit it), so none of them counts.
      const filledZIndex = new Map(wouldSave.nodes.map((n) => [n.id, n.zIndex]))
      const asRead: DiagramFile = {
        ...diagram,
        savedWith: undefined,
        iconPacks: undefined,
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
      setDiagramFontFamily(openedFontFamily)
      setVisibilitySets(openedVisibilitySets)
      setStories(openedStories)
      setHiddenSetIds(new Set())
      setVisibilitySetsPanelOpen(false)
      setStoriesPanelOpen(false)
      resetStories()
      setEdgeDirectionSets(openedEdgeDirectionSets)
      setActiveEdgeDirectionSetId(openedActiveEdgeDirectionSetId)
      setSecurity(openedSecurity)
      setHierarchyLoadNotes(openedHierarchyNotes)
      // The version that last wrote this file (ADR 0118): kept so a save does not
      // lower it, and compared with this app's to warn about a newer file.
      loadedSavedWithRef.current = diagram.savedWith
      setIconPackNotes(diagram.iconPacks ?? [])
      void warnIfSavedWithNewer(path, diagram.savedWith)
      if (opts?.keepNoteShadows) {
        // A reload replaces the diagram only — notes are independent files with their
        // own state. Unsaved note edits are kept (clean copies are just a cache and are
        // re-read on demand). Edits for an element the reloaded diagram no longer has
        // can't be shown on it, so they are listed in Diagnostics instead of being dropped.
        const live = new Set(openedNodes.map((n) => n.id))
        const kept: Record<string, NoteShadow> = {}
        let orphaned = 0
        for (const [id, shadow] of Object.entries(noteShadowsRef.current)) {
          if (!shadow.dirty) continue
          kept[id] = shadow
          if (!live.has(id)) orphaned++
        }
        setNoteShadows(kept)
        if (orphaned > 0) {
          showAlert(
            `The reloaded diagram no longer contains ${orphaned} element(s) whose notes had unsaved edits. The edits are kept: see Diagnostics to copy or discard them.`
          )
        }
      } else {
        setNoteShadows({})
      }
      resetOutsideChanges()
      setContextMenu(null)
      setIconPicker(null)
      setColorPicker(null)
      setLinePicker(null)
      setNotesPanelNodeId(null)
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
      // Surface missing referenced files in Diagnostics.
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
      setVisibilitySets,
      setStories,
      setHiddenSetIds,
      setVisibilitySetsPanelOpen,
      setStoriesPanelOpen,
      resetStories,
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
      setNotesPanelNodeId,
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
      resetOutsideChanges
    ]
  )

  useWindowLifecycle(canvasApi, {
    isDirty,
    nodes,
    edges,
    diagramMetadata,
    requiredTags,
    highlights,
    legend,
    gravityPresets,
    diagramMaxConnectionPointsPerSide,
    diagramFontFamily,
    visibilitySets,
    stories,
    edgeDirectionSets,
    activeEdgeDirectionSetId,
    security,
    noteShadows,
    setNoteShadows,
    sessionIdRef,
    loadedSavedWithRef,
    loadDiagramIntoCanvas,
    performSaveNow
  })

  const { handleOpen, handleNew, handleOpenRecent, handleClearRecent, handleClose, handleReload } =
    useDocumentCommands({
      nodes,
      edges,
      currentPath,
      isDirty,
      hubDirty,
      loadDiagramIntoCanvas,
      reloadHubRef,
      updatePreferences
    })

  const { handleLinkClick } = useLinks({ nodes, currentPath, persistDiagram, openContextMenu })

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
      // Search overlay — provisional V1 entry point,
      // no permanent toolbar button yet (see the ADR). Not deferring to text
      // fields: same as Ctrl+S/O/N/W, opening/closing search is a reasonable
      // thing to do regardless of what else has focus.
      'search.toggle': toggleSearchOverlay,
      // Command palette.
      'view.commandPalette': () => setCommandPaletteOpen(true),
      // "Changes since last save".
      'view.changesSinceLastSave': toggleChangesPanel,
      'view.toggleEdgeAnimation': toggleEdgeAnimation,
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
      'view.present': presentStory,
      'selection.escape': () => {
        if (commandPaletteOpen) {
          // The palette also has its own window-level Escape listener
          // (CommandPalette.tsx) — same harmless redundancy as
          // shortcutsDialogOpen just below.
          setCommandPaletteOpen(false)
        } else if (shortcutsDialogOpen) {
          setShortcutsDialogOpen(false)
        } else if (glossaryDialogOpen) {
          setGlossaryDialogOpen(false)
        } else if (legendLinePick) {
          abortLegendLinePick()
        } else if (searchIconPicker) {
          // The search overlay's icon-browser popup — close just it, one
          // step before the overlay itself.
          setSearchIconPicker(null)
        } else if (notesPanelNodeId) {
          setNotesPanelNodeId(null)
        } else if (searchOverlayOpen) {
          closeSearchOverlay()
        } else if (diagnosticsPanelOpen) {
          setDiagnosticsPanelOpen(false)
        } else if (highlightsPanelOpen) {
          setHighlightsPanelOpen(false)
        } else if (visibilitySetsUi.panelOpen) {
          setVisibilitySetsPanelOpen(false)
        } else if (storiesPanelOpen) {
          setStoriesPanelOpen(false)
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
      // While presenting, the presenter's keys are the only shortcuts (ADR 0194).
      if (storiesPresenting) {
        if (handlePresenterKey(event)) event.preventDefault()
        return
      }
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
    notesPanelNodeId,
    searchOverlayOpen,
    toggleSearchOverlay,
    searchIconPicker,
    setSearchIconPicker,
    shortcutsDialogOpen,
    glossaryDialogOpen,
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
    setNotesPanelNodeId,
    setDiagnosticsPanelOpen,
    setDiagramSettingsPanelOpen,
    setPreferencesPanelOpen,
    setReferencesPanelOpen,
    setStylePalettePanelOpen,
    highlightsPanelOpen,
    setHighlightsPanelOpen,
    visibilitySetsUi.panelOpen,
    setVisibilitySetsPanelOpen,
    storiesPresenting,
    handlePresenterKey,
    presentStory,
    storiesPanelOpen,
    setStoriesPanelOpen,
    preferencesPanelOpen,
    stylePalettePanelOpen,
    alignDistributePanelOpen,
    diagramSettingsPanelOpen,
    referencesPanelOpen,
    changesPanelOpen,
    toggleChangesPanel,
    toggleEdgeAnimation,
    referenceWindows,
    setReferenceWindows,
    iconPicker,
    colorPicker,
    linePicker,
    contextMenu
  ])

  // Drives the diagram dock's mode (item palette vs. property panel) — see
  // Memoized on nodes/edges so unrelated CanvasInner
  // renders (panel toggles, colour-picker state, search) don't hand
  // DiagramDock a fresh array and re-render it + PropertyPanel every time.
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes])
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges])

  // Each node's persisted stacking order. No type-based special-casing here: the
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
  // whether nodes/edges changed.
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
  // Where every element is, as the attachment rules want it (autoAttach.ts, springPoints.ts).
  const placedNodes = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return nodes
      .filter((n) => n.type === 'entity' || n.type === 'container' || n.type === 'stencil')
      .map((n) => {
        const place = absolutePosition(n, byId)
        return {
          id: n.id,
          x: place.x,
          y: place.y,
          width: n.measured?.width ?? n.width ?? 0,
          height: n.measured?.height ?? n.height ?? 0,
          points: (n.data?.connectionPoints as ConnectionPoint[] | undefined) ?? []
        }
      })
  }, [nodes])
  // An edge end with no connection point named attaches by itself and follows the element as it
  // moves.
  const autoHandles = useMemo(
    () =>
      resolveAutoHandles(
        placedNodes,
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle
        }))
      ),
    [placedNodes, edges]
  )
  const attachedEdges = useMemo(
    () =>
      autoHandles.size === 0
        ? edges
        : edges.map((e) => {
            const picked = autoHandles.get(e.id)
            return picked
              ? {
                  ...e,
                  sourceHandle: e.sourceHandle || picked.sourceHandle,
                  targetHandle: e.targetHandle || picked.targetHandle
                }
              : e
          }),
    [edges, autoHandles]
  )
  // Connection points slide a little to straighten the edges between them (springPoints.ts).
  const pointSlideMap = useMemo(() => {
    return pointSlides(
      placedNodes,
      attachedEdges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        bent: ((e.data?.points as unknown[] | undefined)?.length ?? 0) > 0
      }))
    )
  }, [placedNodes, attachedEdges])
  useEffect(() => publishPointSlides(pointSlideMap), [pointSlideMap])

  const orderedEdges = useMemo(() => {
    if (!attachedEdges.some((e) => e.selected)) return attachedEdges
    return [...attachedEdges.filter((e) => !e.selected), ...attachedEdges.filter((e) => e.selected)]
  }, [attachedEdges])

  // Every node and edge, each with its visibility decided: the ones the visibility sets hide are marked
  // `hidden` (ADR 0194). All of them are sent to React Flow, since a child needs its container in the
  // list; it does not draw the hidden ones. The state keeps them, in place, so an edge still follows
  // an element that is hidden.
  const nodesWithVisibility = useMemo(() => {
    const visible = withVisibility(nodes, isVisibleElement, storyFade)
    return storiesPresenting ? lockedForPresenting(visible) : visible
  }, [nodes, isVisibleElement, storyFade, storiesPresenting])
  const edgesWithVisibility = useMemo(() => {
    const visible = withVisibility(orderedEdges, isVisibleElement, storyFade)
    return storiesPresenting ? lockedForPresenting(visible) : visible
  }, [orderedEdges, isVisibleElement, storyFade, storiesPresenting])

  // React Flow drops an edge when the box round its two ends is off screen, however far the path
  // between them runs. While an edge with waypoints reaches into the window and its ends do not,
  // everything is drawn (edgeCulling.ts, docs/known-issues.md).
  const waypointEdges = useMemo(
    () =>
      edges
        .map((e) => ({
          source: e.source,
          target: e.target,
          points: (e.data?.points as LinePoint[] | undefined) ?? []
        }))
        .filter((e) => e.points.length > 0),
    [edges]
  )
  const waypointEdgeOffScreen = useStore(
    useCallback(
      (state: ReactFlowState): boolean => {
        if (waypointEdges.length === 0) return false
        const [tx, ty, zoom] = state.transform
        const view = {
          x: -tx / zoom,
          y: -ty / zoom,
          x2: (state.width - tx) / zoom,
          y2: (state.height - ty) / zoom
        }
        return waypointEdgeHidden(
          waypointEdges.map((e) => ({
            points: e.points,
            ends: [e.source, e.target].flatMap((id) => {
              const node = state.nodeLookup.get(id)
              if (!node) return []
              const { x, y } = node.internals.positionAbsolute
              return [
                {
                  x,
                  y,
                  x2: x + (node.measured.width ?? node.width ?? 0),
                  y2: y + (node.measured.height ?? node.height ?? 0)
                }
              ]
            })
          })),
          view
        )
      },
      [waypointEdges]
    )
  )

  // An edge has no zIndex of its own (only Entity/Container/Text have one): it sits at
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
  // highest zIndex first, matching the panel's top-is-frontmost convention.
  // Container-nesting analysis for the Layers panel and Diagnostics (ADR 0012):
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
  // panel — a live projection of node data, owns nothing.
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
    // Ids in elements that no set of the diagram holds (ADR 0194): ignored, never removed.
    const strayLines = strayAdvisory(
      visibilitySets,
      [...nodes, ...edges].map((el) => setIdsOf(el))
    )
    return [
      ...diagnostics,
      ...hierarchyLoadNotes,
      ...hierarchyAnalysis.outgrownAdvisories,
      ...legendEmptyAdvisory,
      ...strayLines,
      // Set ids in stories that no set holds (ADR 0194): ignored, never removed.
      ...storyStrayAdvisory(stories, visibilitySets),
      // A portal number used twice, and a label hidden in a gap.
      ...portalNotices(
        edges.map((e) => ({
          id: e.id,
          label: typeof e.data?.label === 'string' ? e.data.label : undefined,
          style: e.data?.style as EdgeStyle | undefined
        }))
      )
    ]
  }, [
    diagnostics,
    hierarchyLoadNotes,
    hierarchyAnalysis,
    legend.length,
    nodes,
    edges,
    visibilitySets,
    stories
  ])

  // "Changes since last save" Notes bucket — reuses
  // noteShadows' existing dirty flag (ADR 0040) directly, no new tracking.
  const notesChangedEntries: NotesChangedEntry[] = useMemo(
    () =>
      Object.values(noteShadows)
        .filter((s) => s.dirty)
        .map((s) => ({
          nodeId: s.nodeId,
          label: String(nodes.find((n) => n.id === s.nodeId)?.data?.label ?? '') || '(unlabeled)'
        })),
    [noteShadows, nodes]
  )
  // The architecture check (ADR 0131): the metamodel chosen in Diagnostics, run on the diagram as a
  // save would write it. Only while the panel is open, so it costs nothing otherwise.
  const conformance = useConformance(diagnosticsPanelOpen)
  // The diagram as a save would write it, for the checks of the panel; only while it is open.
  const checkedDiagram = useMemo(
    () =>
      diagnosticsPanelOpen
        ? toDiagramFile(
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
            diagramFontFamily,
            visibilitySets,
            stories
          )
        : null,
    [
      diagnosticsPanelOpen,
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
      diagramFontFamily,
      visibilitySets,
      stories
    ]
  )
  const conformanceResult = useMemo(
    () =>
      checkedDiagram && conformance.metamodel
        ? checkDiagram(checkedDiagram, conformance.metamodel)
        : null,
    [checkedDiagram, conformance.metamodel]
  )
  // Edge labels hidden behind the elements they join, measured in the font the canvas
  // draws them in: the diagram's, else the personal default.
  const layoutEntries = useMemo<LayoutEntry[]>(() => {
    if (!checkedDiagram) return []
    const names = new Map(checkedDiagram.nodes.map((n) => [n.id, n.data.label || n.id]))
    return hiddenLabels(checkedDiagram.nodes, checkedDiagram.edges, effectiveFontFamily).map(
      (hidden) => ({
        ...hidden,
        sourceName: names.get(hidden.sourceId) ?? hidden.sourceId,
        targetName: names.get(hidden.targetId) ?? hidden.targetId
      })
    )
  }, [checkedDiagram, effectiveFontFamily])
  // Unsaved note edits whose element is gone (ADR 0040): kept, listed in Diagnostics.
  const orphanedEdits = useMemo(
    () => orphanedNoteEdits(noteShadows, new Set(nodes.map((n) => n.id))),
    [noteShadows, nodes]
  )
  // Installed icons this machine cannot draw: a pack that is not installed, an icon not in one.
  const iconPackProblems = useIconPackProblems(nodes, legend, iconPackNotes)
  // Count on the View-menu "Diagnostics (N)" label — undecided missing
  // files + staged removals (a nudge to save) + orphaned note edits + icon pack problems, never
  // dismissed ones.
  const diagnosticsCount =
    displayedDiagnostics.length +
    visibleMissingFiles.length +
    stagedFileRemovals.length +
    orphanedEdits.length +
    iconPackProblems.missingPacks.length +
    iconPackProblems.missingIcons.length

  // Mode-aware menu bar: what the Security Matrix persona hides is decided in
  // buildMenus.
  const isDiagramPersona = persona === 'diagram'
  // The legend row the active edge direction set contributes —
  // shown in the Legend panel and prepended to the PNG export legend
  // whenever any direction set exists. `null` when the feature is dormant.
  const directionSetRow = directionSetLegendRow(edgeDirectionSets, activeEdgeDirectionSetId)

  const { menus, paletteActions } = useMenus({
    preferences,
    currentPath,
    isDiagramPersona,
    nodes,
    selectedNodes,
    selectedEdges,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    diagnosticsCount,
    referenceCount: referenceRows.length,
    fitView: () => rfInstance.fitView(),
    handleNew,
    handleOpen,
    handleOpenRecent,
    handleClearRecent,
    handleSave,
    handleSaveAs,
    handleReload,
    handleClose,
    setExportDialogFormat,
    onExportDrawio: handleExportDrawio,
    undo,
    redo,
    cutSelection,
    copySelection,
    pasteFromClipboard,
    duplicateSelected,
    selectAll,
    reverseEdges,
    toggleStyleBrush,
    pasteStyleToSelection,
    toggleSearchOverlay,
    toggleAlignDistributePanel,
    toggleDiagnosticsPanel,
    toggleChangesPanel,
    reviewDiskChanges,
    openRevisionDialog: () => setRevisionDialogOpen(true),
    toggleLayerPanel,
    toggleReferencesPanel,
    toggleStoriesPanel,
    presentStory,
    hasStoryToPresent: (storiesUi.story?.steps.length ?? 0) > 0,
    toggleStylePalettePanel,
    toggleEdgeAnimation,
    edgeAnimationOn,
    toggleMinimap,
    minimapOn,
    toggleCrossings,
    crossingsOn: showCrossings,
    toggleZoomControls,
    zoomControlsOn,
    toggleDiagramSettingsPanel,
    togglePreferencesPanel,
    showPreferencesPanel,
    setCommandPaletteOpen,
    setShortcutsDialogOpen,
    setGlossaryDialogOpen,
    setAboutDialogOpen
  })

  // Whichever named palette is active, resolved live —
  // memoized on the two fields it depends on so the Context value below
  // keeps a stable identity between unrelated settings changes.
  const activeStylePalette = useMemo(
    () => effectiveStylePalette(preferences.stylePalettes, preferences.activeStylePaletteId),
    [preferences.stylePalettes, preferences.activeStylePaletteId]
  )

  // useCallback (not an inline arrow on <DiagramDock>) so memo(DiagramDock)
  // can actually bail on unrelated CanvasInner renders.
  const setDefaultStyle = useCallback(
    (type: 'entity' | 'container' | 'text', style: NodeStyle) =>
      updatePreferences({ defaultStyles: { ...preferences.defaultStyles, [type]: style } }),
    [updatePreferences, preferences.defaultStyles]
  )

  // Memoized so a high-frequency state change elsewhere in CanvasInner (e.g. dragging a native
  // colour-input handle, dozens of onChange events per second) doesn't re-render every node and
  // edge just because this object got a new identity: consumers subscribe via useContext, which
  // bypasses their React.memo wrapper (that only guards parent prop changes). Every
  // function here is useCallback-stable, and effectiveGravityPresets() returns its input reference
  // when non-empty, so this recomputes only when a value really changed.
  const diagramContextValue: DiagramContextValue = useMemo(
    () => ({
      diagramPath: currentPath,
      openContextMenu,
      openIconPicker,
      openColorPicker,
      openNotesPanel,
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
      diagramFontFamily: effectiveFontFamily,
      gravityPresets: effectiveGravityPresets(
        gravityPresets,
        preferences.gravityPresetsUserDefault
      ),
      searchMatchIds,
      isolateActive,
      isolateOpacity: preferences.isolateOpacity,
      showCrossings,
      portalMark: preferences.portalMark,
      portalNumbers: portalNumberMap,
      edgeLengths,
      selectAllOfType,
      pendingLabelEditId,
      clearPendingLabelEdit
    }),
    [
      currentPath,
      openContextMenu,
      openIconPicker,
      openColorPicker,
      openNotesPanel,
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
      effectiveFontFamily,
      gravityPresets,
      preferences.gravityPresetsUserDefault,
      searchMatchIds,
      isolateActive,
      preferences.isolateOpacity,
      showCrossings,
      preferences.portalMark,
      portalNumberMap,
      edgeLengths,
      selectAllOfType,
      pendingLabelEditId,
      clearPendingLabelEdit
    ]
  )

  return (
    <DiagramContext.Provider value={diagramContextValue}>
      {/* Outer app shell: [canvas view [diagram dock]] [utility dock], nested
          not flat. */}
      <IconPackOffer />
      <div
        className={`app-shell${storiesPresenting ? ' is-presenting' : ''}${
          storiesPresenting && !presenterAwake ? ' is-idle' : ''
        }`}
      >
        <div className={`canvas-view${edgeAnimationOn ? '' : ' edges-still'}`}>
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
            {/* Stories (ADR 0194): opens the panel where a story is written and presented. */}
            {isDiagramPersona && (
              <button
                type="button"
                className="toolbar-stories"
                title="Stories: tell the diagram one step at a time"
                aria-label="Stories"
                aria-pressed={storiesPanelOpen}
                onClick={toggleStoriesPanel}
              >
                ▶ Stories
              </button>
            )}
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
            <OutsideChangeNotice
              files={outsideChanges.files}
              onReview={() => void reviewDiskChanges()}
              onReload={() => void outsideChanges.reload()}
              onIgnore={outsideChanges.ignore}
            />
            {/* Default-edge-style swatch — diagram-only; nothing in the
                Security Matrix persona draws edges. */}
            {isDiagramPersona && (
              <button
                type="button"
                className="toolbar-edge-style-swatch"
                title={
                  newEdgeLine
                    ? `New edges are drawn as "${newEdgeLine.label}" (this diagram's legend)`
                    : 'Default style for newly drawn edges'
                }
                aria-label="Default style for newly drawn edges"
                onClick={(event) =>
                  setDefaultEdgeStylePicker(event.currentTarget.getBoundingClientRect())
                }
              >
                <EdgeLinePreview look={defaultEdgeLook} width={34} height={20} />
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
                // Read by canvas.css for everything drawn in the diagram; a CSS variable
                // so a font change re-renders no node. undefined leaves the built-in font.
                style={{ '--diagram-font-family': effectiveFontFamily } as React.CSSProperties}
                onDragOver={onCanvasDragOver}
                onDrop={onCanvasDrop}
              >
                <EdgeMarkerDefs />
                {edgePeek && showCrossings && (
                  <CrossingPeekOf peek={edgePeek} rfInstance={rfInstance} />
                )}
                {peek && peekNode && (
                  <PeekCard
                    key={peek.nodeId}
                    target={peek}
                    width={preferences.peekCardWidth}
                    maxHeight={preferences.peekCardMaxHeight}
                    label={typeof peekNode.data?.label === 'string' ? peekNode.data.label : ''}
                    notesPath={
                      typeof peekNode.data?.notes === 'string' ? peekNode.data.notes : undefined
                    }
                    linkedPath={
                      typeof peekNode.data?.linkedDiagram === 'string'
                        ? peekNode.data.linkedDiagram
                        : undefined
                    }
                    metadata={peekNode.data?.metadata as Record<string, MetadataEntry> | undefined}
                    requiredTagKeys={new Set(requiredTags.map((tag) => tag.key))}
                    icons={peekNode.data?.icons as Partial<Record<IconSlot, IconRef>> | undefined}
                    diagramPath={currentPath}
                    shadowContent={noteShadows[peek.nodeId]?.content}
                  />
                )}
                <ReactFlow
                  nodes={nodesWithVisibility}
                  edges={edgesWithVisibility}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  proOptions={HIDE_ATTRIBUTION}
                  // Only mount nodes/edges intersecting the viewport — see
                  // Nodes carry width/height (fromDiagramFile) so
                  // their bounds are known before measurement. Disabled
                  // during PNG export so the capture sees the whole diagram, and while a
                  // waypoint edge would be dropped though part of it is in view.
                  onlyRenderVisibleElements={!isExportingPng && !waypointEdgeOffScreen}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onBeforeDelete={onBeforeDelete}
                  onNodeDragStart={onNodeDragStart}
                  onNodeDrag={onNodeDrag}
                  onNodeDragStop={onNodeDragStop}
                  onNodeClick={onStyleBrushNodeClick}
                  onEdgeClick={onEdgeClick}
                  onNodeDoubleClick={onLabelDoubleClick}
                  onEdgeDoubleClick={onLabelDoubleClick}
                  onEdgeMouseEnter={edgePeekBindings.onNodeMouseEnter}
                  onEdgeMouseLeave={edgePeekBindings.onNodeMouseLeave}
                  onNodeMouseEnter={peekBindings.onNodeMouseEnter}
                  onNodeMouseLeave={peekBindings.onNodeMouseLeave}
                  onConnect={onConnect}
                  onConnectStart={onConnectStart}
                  onConnectEnd={onConnectEnd}
                  onReconnect={onReconnect}
                  onReconnectStart={onReconnectStart}
                  onReconnectEnd={onReconnectEnd}
                  edgesReconnectable={!storiesPresenting}
                  // The presenter only shows (ADR 0194): nothing is picked up, drawn, deleted or selected.
                  nodesDraggable={!storiesPresenting}
                  nodesConnectable={!storiesPresenting}
                  elementsSelectable={!storiesPresenting}
                  nodesFocusable={!storiesPresenting}
                  edgesFocusable={!storiesPresenting}
                  // A little smaller than React Flow's own default (10) — and
                  // kept equal to main.css's `.react-flow__edgeupdater` `r`
                  // value, so the visible dot on a selected edge
                  // matches the actual grabbable area exactly rather than
                  // over- or under-promising it.
                  reconnectRadius={8}
                  connectionRadius={connectionRadius}
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
                  deleteKeyCode={storiesPresenting ? null : ['Delete', 'Backspace']}
                  multiSelectionKeyCode="Shift" // frees Ctrl/Cmd+click for linked-diagram navigation
                  colorMode={theme}
                  // Overrides React Flow's light/dark default background. Plain
                  // `backgroundColor` does nothing visible: the paint comes from <Background>'s
                  // absolutely positioned SVG (.react-flow__background), which reads the CSS custom
                  // property --xy-background-color on whichever ancestor defines it
                  // (node_modules/@xyflow/react/dist/style.css). `undefined` is a no-op (React
                  // drops it from the style object), so the theme default applies when none is set.
                  style={
                    {
                      // Theme-adaptive like every other
                      // explicit color in this app — a background picked
                      // while looking at one theme shouldn't stay bit-for-
                      // bit identical (and potentially illegible) after
                      // switching to the other.
                      '--xy-background-color': themeAdaptiveColor(
                        preferences.canvasBackgroundColor,
                        theme
                      ),
                      // Read directly by LabeledEdge's stroke when selected, kept off
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
                  {/* The corner panel: the canvas's own buttons, then what it can show on demand:
                      the highlights, the crossings and, last, the legend. The zoom buttons are off
                      unless asked for in View -> Display, and React Flow's own lock is hidden: it
                      only stops what React Flow itself does. */}
                  <Controls showZoom={zoomControlsOn} showInteractive={false}>
                    <ControlButton
                      title={`Visibility sets${visibilitySets.length > 0 ? ` (${visibilitySets.length})` : ''}${hiddenSetIds.size > 0 ? ', some hidden' : ''}`}
                      aria-label="Show visibility sets"
                      aria-pressed={hiddenSetIds.size > 0}
                      onClick={(event) =>
                        visibilitySetsUi.togglePanel(event.currentTarget.getBoundingClientRect())
                      }
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          d="M2 12 C5 6.5 8.5 4.5 12 4.5 C15.5 4.5 19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 C8.5 19.5 5 17.5 2 12 Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
                        {hiddenSetIds.size > 0 && (
                          <line
                            x1="4"
                            y1="20"
                            x2="20"
                            y2="4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        )}
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
                    <ControlButton
                      title={showCrossings ? 'Stop marking crossings' : 'Mark crossings'}
                      aria-label="Mark crossings"
                      aria-pressed={showCrossings}
                      onClick={toggleCrossings}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <line
                          x1="2"
                          y1="12"
                          x2="22"
                          y2="12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        <path
                          d="M12 3 V21 M8.5 17.5 L12 21 L15.5 17.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <line
                          x1="7"
                          y1="12"
                          x2="17"
                          y2="12"
                          stroke="currentColor"
                          strokeWidth="3.5"
                        />
                      </svg>
                    </ControlButton>
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
                  </Controls>
                  {minimapOn && (
                    <MiniMap style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }} />
                  )}
                  <Panel position="bottom-right" className="minimap-toggle-panel">
                    <button
                      type="button"
                      className="minimap-toggle"
                      style={
                        minimapOn
                          ? { transform: `translate(-4px, ${-(MINIMAP_HEIGHT - 26)}px)` }
                          : undefined
                      }
                      title={minimapOn ? 'Hide the minimap' : 'Show the minimap'}
                      aria-label={minimapOn ? 'Hide the minimap' : 'Show the minimap'}
                      aria-pressed={minimapOn}
                      onClick={toggleMinimap}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path
                          d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Zm0 0v13m6-10v13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </Panel>
                </ReactFlow>
                <AlignmentGuides guides={alignmentGuides} />
              </div>
              <DiagramDock
                features={preferences.features}
                selectedNodes={selectedNodes}
                selectedEdges={selectedEdges}
                onAddEntity={addEntityNode}
                onAddText={addTextNode}
                onAddContainer={addContainerNode}
                onAddLine={addLineNode}
                onAddStencil={addStencilNode}
                onSetStencilKind={setStencilKind}
                onSetStencilLabelPosition={setStencilLabelPosition}
                onSetStencilState={setStencilState}
                onSetContainerLabelSide={setContainerLabelSide}
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
                // The routing type is not part of a preset, so it stays.
                updatePreferences({
                  defaultEdgeStyle: withRoutingOf(patch, preferences.defaultEdgeStyle)
                })
                // A preset is the look of new edges from now on, so the diagram's marked line stops
                // being it.
                if (newEdgeLine) {
                  setLegend((prev) => withNewEdgeLine(prev, null))
                  markDirty()
                }
                setDefaultEdgeStylePicker(null)
              }}
              lines={legend.filter((entry) => entry.kind === 'line')}
              currentLineId={newEdgeLine?.id}
              onPickLine={(id) => {
                setLegend((prev) => withNewEdgeLine(prev, id === newEdgeLine?.id ? null : id))
                markDirty()
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
              stencilRows={stencilRows}
              showStencilKinds={showStencilLegend}
              onToggleStencilKinds={() => setShowStencilLegend((v) => !v)}
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
              onRemoveGroup={removeHighlightGroup}
              onToggle={toggleHighlightEnabled}
              onToggleGroup={toggleHighlightGroup}
              onAddOrResyncGroup={addOrResyncHighlightGroup}
              onClose={() => setHighlightsPanelOpen(false)}
            />
          )}
          {visibilitySetsUi.panelOpen && (
            <VisibilitySetsPanel
              sets={visibilitySets}
              hiddenIds={hiddenSetIds}
              members={visibilitySetsUi.members}
              selectionCount={visibilitySetsUi.selectionCount}
              anchorRect={visibilitySetsUi.panelAnchor}
              onAdd={visibilitySetsUi.addSet}
              onRename={visibilitySetsUi.renameSet}
              onDelete={visibilitySetsUi.deleteSet}
              onToggle={visibilitySetsUi.toggleShown}
              onAddSelection={visibilitySetsUi.addSelectionTo}
              onRemoveSelection={visibilitySetsUi.removeSelectionFrom}
              onRemoveMember={visibilitySetsUi.removeMemberFrom}
              onSelectMember={visibilitySetsUi.selectMember}
              onClose={() => setVisibilitySetsPanelOpen(false)}
            />
          )}
          {storiesPresenting && storiesUi.story && (
            <PresenterBar
              name={storiesUi.story.name}
              step={storiesUi.presentStep}
              steps={storiesUi.story.steps.length}
              awake={presenterAwake}
              onPrevious={storiesUi.previous}
              onNext={storiesUi.next}
              onLeave={storiesUi.leave}
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
        <UtilityDock
          width={preferences.utilityDockWidth}
          onWidthChange={(utilityDockWidth) => updatePreferences({ utilityDockWidth })}
        >
          {notesPanelNodeId && (
            <NotesPanel
              title={notesPanelTitle(nodes.find((n) => n.id === notesPanelNodeId))}
              content={noteShadows[notesPanelNodeId]?.content ?? ''}
              saveState={noteSaveState(noteShadows[notesPanelNodeId])}
              onChange={(content) => {
                // The one edit site: the note's own dirty flag, not the diagram's.
                setNoteShadows((prev) => ({
                  ...prev,
                  [notesPanelNodeId]: editNote(
                    prev[notesPanelNodeId] ?? newNoteShadow(notesPanelNodeId),
                    content
                  )
                }))
              }}
              // usePanels drops the clean copy once the panel is closed.
              onClose={() => setNotesPanelNodeId(null)}
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
              conformance={conformance}
              conformanceResult={conformanceResult}
              layoutEntries={layoutEntries}
              onRevealEdge={revealEdge}
              iconPackProblems={iconPackProblems}
              onOpenIconPacks={() => void window.api.openIconPackManager()}
              orphanedEdits={orphanedEdits}
              onCopyOrphanedEdit={(edit) => window.api.copyToClipboard(edit.content)}
              onDiscardOrphanedEdit={(edit) =>
                setNoteShadows((prev) => {
                  const next = { ...prev }
                  delete next[edit.nodeId]
                  return next
                })
              }
              onClose={() => setDiagnosticsPanelOpen(false)}
            />
          )}
          {changesPanelOpen && (
            <ChangesPanel
              diff={changesDiff}
              notesChanged={notesChangedEntries}
              neverSaved={currentPath === null}
              onRefresh={() => void computeChangesDiff()}
              onReveal={focusSearchMatch}
              onReset={(element) => void resetChangedElement(element)}
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
          {storiesPanelOpen && (
            <StoriesPanel
              stories={stories}
              story={storiesUi.story}
              sets={visibilitySets}
              unassigned={unassignedCount}
              step={storiesUi.step}
              onAddStory={storiesUi.addStory}
              onRenameStory={storiesUi.renameStory}
              onSelectStory={storiesUi.selectStory}
              onDeleteStory={storiesUi.deleteStory}
              onSelectStep={storiesUi.selectStep}
              onAddStep={storiesUi.addStep}
              onDuplicateStep={storiesUi.duplicateStep}
              onDeleteStep={storiesUi.deleteStep}
              onMoveStep={storiesUi.moveStep}
              onAddAction={storiesUi.addAction}
              onChangeAction={storiesUi.changeAction}
              onRemoveAction={storiesUi.removeAction}
              onMoveAction={storiesUi.moveAction}
              onFromSets={storiesUi.fromSets}
              onPresent={presentStory}
              onClose={() => setStoriesPanelOpen(false)}
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
              fontFamily={diagramFontFamily}
              preferencesFontFamily={preferences.defaultFontFamily}
              onChangeFontFamily={updateDiagramFontFamily}
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
        {glossaryDialogOpen && <GlossaryDialog onClose={() => setGlossaryDialogOpen(false)} />}
        {commandPaletteOpen && (
          <CommandPalette actions={paletteActions} onClose={() => setCommandPaletteOpen(false)} />
        )}
        {revisionDialogOpen && (
          <RevisionDialog
            hasUnsavedChanges={isDirty}
            onClose={() => setRevisionDialogOpen(false)}
            onCompare={(revision) => {
              setRevisionDialogOpen(false)
              void compareWithGit(revision)
            }}
          />
        )}
        <AlertDialog />
        <ConflictDialog />
        <SaveAsDialog />
        {bulkCreateType && (
          <BulkCreateDialog
            typeLabel={bulkCreateType}
            requiredTags={requiredTags}
            onClose={() => setBulkCreateType(null)}
            onConfirm={(elements) => {
              addMultipleNodes(bulkCreateType, elements)
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
