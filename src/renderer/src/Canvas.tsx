import { useCallback, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
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

let nextId = 1
function newNodeId(): string {
  return `node-${nextId++}`
}

function toDiagramFile(nodes: Node[], edges: Edge[], viewport: Viewport): DiagramFile {
  return {
    version: 1,
    viewport,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: { label: String(n.data?.label ?? '') }
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
  }
}

function fromDiagramFile(diagram: DiagramFile): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data.label }
    })),
    edges: diagram.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
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

  const addNode = useCallback(() => {
    const id = newNodeId()
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'default',
        position: { x: 80 + nds.length * 40, y: 80 + nds.length * 40 },
        data: { label: id }
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
        <button onClick={addNode}>Add node</button>
        <button onClick={handleOpen}>Open…</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleSaveAs}>Save As…</button>
        {currentPath && <span className="toolbar-path">{currentPath}</span>}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
