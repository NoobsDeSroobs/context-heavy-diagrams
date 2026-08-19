import { useCallback, useEffect, useState } from 'react'
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
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DiagramFile, IconRef, IconSlot } from '@shared/diagram'
import ShapeNode, { SHAPE_MIN_WIDTH, SHAPE_MIN_HEIGHT } from './nodes/ShapeNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from './nodes/TextNode'
import LabeledEdge from './edges/LabeledEdge'
import DiagramContext from './DiagramContext'
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu'
import IconPicker from './components/IconPicker'
import DetailsPanel from './components/DetailsPanel'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts.
const nodeTypes = { shape: ShapeNode, text: TextNode }
const edgeTypes = { labeled: LabeledEdge }

let nextId = 1
function newNodeId(prefix: string): string {
  return `${prefix}-${nextId++}`
}

// No Node `path` module in the renderer (see docs/architecture/overview.md's
// process model) — breadcrumb labels just need the file name, not a real
// path-parsing library.
function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

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
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      width: n.size?.width,
      height: n.size?.height,
      data: {
        label: n.data.label,
        ...(n.rotation != null ? { rotation: n.rotation } : {}),
        ...(n.data.icons ? { icons: n.data.icons } : {}),
        ...(n.data.details ? { details: n.data.details } : {}),
        ...(n.data.linkedDiagram ? { linkedDiagram: n.data.linkedDiagram } : {})
      }
    })),
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
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
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'labeled' }, eds)),
    [setEdges]
  )

  const addShapeNode = useCallback(() => {
    const id = newNodeId('shape')
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'shape',
        position: { x: 80 + nds.length * 40, y: 80 + nds.length * 40 },
        width: SHAPE_MIN_WIDTH * 2,
        height: SHAPE_MIN_HEIGHT * 2,
        data: { label: 'Shape' }
      }
    ])
  }, [setNodes])

  const addTextNode = useCallback(() => {
    const id = newNodeId('text')
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'text',
        position: { x: 80 + nds.length * 40, y: 80 + nds.length * 40 },
        width: TEXT_MIN_WIDTH * 3,
        height: TEXT_MIN_HEIGHT * 2,
        data: { label: 'Text', rotation: 0 }
      }
    ])
  }, [setNodes])

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  // Shared by "Open", forward link-navigation, and breadcrumb back-nav — the
  // one place that applies a loaded DiagramFile to all canvas state. Also
  // closes any panel/menu left open from the diagram just navigated away
  // from (handleOpen alone never needed this — a rare deliberate action —
  // but link-navigation is frequent enough that a stale panel referencing a
  // node id from the previous diagram becomes a real, visible bug).
  const loadDiagramIntoCanvas = useCallback(
    (path: string, diagram: DiagramFile) => {
      const { nodes: openedNodes, edges: openedEdges } = fromDiagramFile(diagram)
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

  return (
    <DiagramContext.Provider
      value={{
        diagramPath: currentPath,
        openContextMenu,
        openIconPicker,
        openDetailsPanel,
        handleLinkClick
      }}
    >
      <div style={{ width: '100vw', height: '100vh' }}>
        <div className="toolbar">
          <button onClick={addShapeNode}>Add shape</button>
          <button onClick={addTextNode}>Add text</button>
          <button onClick={handleOpen}>Open…</button>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleSaveAs}>Save As…</button>
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
              rfInstance.updateNodeData(iconPicker.nodeId, {
                icons: { ...iconPickerIcons, [slot]: icon }
              })
              setIconPicker(null)
            }}
            onRemove={(slot) => {
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
