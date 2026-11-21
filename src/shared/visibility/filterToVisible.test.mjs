// Run with `npm test`. The diagram as the exports draw it with sets hidden (ADR 0194).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterToVisible } from './filterToVisible.ts'
import { DEFAULT_SVG_EXPORT_OPTIONS, renderDiagramSvg } from '../export/renderDiagram.ts'

const node = (id, x, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y: 0 },
  size: { width: 100, height: 50 },
  data: { label: id },
  ...extra
})
const diagram = (nodes, edges = [], extra = {}) => ({
  version: 1,
  visibilitySets: [
    { id: 'today', name: 'Today' },
    { id: 'next', name: 'Next' }
  ],
  nodes,
  edges,
  ...extra
})
const hide = (...ids) => new Set(ids)

test('nothing hidden gives back the same diagram', () => {
  const d = diagram([node('a', 0, { visibilitySetIds: ['today'] })])
  assert.equal(filterToVisible(d, hide()), d)
})

test('what the sets hide is left out, and the rest stays as it was', () => {
  const d = diagram([
    node('a', 0, { visibilitySetIds: ['today'] }),
    node('b', 200),
    node('c', 400, { visibilitySetIds: ['next'] })
  ])
  const out = filterToVisible(d, hide('today'))
  assert.deepEqual(
    out.nodes.map((n) => n.id),
    ['b', 'c']
  )
  assert.equal(out.nodes[0], d.nodes[1])
})

test('an edge goes when its own sets hide it, or when an end is left out', () => {
  const d = diagram(
    [node('a', 0, { visibilitySetIds: ['today'] }), node('b', 200), node('c', 400)],
    [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
      { id: 'bc2', source: 'b', target: 'c', visibilitySetIds: ['today'] }
    ]
  )
  const out = filterToVisible(d, hide('today'))
  assert.deepEqual(
    out.edges.map((e) => e.id),
    ['bc']
  )
})

test('a child of a container that is left out keeps the place it has on screen', () => {
  const d = diagram([
    node('box', 100, { type: 'container', visibilitySetIds: ['today'] }),
    node('inner', 20, { parentId: 'box' })
  ])
  const out = filterToVisible(d, hide('today'))
  assert.equal(out.nodes.length, 1)
  assert.equal(out.nodes[0].parentId, undefined)
  assert.deepEqual(out.nodes[0].position, { x: 120, y: 0 })
})

test('a child moves to the nearest container that is still drawn', () => {
  const d = diagram([
    node('outer', 10, { type: 'container' }),
    node('middle', 30, { type: 'container', parentId: 'outer', visibilitySetIds: ['today'] }),
    node('inner', 5, { parentId: 'middle' })
  ])
  const out = filterToVisible(d, hide('today'))
  const inner = out.nodes.find((n) => n.id === 'inner')
  assert.equal(inner.parentId, 'outer')
  assert.deepEqual(inner.position, { x: 35, y: 0 })
})

test('a drawn export holds only what is shown', () => {
  const d = diagram([node('a', 0, { visibilitySetIds: ['today'] }), node('b', 200)])
  const svg = renderDiagramSvg(filterToVisible(d, hide('today')), {
    ...DEFAULT_SVG_EXPORT_OPTIONS,
    icons: new Map()
  })
  assert.equal(svg.includes('>b<') || svg.includes('>B<'), true)
  assert.equal(svg.includes('>a<') || svg.includes('>A<'), false)
})
