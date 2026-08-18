// v1 diagram file schema. See docs/decisions/0003-diagram-persistence-v1.md —
// later epics add fields here (style, rotation, icons, details, linkedDiagram)
// additively, not as a rewrite.

export interface DiagramNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: { label: string }
}

export interface DiagramEdge {
  id: string
  source: string
  target: string
}

export interface DiagramFile {
  version: 1
  viewport: { x: number; y: number; zoom: number }
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export function createEmptyDiagram(): DiagramFile {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] }
}

// Fixed key order on every object built here is what makes JSON.stringify's
// output deterministic — see the ADR for why this matters for git diffs.
export function serializeDiagram(diagram: DiagramFile): string {
  const ordered: DiagramFile = {
    version: diagram.version,
    viewport: { x: diagram.viewport.x, y: diagram.viewport.y, zoom: diagram.viewport.zoom },
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: { label: n.data.label }
    })),
    edges: diagram.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

export function parseDiagram(raw: string): DiagramFile {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
    !Array.isArray((parsed as { edges?: unknown }).edges)
  ) {
    throw new Error('Not a recognized diagram.json (expected { version: 1, nodes, edges, ... })')
  }
  return parsed as DiagramFile
}
