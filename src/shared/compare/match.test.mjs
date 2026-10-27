// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyIdMatches, detectIdChurn, matchReplaced } from './match.ts'
import { classifyDiagrams } from './classify.ts'

const node = (id, label, x = 0, y = 0, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  data: { label },
  ...extra
})
const edge = (id, source, target, label) => ({ id, source, target, ...(label ? { label } : {}) })
const diagram = (nodes, edges = [], extra = {}) => ({ version: 1, nodes, edges, ...extra })

// The same diagram with every id replaced, the way a rewriting assistant does.
const rewritten = (d) => {
  const rename = (id) => `new-${id}`
  return diagram(
    d.nodes.map((n) => ({ ...n, id: rename(n.id) })),
    d.edges.map((e) => ({
      ...e,
      id: rename(e.id),
      source: rename(e.source),
      target: rename(e.target)
    }))
  )
}

const base = diagram(
  [
    node('a', 'Billing', 0, 0),
    node('b', 'Orders', 300, 0),
    node('c', 'Payments', 0, 200),
    node('d', 'Shipping', 300, 200)
  ],
  [edge('e1', 'a', 'b', 'calls'), edge('e2', 'b', 'c'), edge('e3', 'c', 'd', 'notifies')]
)

test('a diagram whose ids were all replaced is suspected; a few real edits are not', () => {
  const churned = detectIdChurn(base, rewritten(base))
  assert.equal(churned.suspected, true)
  assert.equal(churned.twins, 4)

  const edited = diagram([
    node('a', 'Billing'),
    node('b', 'Orders'),
    node('c', 'Payments'),
    node('x', 'Something new')
  ])
  const normal = detectIdChurn(base, edited)
  assert.equal(normal.suspected, false)
})

test('matching finds every element and connection of a rewritten diagram', () => {
  const next = rewritten(base)
  const m = matchReplaced(base, next)
  assert.deepEqual([...m.nodes.entries()].sort(), [
    ['a', 'new-a'],
    ['b', 'new-b'],
    ['c', 'new-c'],
    ['d', 'new-d']
  ])
  assert.deepEqual([...m.edges.entries()].sort(), [
    ['e1', 'new-e1'],
    ['e2', 'new-e2'],
    ['e3', 'new-e3']
  ])
  // With the pairs applied, nothing differs: the rewrite changed no content.
  const c = classifyDiagrams(applyIdMatches(base, m), next)
  assert.equal(c.review.length, 0)
})

test('several elements with one name are told apart by where they are', () => {
  const twins = diagram([node('l', 'Cache', 0, 0), node('r', 'Cache', 1000, 0)])
  const next = diagram([node('r2', 'Cache', 1000, 10), node('l2', 'Cache', 5, 0)])
  const m = matchReplaced(twins, next)
  assert.equal(m.nodes.get('l'), 'l2')
  assert.equal(m.nodes.get('r'), 'r2')
})

test('a renamed element is matched by a similar name and nearly the same place, a different one is not', () => {
  const before = diagram([node('p', 'Passenger', 0, 0), node('s', 'Staff', 500, 0)])
  const after = diagram([
    node('p2', 'Passenger (mobile app user)', 10, 0),
    node('z', 'Gateway', 900, 400)
  ])
  const m = matchReplaced(before, after)
  assert.equal(m.nodes.get('p'), 'p2')
  assert.equal(m.nodes.has('s'), false)
  // The rename still shows as a change once they are paired.
  const c = classifyDiagrams(applyIdMatches(before, m), after)
  assert.equal(c.nodes.get('p2').status, 'content')
})

test('elements of a different type are never paired', () => {
  const before = diagram([node('a', 'Billing')])
  const after = diagram([node('b', 'Billing', 0, 0, { type: 'container' })])
  assert.equal(matchReplaced(before, after).nodes.size, 0)
})

test('applying matches rewrites everything that names a node', () => {
  const before = diagram(
    [node('p', 'Box'), node('c', 'Child', 5, 5, { parentId: 'p' })],
    [{ ...edge('e', 'c', 'p'), directionSets: { s1: { source: 'c', target: 'p' } } }],
    { security: { threats: [], matrixEntityIds: ['c'], hiddenEntityIds: ['c'] } }
  )
  const out = applyIdMatches(before, {
    nodes: new Map([
      ['p', 'P'],
      ['c', 'C']
    ]),
    edges: new Map([['e', 'E']])
  })
  assert.equal(out.nodes[1].id, 'C')
  assert.equal(out.nodes[1].parentId, 'P')
  assert.deepEqual([out.edges[0].id, out.edges[0].source, out.edges[0].target], ['E', 'C', 'P'])
  assert.deepEqual(out.edges[0].directionSets.s1, { source: 'C', target: 'P' })
  assert.deepEqual(out.security.matrixEntityIds, ['C'])
  assert.deepEqual(out.security.hiddenEntityIds, ['C'])
  // The input is not changed.
  assert.equal(before.nodes[0].id, 'p')
})
