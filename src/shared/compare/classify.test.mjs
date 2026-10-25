// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyDiagrams } from './classify.ts'

const node = (id, over = {}) => ({
  id,
  type: 'entity',
  position: { x: 0, y: 0 },
  data: { label: `Node ${id}` },
  ...over
})
const edge = (id, source, target, over = {}) => ({ id, source, target, ...over })
const diagram = (nodes = [], edges = []) => ({ version: 1, nodes, edges })

const statusOf = (classification, id) => classification.nodes.get(id)?.status

test('nothing changed: nothing is classified', () => {
  const d = diagram([node('a')], [edge('e', 'a', 'a')])
  const c = classifyDiagrams(d, d)
  assert.equal(c.nodes.size, 0)
  assert.equal(c.edges.size, 0)
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
})

test('label, tags, security and parent changes are yellow', () => {
  const base = diagram([node('a'), node('b'), node('c'), node('p')])
  const next = diagram([
    node('a', { data: { label: 'Renamed' } }),
    node('b', { metadata: { env: { value: 'prod' } } }),
    node('c', { parentId: 'p' }),
    node('p')
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'content')
  assert.deepEqual(c.nodes.get('a').fields, ['label'])
  assert.equal(statusOf(c, 'b'), 'content')
  assert.equal(statusOf(c, 'c'), 'content')
  assert.equal(statusOf(c, 'p'), undefined)
})

test('an edge changing its ends or its connection points is yellow', () => {
  const base = diagram(
    [node('a'), node('b'), node('c')],
    [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')]
  )
  const next = diagram(
    [node('a'), node('b'), node('c')],
    [edge('e1', 'a', 'c'), edge('e2', 'a', 'b', { sourceHandle: 'cp-1' })]
  )
  const c = classifyDiagrams(base, next)
  assert.equal(c.edges.get('e1').status, 'content')
  assert.equal(c.edges.get('e2').status, 'content')
})

test('a link or Details path added, changed or removed is orange, and beats yellow', () => {
  const base = diagram([
    node('a'),
    node('b', { data: { label: 'B', linkedDiagram: 'old.chd' } }),
    node('c', { data: { label: 'C', details: 'c/notes.md' } })
  ])
  const next = diagram([
    node('a', { data: { label: 'A', linkedDiagram: 'new.chd' } }),
    node('b', { data: { label: 'B', linkedDiagram: 'other.chd' } }),
    node('c', { data: { label: 'C2' } })
  ])
  const c = classifyDiagrams(base, next)
  assert.equal(statusOf(c, 'a'), 'links')
  assert.equal(statusOf(c, 'b'), 'links')
  assert.equal(statusOf(c, 'c'), 'links')
  assert.deepEqual(c.nodes.get('c').fields, ['label', 'details link'])
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
