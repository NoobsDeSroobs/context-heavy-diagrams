// The checks on edges as drawn (ADR 0161): over an element, crossing, and the labels.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram } from '../diagram/index.ts'
import { layoutIssues } from './inspect.ts'
import { applyOperations } from './operations.ts'

const build = (...ops) => applyOperations(createEmptyDiagram(), ops, { newId: (p) => p }).diagram
const entity = (id, x, y) => ({ op: 'add_entity', id, label: id, x, y })
const side = { fromHandle: 'right', toHandle: 'left' }
const issuesOf = (diagram, kind) => layoutIssues(diagram).filter((i) => i.kind === kind)

test('a bent edge is judged on its route: through an element it does not join, or round it', () => {
  const base = [entity('a', 0, 0), entity('b', 300, 0), entity('c', 600, 0)]
  const through = build(
    ...base,
    { op: 'connect', id: 'e', from: 'a', to: 'c', ...side },
    { op: 'set_edge_points', id: 'e', routing: 'smoothstep', points: [{ x: 360, y: 40 }] }
  )
  assert.deepEqual(
    issuesOf(through, 'edge-through-element').map((i) => i.ids),
    [['e', 'b']]
  )
  const round = build(
    ...base,
    { op: 'connect', id: 'e', from: 'a', to: 'c', ...side },
    {
      op: 'set_edge_points',
      id: 'e',
      routing: 'smoothstep',
      points: [
        { x: 240, y: -60 },
        { x: 540, y: -60 }
      ]
    }
  )
  assert.deepEqual(issuesOf(round, 'edge-through-element'), [])
})

test('two edges that cross are reported once, and edges that share a connection point are not', () => {
  const diagram = build(
    entity('a', 0, 0),
    entity('c', 600, 0),
    entity('d', 0, 300),
    entity('e', 600, 300),
    { op: 'connect', id: 'ac', from: 'a', to: 'c', ...side },
    { op: 'connect', id: 'ae', from: 'a', to: 'e', ...side },
    { op: 'connect', id: 'dc', from: 'd', to: 'c', ...side },
    { op: 'connect', id: 'de', from: 'd', to: 'e', ...side }
  )
  assert.deepEqual(
    issuesOf(diagram, 'edge-crossing').map((i) => i.ids),
    [['ae', 'dc']]
  )
})

test('a label on an element, on another edge or on another label is reported', () => {
  const over = build(
    entity('a', 0, 0),
    entity('b', 400, 0),
    { op: 'add_entity', id: 'block', label: 'block', x: 230, y: 10, width: 60, height: 60 },
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'goes through the middle', ...side }
  )
  assert.deepEqual(
    issuesOf(over, 'label-over-element').map((i) => i.ids),
    [['ab', 'block']]
  )

  const crossed = build(
    entity('a', 0, 0),
    entity('b', 400, 0),
    entity('p', 200, -200),
    entity('q', 200, 200),
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'reads', ...side },
    { op: 'connect', id: 'pq', from: 'p', to: 'q', fromHandle: 'bottom', toHandle: 'top' }
  )
  assert.deepEqual(
    issuesOf(crossed, 'label-over-edge').map((i) => i.ids),
    [['ab', 'pq']]
  )

  const stacked = build(
    entity('a', 0, 0),
    entity('b', 400, 0),
    entity('p', 200, -200),
    entity('q', 200, 200),
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'reads', ...side },
    {
      op: 'connect',
      id: 'pq',
      from: 'p',
      to: 'q',
      label: 'writes',
      fromHandle: 'bottom',
      toHandle: 'top'
    }
  )
  assert.equal(issuesOf(stacked, 'label-over-label').length, 1)
})

test('an edge label on a container wall or on its title is reported, and sliding it clear fixes it', () => {
  const wallOps = [
    { op: 'add_container', id: 'zone', label: '', x: 200, y: 0, width: 300, height: 200 },
    { op: 'add_entity', id: 'out', label: 'out', x: 0, y: 60 },
    { op: 'add_entity', id: 'in', label: 'in', x: 260, y: 60, parent: 'zone' },
    { op: 'connect', id: 'calls', from: 'out', to: 'in', label: 'calls', ...side }
  ]
  const onWall = build(...wallOps)
  assert.deepEqual(
    issuesOf(onWall, 'label-on-container-border').map((i) => i.ids),
    [['calls', 'zone']]
  )
  // Slid into the container, the label is wholly inside.
  const inside = build(...wallOps, { op: 'set_style', id: 'calls', style: { labelPosition: 0.9 } })
  assert.deepEqual(issuesOf(inside, 'label-on-container-border'), [])

  const titled = build(
    {
      op: 'add_container',
      id: 'net',
      label: 'Production network zone',
      x: 0,
      y: 0,
      width: 400,
      height: 120
    },
    { op: 'add_entity', id: 'a', label: 'a', x: 10, y: 10, width: 40, height: 20, parent: 'net' },
    { op: 'add_entity', id: 'b', label: 'b', x: 140, y: 10, width: 40, height: 20, parent: 'net' },
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'x', ...side }
  )
  assert.deepEqual(
    issuesOf(titled, 'label-over-container-title').map((i) => i.ids),
    [['ab', 'net']]
  )
  const wide = build(
    {
      op: 'add_container',
      id: 'net',
      label: 'Production network zone',
      x: 0,
      y: 0,
      width: 400,
      height: 200
    },
    { op: 'add_entity', id: 'a', label: 'a', x: 30, y: 100, parent: 'net' },
    { op: 'add_entity', id: 'b', label: 'b', x: 230, y: 100, parent: 'net' },
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'x', ...side }
  )
  assert.deepEqual(issuesOf(wide, 'label-over-container-title'), [])
  assert.deepEqual(issuesOf(wide, 'label-on-container-border'), [])
})

test('a tidy diagram has nothing to report', () => {
  const diagram = build(
    entity('a', 0, 0),
    entity('b', 400, 0),
    entity('c', 800, 0),
    { op: 'connect', id: 'ab', from: 'a', to: 'b', label: 'reads', ...side },
    { op: 'connect', id: 'bc', from: 'b', to: 'c', label: 'writes', ...side }
  )
  assert.deepEqual(layoutIssues(diagram), [])
})

test('an element named by a paragraph is quoted on one line, cut short', () => {
  const diagram = build(
    entity('a', 0, 0),
    entity('b', 400, 0),
    {
      op: 'add_entity',
      id: 'long',
      label: 'Line one\nline two '.repeat(8),
      x: 150,
      y: 10,
      width: 200,
      height: 60
    },
    { op: 'connect', id: 'ab', from: 'a', to: 'b', ...side }
  )
  const [found] = issuesOf(diagram, 'edge-through-element')
  assert.doesNotMatch(found.message, /\n/)
  assert.match(found.message, /"Line one line two Line one line two Lin…"/)
})
