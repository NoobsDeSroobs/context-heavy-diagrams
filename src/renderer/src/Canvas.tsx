import { useCallback, useState } from 'react'
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
import type { DiagramFile } from '@shared/diagram'
import ShapeNode, { SHAPE_MIN_WIDTH, SHAPE_MIN_HEIGHT } from './nodes/ShapeNode'
import TextNode, { TEXT_MIN_WIDTH, TEXT_MIN_HEIGHT } from './nodes/TextNode'

// Defined at module scope so React Flow gets a stable reference — recreating
// this object every render triggers a React Flow warning and remounts.
const nodeTypes = { shape: ShapeNode, text: TextNode }

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
      data: { label: String(n.data?.label ?? '') }
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined
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
      data: { label: n.data.label, ...(n.rotation != null ? { rotation: n.rotation } : {}) }
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    }))
  }
}

function CanvasInner(): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const rfInstance = useReactFlow()

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
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
        data: { label: id }
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

  const handleSave = useCallback(async () => {
    const diagram = toDiagramFile(nodes, edges, rfInstance.getViewport())
    if (currentPath) {
      await window.api.saveDiagram(currentPath, diagram)
      return
    }
    const path = await window.api.saveDiagramAs(diagram)
    if (path) setCurrentPath(path)
  }, [nodes, edges, currentPath, rfInstance])

  const handleSaveAs = useCallback(async () => {
    const diagram = toDiagramFile(nodes, edges, rfInstance.getViewport())
    const path = await window.api.saveDiagramAs(diagram)
    if (path) setCurrentPath(path)
  }, [nodes, edges, rfInstance])

  const handleOpen = useCallback(async () => {
    const result = await window.api.openDiagram()
    if (!result) return
    const { nodes: openedNodes, edges: openedEdges } = fromDiagramFile(result.diagram)
    setNodes(openedNodes)
    setEdges(openedEdges)
    rfInstance.setViewport(result.diagram.viewport)
    setCurrentPath(result.path)
  }, [rfInstance, setNodes, setEdges])

  return (
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
        colorMode="dark" // hardcoded until epic 0005 adds a real light/dark toggle
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default function Canvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
