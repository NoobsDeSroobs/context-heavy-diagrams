// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyDiagrams } from './classify.ts'
import { diffCollections } from './collections.ts'
import { makeEdgesDrawable } from './drawable.ts'
import { EDGE_FIELDS, NODE_FIELDS } from './fields.ts'
import {
  EDGE_FIELDS as SAVE_EDGE_FIELDS,
  NODE_FIELDS as SAVE_NODE_FIELDS
} from '../document/changesSinceSave.ts'

const node = (id, over = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label: `Node ${id}` },
  ...over
})
const edge = (id, source, target, over = {}) => ({ id, source, target, ...over })
const diagram = (nodes = [], edges = [], over = {}) => ({ version: 1, nodes, edges, ...over })

const statusOf = (c, id) => c.nodes.get(id)?.status
const lines = (c, id, field) => c.nodes.get(id).fields.find((f) => f.field === field).lines

test('the field lists cover the same fields as "changes since last save"', () => {
  assert.deepEqual(
    NODE_FIELDS.map((f) => f.name),
    SAVE_NODE_FIELDS.map((f) => f.name)
  )
  assert.deepEqual(
    EDGE_FIELDS.map((f) => f.name),
    SAVE_EDGE_FIELDS.map((f) => f.name)
  )
})

test('nothing changed: nothing is classified', () => {
  const d = diagram([node('a')], [edge('e', 'a', 'a')])
  const c = classifyDiagrams(d, d)
  assert.equal(c.nodes.size, 0)
  assert.equal(c.edges.size, 0)
  assert.deepEqual(c.review, [])
  assert.deepEqual(c.diagramLevel, [])
})

test('added and removed elements; the removed one is kept in the merged diagram', () => {
  const base = diagram([node('gone')], [edge('e-gone', 'gone', 'gone')])
  const next = diagram([node('new')], [])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'new'), 'added')
  assert.equal(statusOf(c, 'gone'), 'removed')
  assert.equal(c.edges.get('e-gone').status, 'removed')
  assert.deepEqual(
    c.merged.nodes.map((n) => n.id),
    ['new', 'gone']
  )
  assert.deepEqual(
    c.merged.edges.map((e) => e.id),
    ['e-gone']
  )
  assert.deepEqual(c.counts, { added: 1, removed: 2, links: 0, content: 0 })
})

