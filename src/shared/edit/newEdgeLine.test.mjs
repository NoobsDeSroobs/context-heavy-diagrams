// The operations that set and use the line new edges are drawn with. Every result must be
// a file the app reads back unchanged and the validator accepts.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import { createEmptyDiagram, parseDiagram, serializeDiagram } from '../diagram/index.ts'
import { OPERATIONS_HELP } from './help.ts'
import { applyOperations, OPERATION_NAMES, OperationError } from './operations.ts'
import { applyNamed } from './testNames.mjs'

let counter = 0
const options = { newId: (prefix) => `${prefix}-${(counter += 1)}` }
const run = (diagram, ...ops) => applyNamed(applyOperations, diagram, ops, options)

function check(diagram, raw = false) {
  const dir = mkdtempSync(join(tmpdir(), 'chd-newline-'))
  try {
    const file = join(dir, 'd.chd')
    if (raw) {
      writeFileSync(file, JSON.stringify(diagram))
    } else {
      const text = serializeDiagram(diagram)
      assert.deepEqual(serializeDiagram(parseDiagram(text)), text, 'round-trips through the app')
      writeFileSync(file, text)
    }
    return validateFile(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const refused = (diagram, op, pattern) =>
  assert.throws(
    () => run(diagram, op),
    (error) => error instanceof OperationError && pattern.test(error.message)
  )

const base = () =>
  run(
    createEmptyDiagram(),
    { op: 'add_entity', as: '$a', label: 'A', x: 0, y: 0 },
    { op: 'add_entity', as: '$b', label: 'B', x: 300, y: 0 },
    {
      op: 'add_legend_entry',
      as: '$data',
      kind: 'line',
      label: 'Data flow',
      color: '#4a90d9',
      lineStyle: 'solid',
      endMarker: 'arrowClosed'
    },
    {
      op: 'add_legend_entry',
      as: '$event',
      kind: 'line',
      label: 'Event',
      lineStyle: 'dashed',
      strokeWidth: 4
    },
    { op: 'add_legend_entry', as: '$dot', kind: 'entity', label: 'GDPR', color: '#e6194b' }
  ).diagram

test('the operation is known and described in the help', () => {
  assert.ok(OPERATION_NAMES.includes('set_new_edge_line'))
  assert.ok(OPERATIONS_HELP.includes('set_new_edge_line'))
})

test('a line is marked, only one at a time, and null takes the mark away', () => {
  const marked = run(base(), { op: 'set_new_edge_line', id: 'data' }).diagram
  assert.deepEqual(
    marked.legend.map((e) => e.forNewEdges === true),
    [true, false, false]
  )
  const moved = run(marked, { op: 'set_new_edge_line', id: 'event' }).diagram
  assert.deepEqual(
    moved.legend.map((e) => e.forNewEdges === true),
    [false, true, false]
  )
  const none = run(moved, { op: 'set_new_edge_line', id: null }).diagram
  assert.equal(
    none.legend.some((e) => 'forNewEdges' in e),
    false
  )
  assert.deepEqual(check(moved).errors, [])
  assert.deepEqual(check(moved).warnings, [])
})

test('only a line entry can be the look of new edges, and it must exist', () => {
  refused(base(), { op: 'set_new_edge_line', id: 'dot' }, /only a "line" entry/)
  refused(base(), { op: 'set_new_edge_line', id: 'nope' }, /is not a legend entry/)
})

test('connect without a style takes the marked line, and a style of its own wins', () => {
  const { diagram } = run(
    base(),
    { op: 'set_new_edge_line', id: 'data' },
    { op: 'connect', as: '$plain', from: 'a', to: 'b' },
    { op: 'connect', as: '$own', from: 'a', to: 'b', style: { stroke: '#ff0000' } }
  )
  const byId = Object.fromEntries(diagram.edges.map((e) => [e.id, e.style]))
  assert.deepEqual(byId.plain, {
    stroke: '#4a90d9',
    lineStyle: 'solid',
    endMarker: 'arrowClosed'
  })
  assert.deepEqual(byId.own, { stroke: '#ff0000' })
})

test('the thickness of the legend line is kept by the file and given to new edges', () => {
  const { diagram } = run(
    base(),
    { op: 'set_new_edge_line', id: 'event' },
    { op: 'connect', as: '$thick', from: 'a', to: 'b' }
  )
  assert.equal(diagram.legend.find((e) => e.id === 'event').strokeWidth, 4)
  assert.deepEqual(diagram.edges[0].style, { strokeWidth: 4, lineStyle: 'dashed' })
  assert.deepEqual(check(diagram).errors, [])
  refused(
    base(),
    { op: 'add_legend_entry', kind: 'entity', label: 'X', color: '#000', strokeWidth: 3 },
    /only apply to a legend entry of kind "line"/
  )
  // and it can be changed and taken away
  const changed = run(base(), { op: 'set_legend_entry', id: 'event', strokeWidth: 2 }).diagram
  assert.equal(changed.legend.find((e) => e.id === 'event').strokeWidth, 2)
  const removed = run(changed, { op: 'set_legend_entry', id: 'event', strokeWidth: null }).diagram
  assert.equal('strokeWidth' in removed.legend.find((e) => e.id === 'event'), false)
})

test('the routing of the legend line is kept by the file and given to new edges', () => {
  const { diagram } = run(
    base(),
    { op: 'set_legend_entry', id: 'event', routingStyle: 'step' },
    { op: 'set_new_edge_line', id: 'event' },
    { op: 'connect', as: '$routed', from: 'a', to: 'b' }
  )
  assert.equal(diagram.legend.find((e) => e.id === 'event').routingStyle, 'step')
  assert.equal(diagram.edges[0].style.routingStyle, 'step')
  assert.deepEqual(check(diagram).errors, [])
  refused(base(), { op: 'set_legend_entry', id: 'event', routingStyle: 'zigzag' }, /routingStyle/)
})

test('with no marked line, connect leaves the edge unstyled as before', () => {
  const { diagram } = run(base(), { op: 'connect', as: '$plain', from: 'a', to: 'b' })
  assert.equal(diagram.edges[0].style, undefined)
})

test('the validator warns about a mark on an entity entry and about two marks', () => {
  const wrong = base()
  wrong.legend = wrong.legend.map((e) => (e.id === 'dot' ? { ...e, forNewEdges: true } : e))
  assert.ok(
    check(wrong, true).warnings.some((w) => /marked for new edges but is not a line/.test(w))
  )
  const twice = base()
  twice.legend = twice.legend.map((e) => (e.kind === 'line' ? { ...e, forNewEdges: true } : e))
  assert.ok(check(twice, true).warnings.some((w) => /more than one legend line/.test(w)))
})
