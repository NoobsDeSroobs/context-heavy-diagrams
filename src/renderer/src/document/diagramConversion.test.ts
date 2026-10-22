import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDiagram, serializeDiagram, type DiagramFile } from '@shared/diagram'
import { fromDiagramFile, toDiagramFile } from './diagramConversion'

// The canvas holds React Flow nodes and edges; saving converts back. Whatever a file contains must
// survive that trip unchanged, or opening and saving a diagram would silently rewrite it.
const roundTrip = (file: DiagramFile): DiagramFile => {
  const r = fromDiagramFile(file)
  return toDiagramFile(
    r.nodes,
    r.edges,
    r.metadata,
    r.requiredTags,
    r.highlights,
    r.legend,
    r.gravityPresets,
    r.maxConnectionPointsPerSide,
    r.edgeDirectionSets,
    r.activeEdgeDirectionSetId,
    r.security,
    r.fontFamily
  )
}

const fixture = (): DiagramFile => ({
  version: 1,
  metadata: { owner: 'team' },
  requiredTags: [{ key: 'env', lock: 'lockedEditable', allowedValues: ['dev', 'prod'] }],
  highlights: [{ key: 'env', value: 'prod', color: '#ff0000' }],
  legend: [{ id: 'l1', kind: 'line', label: 'Calls', color: '#336699', lineStyle: 'dashed' }],
  gravityPresets: [{ id: 'g1', label: 'Tight', value: 0.2 }],
  maxConnectionPointsPerSide: 3,
  fontFamily: "'Georgia', serif",
  security: {
    threats: [{ id: 't1', name: 'Spoofing' }],
    matrixEntityIds: ['a'],
    probabilityScale: [{ value: 1, label: 'Rare', description: 'Almost never' }]
  },
  nodes: [
    {
      id: 'box',
      type: 'container',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      zIndex: 5,
      data: { label: 'Box' }
    },
    {
      id: 'a',
      type: 'entity',
      position: { x: 20, y: 30 },
      size: { width: 120, height: 60 },
      zIndex: 40,
      parentId: 'box',
      locked: true,
      connectionPoints: [{ id: 'cp1', side: 'right', offset: 0.25 }],
      style: { fill: '#112233', fontSize: 14 },
      metadata: { env: { value: 'prod', lock: 'lockedEditable' } },
      data: {
        label: 'A',
        icons: { topLeft: { source: 'builtin', id: 'user' } },
        details: 'details/a.md',
        linkedDiagram: 'a/child.chd',
        references: ['assets/references/one.png'],
        security: { t1: { probability: 2, consequence: 3 } }
      }
    },
    {
      id: 'b',
      type: 'entity',
      position: { x: 220, y: 30 },
      size: { width: 120, height: 60 },
      zIndex: 41,
      parentId: 'box',
      data: { label: 'B' }
    },
    {
      id: 'line',
      type: 'line',
      position: { x: 0, y: 400 },
      size: { width: 100, height: 40 },
      zIndex: 60,
      data: {
        label: '',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 40, gravity: 0.8 }
        ]
      }
    }
  ],
  edges: [
    {
      id: 'e1',
      type: 'labeled',
      source: 'a',
      target: 'b',
      sourceHandle: 'cp1',
      label: 'calls',
      style: { stroke: '#336699', endMarker: 'arrowClosed', routingStyle: 'catmullRom' },
      points: [{ x: 90, y: 60, gravity: 0.5 }]
    }
  ]
})

describe('toDiagramFile / fromDiagramFile', () => {
  it('round-trips a diagram that uses every feature, byte for byte', () => {
    const file = fixture()
    expect(serializeDiagram(roundTrip(file))).toBe(serializeDiagram(file))
  })

  it('does not write an explicit type: undefined on an edge that had no type', () => {
    const file = fixture()
    delete file.edges[0].type
    const edge = fromDiagramFile(file).edges[0]
    expect('type' in edge).toBe(false)
  })

  it('shows the active direction set’s orientation but saves the base orientation', () => {
    const file = fixture()
    file.edgeDirectionSets = [
      { id: 'flow', name: 'Data flow' },
      { id: 'trigger', name: 'Trigger' }
    ]
    file.activeEdgeDirectionSetId = 'trigger'
    file.edges[0].directionSets = {
      flow: { source: 'a', target: 'b', sourceHandle: 'cp1' },
      trigger: { source: 'b', target: 'a' }
    }
    const edge = fromDiagramFile(file).edges[0]
    expect([edge.source, edge.target]).toEqual(['b', 'a'])
    const saved = roundTrip(file)
    expect([saved.edges[0].source, saved.edges[0].target]).toEqual(['a', 'b'])
    expect(serializeDiagram(saved)).toBe(serializeDiagram(file))
  })

  it('backfills a missing zIndex, so a second pass changes nothing', () => {
    const file = fixture()
    for (const n of file.nodes) delete n.zIndex
    const once = roundTrip(file)
    expect(once.nodes.every((n) => typeof n.zIndex === 'number')).toBe(true)
    expect(serializeDiagram(roundTrip(once))).toBe(serializeDiagram(once))
  })

  it('repairs a dangling parent and says so', () => {
    const file = fixture()
    file.nodes[1].parentId = 'gone'
    const r = fromDiagramFile(file)
    expect(r.nodes.find((n) => n.id === 'a')?.parentId).toBeUndefined()
    expect(r.hierarchyNotes).toEqual([
      "Removed 1 node reference to a container that isn't in this file."
    ])
  })

  it('prunes security references that no longer resolve and says so', () => {
    const file = fixture()
    file.security!.matrixEntityIds = ['a', 'deleted']
    const r = fromDiagramFile(file)
    expect(r.security.matrixEntityIds).toEqual(['a'])
    expect(r.hierarchyNotes.join(' ')).toMatch(/1 entity reference\(s\) dropped/)
  })

  it('leaves an empty diagram empty', () => {
    const empty: DiagramFile = { version: 1, nodes: [], edges: [] }
    expect(serializeDiagram(roundTrip(empty))).toBe(serializeDiagram(empty))
  })
})

describe('the example diagrams', () => {
  const root = resolve('examples')
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((f) =>
    f.endsWith('.chd')
  )

  it('finds the examples', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  it.each(files)('%s is stable once it has been through the canvas', (rel) => {
    const raw = readFileSync(`${root}/${rel}`, 'utf8')
    const once = serializeDiagram(roundTrip(parseDiagram(raw)))
    const twice = serializeDiagram(roundTrip(parseDiagram(once)))
    expect(twice).toBe(once)
  })
})
