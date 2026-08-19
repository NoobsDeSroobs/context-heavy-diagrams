import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  createEmptyDiagram,
  type ConnectionPoint,
  type DiagramFile,
  type IconRef,
  type IconSlot
} from '@shared/diagram'
import ShapeNode, { SHAPE_MIN_WIDTH, SHAPE_MIN_HEIGHT } from './nodes/ShapeNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from './nodes/TextNode'
import ContainerNode, { CONTAINER_MIN_WIDTH, CONTAINER_MIN_HEIGHT } from './nodes/ContainerNode'
import LabeledEdge from './edges/LabeledEdge'
import DiagramContext from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu'
import IconPicker from './components/IconPicker'
import DetailsPanel from './components/DetailsPanel'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts.
const nodeTypes = { shape: ShapeNode, text: TextNode, container: ContainerNode }
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

// No Node `path` module in the renderer (see docs/architecture/overview.md's
// process model) — breadcrumb labels just need the file name, not a real
// path-parsing library.
function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
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

function toDiagramFile(nodes: Node[], edges: Edge[], viewport: Viewport): DiagramFile {
  return {
    version: 1,
    viewport,
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
      label: typeof e.data?.label === 'string' && e.data.label ? e.data.label : undefined
    }))
  }
}

function fromDiagramFile(diagram: DiagramFile): { nodes: Node[]; edges: Edge[] } {
  return {
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
          ...(n.data.linkedDiagram ? { linkedDiagram: n.data.linkedDiagram } : {})
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
      data: { label: e.label ?? '' }
    }))
  }
}