test('label, tags, security and parent changes are yellow, and say what changed', () => {
  const threats = [{ id: 't1', name: 'Spoofing' }]
  const base = diagram(
    [
      node('a'),
      node('b', { metadata: { env: { value: 'dev' }, team: { value: 'x' } } }),
      node('c'),
      node('p', { data: { label: 'Parent' } }),
      node('s', { data: { label: 'S', security: { t1: { probability: 2, consequence: 3 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['s'] } }
  )
  const next = diagram(
    [
      node('a', { data: { label: 'Renamed' } }),
      node('b', { metadata: { env: { value: 'prod' }, pci: { value: 'yes' } } }),
      node('c', { parentId: 'p' }),
      node('p', { data: { label: 'Parent' } }),
      node('s', { data: { label: 'S', security: { t1: { probability: 4, consequence: 3 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['s'] } }
  )
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'content')
  assert.deepEqual(lines(c, 'a', 'label'), ['label: "Node a" → "Renamed"'])
  assert.deepEqual(lines(c, 'b', 'tags'), ['~ env: "dev" → "prod"', '+ pci: "yes"', '− team: "x"'])
  assert.deepEqual(lines(c, 'c', 'parent'), ['container: (none) → "Parent"'])
  assert.deepEqual(lines(c, 's', 'security'), [
    '~ Spoofing: probability 2, consequence 3 → probability 4, consequence 3'
  ])
  assert.equal(c.nodes.get('s').security, true)
  assert.equal(statusOf(c, 'p'), undefined)
})

test('an edge changing its ends or its connection points is yellow, named by label', () => {
  const nodes = [node('a'), node('b'), node('c')]
  const base = diagram(nodes, [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')])
  const next = diagram(nodes, [
    edge('e1', 'a', 'c'),
    edge('e2', 'a', 'b', { sourceHandle: 'cp-1' })
  ])
  const c = classifyDiagrams(base, next)
  const e1 = c.edges.get('e1')
  assert.equal(e1.status, 'content')
  assert.deepEqual(e1.fields[0].lines, ['to: "Node b" → "Node c"'])
  assert.equal(c.edges.get('e2').status, 'content')
})

test('a link or Details path added, changed or removed is orange, and beats yellow', () => {
  const base = diagram([
    node('a'),
    node('b', { data: { label: 'B', linkedDiagram: 'old.chd' } }),
    node('c', { data: { label: 'C', details: 'c/notes.md', references: ['x.png'] } })
  ])
  const next = diagram([
    node('a', { data: { label: 'A', linkedDiagram: 'new.chd' } }),
    node('b', { data: { label: 'B', linkedDiagram: 'other.chd' } }),
    node('c', { data: { label: 'C2', references: ['y.png'] } })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'links')
  assert.deepEqual(lines(c, 'a', 'linked diagram'), ['linked diagram: added "new.chd"'])
  assert.deepEqual(lines(c, 'b', 'linked diagram'), ['linked diagram: "old.chd" → "other.chd"'])
  assert.equal(statusOf(c, 'c'), 'links')
  assert.deepEqual(lines(c, 'c', 'details link'), ['Details file: removed (was "c/notes.md")'])
  assert.deepEqual(lines(c, 'c', 'reference images'), [
    'reference image: added "y.png"',
    'reference image: removed "x.png"'
  ])
})

test('a changed Details file the caller found turns an otherwise unchanged element orange', () => {
  const d = diagram([node('a'), node('b')])
  const c = classifyDiagrams(d, d, { detailsContent: new Map([['a', 'changed']]) })
  assert.equal(statusOf(c, 'a'), 'links')
  assert.deepEqual(lines(c, 'a', 'Details file content'), ['Details file: content changed'])
  assert.equal(statusOf(c, 'b'), undefined)
})

test('only moving or restyling an element does not classify it', () => {
  const base = diagram([node('a'), node('b')])
  const next = diagram([
    node('a', { position: { x: 400, y: 300 }, size: { width: 99, height: 50 } }),
    node('b', { style: { fill: '#000000' }, rotation: 12, locked: true })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(c.nodes.size, 0)
})

test('the review list puts security first, then links, content, removed and added', () => {
  const threats = [{ id: 't', name: 'T' }]
  const base = diagram(
    [
      node('content'),
      node('links'),
      node('removed'),
      node('sec', { data: { label: 'S', security: { t: { probability: 1, consequence: 1 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['sec'] } }
  )
  const next = diagram(
    [
      node('added'),
      node('content', { data: { label: 'changed' } }),
      node('links', { data: { label: 'Node links', linkedDiagram: 'x.chd' } }),
      node('sec', { data: { label: 'S', security: { t: { probability: 5, consequence: 1 } } } })
    ],
    [],
    { security: { threats, matrixEntityIds: ['sec'] } }
  )
  const c = classifyDiagrams(base, next)
  assert.deepEqual(
    c.review.map((r) => r.id),
    ['sec', 'links', 'content', 'removed', 'added']
  )
})

test('diagram-level changes are listed by collection', () => {
  const base = diagram([node('a')], [], {
    requiredTags: [{ key: 'env', lock: 'none' }],
    legend: [{ id: 'l1', kind: 'line', label: 'Old' }],
    maxConnectionPointsPerSide: 3
  })
  const next = diagram([node('a')], [], {
    requiredTags: [
      { key: 'env', lock: 'none' },
      { key: 'owner', lock: 'none' }
    ],
    legend: [{ id: 'l1', kind: 'line', label: 'Old', color: '#fff' }],
    maxConnectionPointsPerSide: 5,
    metadata: { owner: 'me' }
  })
  const changes = diffCollections(base, next)
  const byName = Object.fromEntries(changes.map((c) => [c.name, c]))
  assert.deepEqual(byName['Required tags'].added, ['owner'])
  assert.deepEqual(byName['Legend'].changed, ['Old'])
  assert.deepEqual(byName['Diagram tags'].added, ['owner'])
  assert.deepEqual(byName['Max connection points per side'].setting, { before: '3', after: '5' })
  assert.equal(byName['Highlights'], undefined)
})

test('every edge is drawable: a connection point the node lacks is moved to one it has', () => {
  // Right side holds custom points only, so the implicit "right" handle does not exist.
  const system = node('sys', {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    connectionPoints: [
      { id: 'cp-1', side: 'right', offset: 0.7 },
      { id: 'cp-2', side: 'right', offset: 0.4 }
    ]
  })
  const other = node('other', { position: { x: 400, y: 0 }, size: { width: 100, height: 100 } })
  const d = diagram(
    [system, other],
    [
      edge('named', 'sys', 'other', { sourceHandle: 'right', targetHandle: 'left' }),
      edge('unnamed', 'sys', 'other'),
      edge('unknown', 'sys', 'other', { sourceHandle: 'cp-9', targetHandle: 'left' }),
      edge('fine', 'sys', 'other', { sourceHandle: 'cp-1', targetHandle: 'left' }),
      edge('lost', 'sys', 'ghost')
    ]
  )
  const { diagram: fixed, repaired, dangling } = makeEdgesDrawable(d)
  const by = Object.fromEntries(fixed.edges.map((e) => [e.id, e]))
  assert.equal(by.named.sourceHandle, 'cp-2') // nearest the middle of the right side
  assert.equal(by.named.targetHandle, 'left')
  assert.equal(by.unknown.sourceHandle, 'cp-2') // the side facing the other node
  // No point named is drawable as it is: the canvas uses the node's first point.
  assert.equal(by.unnamed.sourceHandle, undefined)
  assert.deepEqual([...repaired].sort(), ['named', 'unknown'])
  assert.deepEqual(dangling, ['lost'])
  // The input is untouched: the comparison itself runs on the files as they are.
  assert.equal(d.edges[0].sourceHandle, 'right')
})

test('the view repairs edges, the merged diagram and the classification do not', () => {
  const sys = node('sys', { connectionPoints: [{ id: 'cp-1', side: 'right', offset: 0.5 }] })
  const other = node('other', { position: { x: 400, y: 0 } })
  const d = diagram([sys, other], [edge('e', 'sys', 'other', { sourceHandle: 'right' })])
  const c = classifyDiagrams(d, d)
  assert.equal(c.merged.edges[0].sourceHandle, 'right')
  assert.equal(c.view.edges[0].sourceHandle, 'cp-1')
  assert.deepEqual([...c.repairedEdges], ['e'])
  assert.equal(c.edges.size, 0)
})
