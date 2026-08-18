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
        details: typeof n.data?.details === 'string' ? (n.data.details as string) : undefined
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
        ...(n.data.details ? { details: n.data.details } : {})
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

  const performSave = useCallback(
    async (forceNewPath: boolean) => {
      try {
        let path = forceNewPath ? null : currentPath
        if (!path) {
          path = await window.api.pickSavePath()
          if (!path) return
        }
        const savedNodes = await flushDetailsDrafts(path, nodes)
        const diagram = toDiagramFile(savedNodes, edges, rfInstance.getViewport())
        await window.api.saveDiagram(path, diagram)
        setCurrentPath(path)
      } catch (error) {
        alert(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, nodes, edges, rfInstance, flushDetailsDrafts]
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

  const handleOpen = useCallback(async () => {
    let result: Awaited<ReturnType<typeof window.api.openDiagram>>
    try {
      result = await window.api.openDiagram()
    } catch (error) {
      alert(`Open failed: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (!result) return
    const { nodes: openedNodes, edges: openedEdges } = fromDiagramFile(result.diagram)
    setNodes(openedNodes)
    setEdges(openedEdges)
    rfInstance.setViewport(result.diagram.viewport)
    setCurrentPath(result.path)
    setDetailsDrafts({})
  }, [rfInstance, setNodes, setEdges])

  return (
    <DiagramContext.Provider
      value={{ diagramPath: currentPath, openContextMenu, openIconPicker, openDetailsPanel }}
    >
      <div style={{ width: '100vw', height: '100vh' }}>
        <div className="toolbar">
          <button onClick={addShapeNode}>Add shape</button>
          <button onClick={addTextNode}>Add text</button>
          <button onClick={handleOpen}>Open…</button>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleSaveAs}>Save As…</button>
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