function CanvasInner(): React.JSX.Element {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)
  const [iconPicker, setIconPicker] = useState<{ nodeId: string; anchorRect: DOMRect } | null>(
    null
  )
  const [detailsPanelNodeId, setDetailsPanelNodeId] = useState<string | null>(null)
  // Editing a node's details doesn't write to disk immediately — it's just
  // draft state here, flushed as part of the main save flow. See epic 0008.
  const [detailsDrafts, setDetailsDrafts] = useState<Record<string, string>>({})
  // Trail of diagrams navigated away from via a linked-diagram Ctrl/Cmd+click
  // — see epic 0009. Forward navigation persists the diagram being left
  // first (see persistDiagram/navigateExistingLink), so that's never lost —
  // but breadcrumb *back*-navigation re-opens fresh from disk, same as
  // "Open" does, so any edits made after arriving somewhere via a breadcrumb
  // and before clicking back out are not preserved (this app has no
  // dirty-tracking/autosave yet at all — epic 0020).
  const [breadcrumbs, setBreadcrumbs] = useState<{ path: string; label: string }[]>([])
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
      const containerRemovalIds = changes
        .filter((c) => c.type === 'remove')
        .map((c) => c.id)
        .filter((removedId) => nodes.find((n) => n.id === removedId)?.type === 'container')
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

  const openDetailsPanel = useCallback((nodeId: string) => {
    setDetailsPanelNodeId(nodeId)
  }, [])

  const iconPickerNode = iconPicker ? nodes.find((n) => n.id === iconPicker.nodeId) : undefined
  const iconPickerIcons = (iconPickerNode?.data?.icons ?? {}) as Partial<
    Record<IconSlot, IconRef>
  >

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
      setEdges((eds) => addEdge({ ...connection, type: 'labeled' }, eds))
    },
    [setEdges, pushSnapshot]
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
      { id, type: 'shape', position: spawnPosition(width, height, nds.length), width, height, data: { label: 'Shape' } }
    ])
  }, [setNodes, pushSnapshot, spawnPosition])

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
        data: { label: 'Container' }
      }
    ])
  }, [setNodes, pushSnapshot, spawnPosition])

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
  const onNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node, draggedNodes: Node[]) => {
      const nodesToProcess = draggedNodes.length > 0 ? draggedNodes : [draggedNode]

      setNodes((nds) => {
        const byId = new Map(nds.map((n) => [n.id, n]))
        nodesToProcess.forEach((n) => byId.set(n.id, n))

        const isDescendantOf = (candidateId: string, ofId: string): boolean => {
          let current = byId.get(candidateId)
          while (current?.parentId) {
            if (current.parentId === ofId) return true
            current = byId.get(current.parentId)
          }
          return false
        }

        let result = nds
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
    [rfInstance, setNodes]
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
      const diagram = toDiagramFile(savedNodes, edges, rfInstance.getViewport())
      await window.api.saveDiagram(path, diagram)
      setNodes(savedNodes)
      return savedNodes
    },
    [edges, rfInstance, flushDetailsDrafts, setNodes]
  )

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
      } catch (error) {
        alert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, nodes, persistDiagram]
  )

  const handleSave = useCallback(() => performSave(false), [performSave])
  const handleSaveAs = useCallback(() => performSave(true), [performSave])

  // Shared by "Open", forward link-navigation, and breadcrumb back-nav — the
  // one place that applies a loaded DiagramFile to all canvas state. Also
  // closes any panel/menu left open from the diagram just navigated away
  // from (handleOpen alone never needed this — a rare deliberate action —
  // but link-navigation is frequent enough that a stale panel referencing a
  // node id from the previous diagram becomes a real, visible bug).
  const loadDiagramIntoCanvas = useCallback(
    (path: string | null, diagram: DiagramFile) => {
      const { nodes: openedNodes, edges: openedEdges } = fromDiagramFile(diagram)
      // A different diagram entirely — old undo history doesn't apply to
      // it (and, worse, undoing across a load boundary would try to
      // restore a previous diagram's nodes into the wrong file context).
      setPast([])
      setFuture([])
      setNodes(openedNodes)
      setEdges(openedEdges)
      rfInstance.setViewport(diagram.viewport)
      setCurrentPath(path)
      setDetailsDrafts({})
      setContextMenu(null)
      setIconPicker(null)
      setDetailsPanelNodeId(null)
    },
    [rfInstance, setNodes, setEdges]
  )

  const handleOpen = useCallback(async () => {
    let result: Awaited<ReturnType<typeof window.api.openDiagram>>
    try {
      result = await window.api.openDiagram()
    } catch (error) {
      alert(`Open failed: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (!result) return
    setBreadcrumbs([])
    loadDiagramIntoCanvas(result.path, result.diagram)
  }, [loadDiagramIntoCanvas])

  // In-memory only — see epic 0018. No file is written, nothing is linked
  // from anywhere, and (like Open/link-navigation) any unsaved edits in the
  // current diagram are silently discarded — no dirty-tracking exists yet
  // (epic 0020). Replaces the current diagram in place, single-window
  // model; once tabs/windows exist (epic 0024) this should open a new tab
  // instead and leave the current one alone.
  const handleNew = useCallback(() => {
    setBreadcrumbs([])
    loadDiagramIntoCanvas(null, createEmptyDiagram())
  }, [loadDiagramIntoCanvas])

  // Pure navigation: resolves a stored relative path and, on success, pushes
  // the diagram being left onto the breadcrumb trail and loads the target.
  // Never mutates current state on failure — a missing or unreadable link
  // must leave the diagram containing it fully intact (ADR 0005). Does NOT
  // save anything itself — callers persist first if the parent needs it.
  const resolveAndLoad = useCallback(
    async (parentPath: string, relativePath: string) => {
      try {
        const result = await window.api.resolveLinkedDiagram(parentPath, relativePath)
        if (!result.found) {
          alert(`Linked diagram not found at ${result.resolvedPath}`)
          return
        }
        setBreadcrumbs((prev) => [...prev, { path: parentPath, label: basename(parentPath) }])
        loadDiagramIntoCanvas(result.path, result.diagram)
      } catch (error) {
        alert(
          `Linked diagram at ${relativePath} couldn't be read: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [loadDiagramIntoCanvas]
  )

  // Ctrl/Cmd+click on an already-linked node: persist the parent first —
  // forward link navigation is a natural save point, and skipping this was
  // exactly the bug where a just-created link never survived navigating
  // away from the diagram that holds it (nothing else was ever going to
  // write it to disk once in-memory state gets replaced by the target).
  const navigateExistingLink = useCallback(
    async (parentPath: string, relativePath: string) => {
      await persistDiagram(parentPath, nodes)
      await resolveAndLoad(parentPath, relativePath)
    },
    [nodes, persistDiagram, resolveAndLoad]
  )

  // Creating a new linked diagram: link the node (computed directly, not via
  // updateNodeData + re-reading state later — that update wouldn't have been
  // visible to a synchronous save call in the same tick) and persist, then
  // navigate straight in — the point of "create new" is to start working in
  // it immediately.
  const createAndLink = useCallback(
    async (nodeId: string, parentPath: string, label: string) => {
      try {
        const relativePath = await window.api.createLinkedDiagram(parentPath, label)
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, linkedDiagram: relativePath } } : n
        )
        await persistDiagram(parentPath, updatedNodes)
        await resolveAndLoad(parentPath, relativePath)
      } catch (error) {
        alert(
          `Couldn't create linked diagram: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
    [nodes, persistDiagram, resolveAndLoad]
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
  // linked node navigates straight in.
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

  const navigateToBreadcrumb = useCallback(
    async (index: number) => {
      const target = breadcrumbs[index]
      try {
        const diagram = await window.api.openDiagramAtPath(target.path)
        setBreadcrumbs((prev) => prev.slice(0, index))
        loadDiagramIntoCanvas(target.path, diagram)
      } catch (error) {
        alert(`Couldn't open ${target.path}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [breadcrumbs, loadDiagramIntoCanvas]
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
      if (event.altKey && event.key === 'ArrowLeft') {
        if (breadcrumbs.length > 0) navigateToBreadcrumb(breadcrumbs.length - 1)
        return
      }
      if (event.key === 'Escape') {
        if (detailsPanelNodeId) {
          setDetailsPanelNodeId(null)
        } else if (iconPicker) {
          setIconPicker(null)
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
    breadcrumbs,
    navigateToBreadcrumb,
    detailsPanelNodeId,
    iconPicker,
    contextMenu
  ])

  return (
    <DiagramContext.Provider
      value={{
        diagramPath: currentPath,
        openContextMenu,
        openIconPicker,
        openDetailsPanel,
        handleLinkClick,
        beginContinuousEdit,
        endContinuousEdit,
        pushSnapshot,
        attachContainedNodes
      }}
    >
      <div style={{ width: '100vw', height: '100vh' }}>
        <div className="toolbar">
          <button onClick={addShapeNode}>Add shape</button>
          <button onClick={addTextNode}>Add text</button>
          <button onClick={addContainerNode}>Add container</button>
          <button onClick={handleNew}>New</button>
          <button onClick={handleOpen}>Open…</button>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleSaveAs}>Save As…</button>
          <button onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">
            Redo
          </button>
          {breadcrumbs.length > 0 && (
            <nav className="breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <button key={crumb.path} onClick={() => navigateToBreadcrumb(index)}>
                  {crumb.label}
                </button>
              ))}
            </nav>
          )}
          {currentPath && <span className="toolbar-path">{currentPath}</span>}
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{ type: 'labeled', markerEnd: { type: MarkerType.ArrowClosed } }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode="Shift" // frees Ctrl/Cmd+click for linked-diagram navigation — epic 0009
          colorMode="dark" // hardcoded until epic 0005 adds a real light/dark toggle
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
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
        {detailsPanelNodeId && (
          <DetailsPanel
            content={detailsDrafts[detailsPanelNodeId] ?? ''}
            onChange={(content) =>
              setDetailsDrafts((prev) => ({ ...prev, [detailsPanelNodeId]: content }))
            }
            onClose={() => setDetailsPanelNodeId(null)}
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
