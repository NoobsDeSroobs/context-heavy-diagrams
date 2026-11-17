// The editing operations for behaviours (stencils), label positions and the crossings an inspection
// reports (ADR 0180, ADR 0183, ADR 0184, ADR 0185).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../diagram/index.ts'
import { describeDiagram } from './inspect.ts'
import { applyOperations } from './operations.ts'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}` }
const run = (diagram, ...ops) => applyOperations(diagram, ops, options)
const start = () => createEmptyDiagram()

function assertRoundTrips(diagram) {
  const text = serializeDiagram(diagram)
  assert.deepEqual(serializeDiagram(parseDiagram(text)), text)
}

test('add_behaviour makes a behaviour of the kind with its own size and default label; a bad kind lists the kinds', () => {
  const { diagram, results } = run(
    start(),
    { op: 'add_container', id: 'lane', label: 'Sales', x: 0, y: 0, width: 400, height: 200 },
    { op: 'add_behaviour', id: 'go', kind: 'event-start', x: 20, y: 40, parent: 'lane' },
    { op: 'add_behaviour', id: 'do', label: 'Check order', x: 100, y: 40, parent: 'lane' }
  )
  const [, go, doIt] = diagram.nodes
  assert.deepEqual(go.data, { label: 'Start', kind: 'event-start' })
  assert.deepEqual(go.size, { width: 40, height: 40 })
  assert.equal(go.type, 'stencil')
  assert.deepEqual(doIt.data, { label: 'Check order', kind: 'step' })
  assert.deepEqual(doIt.size, { width: 150, height: 56 })
  assert.equal(go.metadata, undefined, 'a behaviour carries no tags')
  assert.equal(results[1].element.label, 'Start', 'the answer says the label was filled in')
  assert.equal(results[2].element.label, undefined)
  assert.equal(results[2].element.kind, 'step')
  assertRoundTrips(diagram)
  assert.throws(
    () => run(start(), { op: 'add_behaviour', kind: 'gateway', x: 0, y: 0 }),
    /branch-exclusive/
  )
  assert.throws(
    () => run(start(), { op: 'add_behaviour', x: 0, y: 0, tags: { a: 1 } }),
    /a behaviour element carries no tags/
  )
})

test('a behaviour can be connected, moved, resized, restyled, linked and removed; no note, no tag', () => {
  const { diagram } = run(
    start(),
    { op: 'add_behaviour', id: 'a', x: 0, y: 0 },
    { op: 'add_behaviour', id: 'b', kind: 'branch-exclusive', x: 300, y: 0 },
    { op: 'connect', from: 'a', to: 'b' },
    { op: 'move', id: 'b', x: 320, y: 10 },
    { op: 'resize', id: 'a', width: 200 },
    { op: 'set_style', id: 'a', style: { fill: '#112233' } },
    { op: 'link_to_existing_diagram', id: 'a', path: 'a/Sub.chd' }
  )
  assert.equal(diagram.edges.length, 1)
  assert.equal(diagram.nodes[0].data.linkedDiagram, 'a/Sub.chd')
  assert.throws(
    () => run(diagram, { op: 'set_tag', id: 'a', key: 'k', value: 1 }),
    /"a" is a behaviour; only entities/
  )
  assert.throws(
    () => run(diagram, { op: 'set_note', id: 'a', text: 'x' }),
    /takes a link to another diagram but no note/
  )
  assert.equal(run(diagram, { op: 'remove', id: 'b' }).diagram.edges.length, 0)
  assert.throws(() => run(diagram, { op: 'reparent', id: 'a', parent: 'b' }), /is not a container/)
})

test('a required tag is not put on a behaviour', () => {
  const { diagram } = run(
    start(),
    { op: 'add_behaviour', id: 'a', x: 0, y: 0 },
    { op: 'add_entity', id: 'e', x: 200, y: 0 },
    { op: 'set_required_tag', key: 'owner' }
  )
  assert.equal(diagram.nodes[0].metadata, undefined)
  assert.ok(diagram.nodes[1].metadata?.owner)
})

test("set_behaviour_kind swaps the kind; the label and size follow only while they are the old kind's own", () => {
  const before = run(
    start(),
    { op: 'add_behaviour', id: 'a', kind: 'branch-exclusive', x: 100, y: 100 },
    {
      op: 'add_behaviour',
      id: 'b',
      kind: 'branch-exclusive',
      label: 'Paid?',
      x: 200,
      y: 100,
      width: 60
    }
  ).diagram
  const { diagram, results } = run(
    before,
    { op: 'set_behaviour_kind', id: 'a', kind: 'step' },
    { op: 'set_behaviour_kind', id: 'b', kind: 'branch-parallel' }
  )
  const [a, b] = diagram.nodes
  assert.deepEqual(a.data, { label: 'Step', kind: 'step' })
  assert.deepEqual(a.size, { width: 150, height: 56 })
  assert.deepEqual(a.position, { x: 100 + (48 - 150) / 2, y: 100 + (48 - 56) / 2 })
  assert.deepEqual(b.data, { label: 'Paid?', kind: 'branch-parallel' })
  assert.deepEqual(b.size, { width: 60, height: 48 })
  assert.equal(results[0].element.kind, 'step')
  assert.throws(
    () => run(diagram, { op: 'set_behaviour_kind', id: 'a', kind: 'nope' }),
    /not a kind/
  )
  assert.throws(
    () =>
      run(
        start(),
        { op: 'add_entity', id: 'e', x: 0, y: 0 },
        { op: 'set_behaviour_kind', id: 'e', kind: 'step' }
      ),
    /not a behaviour/
  )
})

test('set_label_position moves the label of a small behaviour or a container; the default is stored as nothing', () => {
  const base = run(
    start(),
    { op: 'add_behaviour', id: 'd', kind: 'branch-exclusive', x: 0, y: 0 },
    { op: 'add_behaviour', id: 's', x: 100, y: 0 },
    { op: 'add_container', id: 'lane', label: 'L', x: 0, y: 200 },
    { op: 'add_entity', id: 'e', x: 0, y: 500 }
  ).diagram
  const set = (diagram, id, position, offset) =>
    run(diagram, { op: 'set_label_position', id, position, ...(offset ? { offset } : {}) }).diagram
  let diagram = set(base, 'd', 'right')
  assert.equal(diagram.nodes[0].data.labelPosition, 'right')
  diagram = set(diagram, 'd', 'free')
  // The label of a decision (48 px) sat to its right, about 4 + 35 px from the centre's edge.
  assert.equal(diagram.nodes[0].data.labelPosition, 'free')
  assert.deepEqual(diagram.nodes[0].data.labelOffset, { x: 63, y: 0 })
  diagram = set(diagram, 'd', 'free', { x: 10, y: -30 })
  assert.deepEqual(diagram.nodes[0].data.labelOffset, { x: 10, y: -30 })
  diagram = set(diagram, 'd', 'below')
  assert.equal(diagram.nodes[0].data.labelPosition, undefined)
  assert.equal(diagram.nodes[0].data.labelOffset, undefined)
  diagram = set(diagram, 'lane', 'left')
  assert.equal(diagram.nodes[2].data.labelPosition, 'left')
  diagram = set(diagram, 'lane', 'top')
  assert.equal(diagram.nodes[2].data.labelPosition, undefined)
  assertRoundTrips(diagram)
  const fails = (op, pattern) => assert.throws(() => run(base, op), pattern)
  fails({ op: 'set_label_position', id: 's', position: 'above' }, /sits inside/)
  fails({ op: 'set_label_position', id: 'e', position: 'above' }, /not a behaviour or a container/)
  fails({ op: 'set_label_position', id: 'd', position: 'top' }, /below, above/)
  fails({ op: 'set_label_position', id: 'lane', position: 'below' }, /top, left/)
  fails(
    { op: 'set_label_position', id: 'd', position: 'left', offset: { x: 1, y: 1 } },
    /only goes with position "free"/
  )
  const made = run(
    start(),
    { op: 'add_container', id: 'c', label: 'C', x: 0, y: 0, labelPosition: 'right' },
    { op: 'add_behaviour', id: 'g', kind: 'event-end', x: 0, y: 0, labelPosition: 'above' }
  ).diagram
  assert.equal(made.nodes[0].data.labelPosition, 'right')
  assert.equal(made.nodes[1].data.labelPosition, 'above')
})

test('inspect says the kind and label position of an element and the route of an edge that crosses a container', () => {
  const { diagram } = run(
    start(),
    { op: 'add_container', id: 'sales', label: 'Sales', x: 0, y: 0, width: 300, height: 200 },
    { op: 'add_container', id: 'fin', label: 'Finance', x: 400, y: 0, width: 300, height: 200 },
    { op: 'add_behaviour', id: 'a', x: 20, y: 60, parent: 'sales' },
    {
      op: 'add_behaviour',
      id: 'b',
      kind: 'event-end',
      x: 500,
      y: 60,
      parent: 'fin',
      labelPosition: 'above'
    },
    { op: 'add_behaviour', id: 'c', x: 200, y: 400 },
    { op: 'connect', id: 'e1', from: 'a', to: 'b' },
    { op: 'connect', id: 'e2', from: 'a', to: 'c' }
  )
  const described = describeDiagram(diagram)
  const node = (id) => described.nodes.find((n) => n.id === id)
  const edge = (id) => described.edges.find((e) => e.id === id)
  assert.equal(node('b').kind, 'event-end')
  assert.equal(node('b').labelPosition, 'above')
  assert.equal(node('a').labelPosition, undefined)
  assert.equal(edge('e1').crossing, 'Sales → Finance')
  assert.equal(edge('e2').crossing, 'Sales → outside')
  const inside = run(
    diagram,
    { op: 'add_behaviour', id: 'a2', x: 150, y: 60, parent: 'sales' },
    { op: 'connect', id: 'e3', from: 'a', to: 'a2' }
  ).diagram
  assert.equal(describeDiagram(inside).edges.find((e) => e.id === 'e3').crossing, undefined)
})
