import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateFile } from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'

let dir
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-validate-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function check(nodes, edges, extra = {}) {
  const file = join(dir, 'd.chd')
  await writeFile(file, JSON.stringify({ version: 1, nodes, edges, ...extra }))
  return validateFile(file)
}

const node = (id, extra = {}) => ({ id, type: 'entity', position: { x: 0, y: 0 }, ...extra })
const edge = (extra) => ({ id: 'e', source: 'a', target: 'b', ...extra })

test('a plain side name is a valid handle on a node with no stored points', async () => {
  const { errors } = await check(
    [node('a'), node('b')],
    [edge({ sourceHandle: 'right', targetHandle: 'left' })]
  )
  assert.deepEqual(errors, [])
})

test('a handle that is not a side name is an error on a node with no stored points', async () => {
  const { errors } = await check([node('a'), node('b')], [edge({ sourceHandle: 'cp-9' })])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /sourceHandle='cp-9'.*node 'a'.*will not be drawn/)
})

test('a stored point id is a valid handle', async () => {
  const a = node('a', {
    connectionPoints: [{ id: 'cp-1', side: 'right', offset: 0.3 }]
  })
  const { errors } = await check(
    [a, node('b')],
    [edge({ sourceHandle: 'cp-1', targetHandle: 'top' })]
  )
  assert.deepEqual(errors, [])
})

test('the side name stops being valid once the side has stored points', async () => {
  const a = node('a', {
    connectionPoints: [{ id: 'cp-1', side: 'right', offset: 0.3 }]
  })
  const { errors } = await check([a, node('b')], [edge({ sourceHandle: 'right' })])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /sourceHandle='right'/)
  // Sides without stored points keep their implicit point.
  const ok = await check([a, node('b')], [edge({ sourceHandle: 'left' })])
  assert.deepEqual(ok.errors, [])
})

test('a handle on a missing node is left to the endpoint check', async () => {
  const { errors } = await check([node('a')], [edge({ targetHandle: 'whatever' })])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /target='b'/)
})

test("direction-set handles are checked against that set's nodes", async () => {
  const { errors } = await check(
    [node('a'), node('b')],
    [
      edge({
        sourceHandle: 'right',
        targetHandle: 'left',
        directionSets: {
          s1: { source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
          s2: { source: 'b', target: 'a', sourceHandle: 'left', targetHandle: 'bogus' }
        }
      })
    ]
  )
  assert.equal(errors.length, 1)
  assert.match(errors[0], /directionSets\.s2\.targetHandle='bogus'.*node 'a'/)
})

test('nodes that have no connection points are not checked', async () => {
  const { errors } = await check(
    [node('a'), { id: 'b', type: 'text', position: { x: 0, y: 0 } }],
    [edge({ targetHandle: 'anything' })]
  )
  assert.deepEqual(errors, [])
})

test('the legacy node type shape is one warning for all of them', async () => {
  const shapes = Array.from({ length: 8 }, (_, i) => node(`s${i}`, { type: 'shape' }))
  const { errors, warnings } = await check(shapes, [])
  assert.deepEqual(errors, [])
  const legacy = warnings.filter((w) => w.includes("type 'shape'"))
  assert.equal(legacy.length, 1)
  assert.match(legacy[0], /8 node\(s\).*and 3 more.*write type 'entity'/)
})

test('a shape node still has its connection points checked', async () => {
  const { errors } = await check(
    [node('a', { type: 'shape' }), node('b')],
    [edge({ sourceHandle: 'nope' })]
  )
  assert.equal(errors.length, 1)
})

test('entity nodes raise no legacy warning', async () => {
  const { warnings } = await check([node('a'), node('b')], [])
  assert.deepEqual(warnings, [])
})

test('data.details is a legacy-name warning, once for all nodes', async () => {
  const { errors, warnings } = await check(
    [
      node('a', { data: { details: 'notes/a.md' } }),
      node('b', { data: { details: 'notes/b.md' } })
    ],
    []
  )
  assert.deepEqual(errors, [])
  const legacy = warnings.filter((w) => w.includes('legacy data.details'))
  assert.equal(legacy.length, 1)
  assert.match(legacy[0], /2 node\(s\).*write data\.notes/)
})

test('a legend kind shape and the old security id lists are legacy-name warnings', async () => {
  const file = join(dir, 'd.chd')
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      nodes: [node('a')],
      edges: [],
      legend: [{ id: 'l1', kind: 'shape', label: 'x' }],
      security: { threats: [], matrixShapeIds: ['a'], hiddenShapeIds: [] }
    })
  )
  const { warnings } = validateFile(file)
  assert.ok(warnings.some((w) => /legend entry.*legacy kind 'shape'.*write kind 'entity'/.test(w)))
  assert.ok(
    warnings.some((w) => /legacy matrixShapeIds \/ hiddenShapeIds.*write matrixEntityIds/.test(w))
  )
})

// --- an edge label wider than the gap it sits in (layout guide, "Elements joined by an edge")

const sized = (id, x, y, extra = {}) =>
  node(id, { position: { x, y }, size: { width: 100, height: 60 }, ...extra })
const labelWarnings = (warnings) => warnings.filter((w) => /label needs/.test(w))

test('a label wider than the gap between its elements is a warning, never an error', async () => {
  // "reads from" needs a chip of about 74px; the gap is 23px.
  const { errors, warnings } = await check(
    [sized('a', 0, 0), sized('b', 123, 0)],
    [edge({ label: 'reads from' })]
  )
  assert.deepEqual(errors, [])
  const found = labelWarnings(warnings)
  assert.equal(found.length, 1)
  assert.match(found[0], /edge 'e' \("reads from"\) has 23px between 'a' and 'b'.*about 74px/)
})

test('a label that fits in the gap raises nothing', async () => {
  const { warnings } = await check(
    [sized('a', 0, 0), sized('b', 200, 0)],
    [edge({ label: 'reads from' })]
  )
  assert.deepEqual(labelWarnings(warnings), [])
})

test('a vertical edge needs the height of the label, not its width', async () => {
  const long = 'a label that is far wider than the gap but only one line high'
  const roomy = await check([sized('a', 0, 0), sized('b', 0, 90)], [edge({ label: long })])
  assert.deepEqual(labelWarnings(roomy.warnings), [], '30px of height holds a one-line chip')
  const tight = await check([sized('a', 0, 0), sized('b', 0, 70)], [edge({ label: long })])
  assert.equal(labelWarnings(tight.warnings).length, 1)
  assert.match(labelWarnings(tight.warnings)[0], /has 10px.*about 24px/)
})

test('no label, bend points, a moved label, overlap and a text-size change are handled', async () => {
  const narrow = [sized('a', 0, 0), sized('b', 110, 0)]
  const none = async (extra) => labelWarnings((await check(narrow, [edge(extra)])).warnings)
  assert.deepEqual(await none({}), [], 'an edge with no label')
  assert.deepEqual(await none({ label: 'reads from', points: [{ x: 50, y: 30 }] }), [])
  assert.deepEqual(await none({ label: 'reads from', style: { labelPosition: 0.2 } }), [])
  assert.equal((await none({ label: 'reads from' })).length, 1)
  // A smaller font makes a smaller chip: 10 characters at 6px is 41px, which fits in 10px? No.
  assert.equal((await none({ label: 'reads from', style: { fontSize: 6 } })).length, 1)
  const overlapping = await check([sized('a', 0, 0), sized('b', 50, 0)], [edge({ label: 'x' })])
  assert.deepEqual(
    labelWarnings(overlapping.warnings),
    [],
    'overlapping elements are another problem'
  )
})

test("the label's font sets its width: the edge's own, else the diagram's", async () => {
  // "reads from" needs about 74px in the default font, 78px in bold and 89px in monospace.
  const nodes = [sized('a', 0, 0), sized('b', 176, 0)] // 76px of gap
  const warn = async (style, diagram) =>
    labelWarnings((await check(nodes, [edge({ label: 'reads from', style })], diagram)).warnings)
  assert.deepEqual(await warn(undefined, {}), [])
  assert.equal((await warn({ fontWeight: 'bold' }, {})).length, 1)
  assert.equal((await warn({ fontFamily: 'monospace' }, {})).length, 1)
  assert.equal((await warn(undefined, { fontFamily: 'monospace' })).length, 1, 'the diagram font')
  assert.deepEqual(
    await warn({ fontFamily: 'sans-serif' }, { fontFamily: 'monospace' }),
    [],
    "the edge's own font wins"
  )
})

test('a vertical label is as high as its lines', async () => {
  const gap = (px) => [sized('a', 0, 0), sized('b', 0, 60 + px)]
  const three = (px) => check(gap(px), [edge({ label: 'one\ntwo\nthree' })])
  // Three lines at 12px: 3 x 19.2px of text + 3.8px = 62px.
  assert.equal(labelWarnings((await three(61)).warnings).length, 1)
  assert.match(labelWarnings((await three(61)).warnings)[0], /about 62px/)
  assert.deepEqual(labelWarnings((await three(62)).warnings), [])
  const big = await check(gap(40), [edge({ label: 'x', style: { fontSize: 24 } })])
  assert.match(labelWarnings(big.warnings)[0], /about 43px/)
})

test('positions inside a container are added up, and an edge to its own container is ignored', async () => {
  // b sits at x 130 on the canvas (container at 130, b at 0 inside it), 30px from a.
  const container = sized('c', 130, 0, { type: 'container', size: { width: 300, height: 200 } })
  const inside = sized('b', 0, 0, { parentId: 'c' })
  const { warnings } = await check(
    [sized('a', 0, 0), container, inside],
    [edge({ label: 'reads from' }), edge({ id: 'own', source: 'b', target: 'c', label: 'is in' })]
  )
  const found = labelWarnings(warnings)
  assert.equal(found.length, 1)
  assert.match(found[0], /edge 'e'.*has 30px/)
})

test('at most five label warnings are listed, then a count', async () => {
  const nodes = []
  const edges = []
  for (let i = 0; i < 7; i += 1) {
    nodes.push(sized(`s${i}`, 0, 100 * i), sized(`t${i}`, 110, 100 * i))
    edges.push(edge({ id: `e${i}`, source: `s${i}`, target: `t${i}`, label: 'reads from' }))
  }
  const { warnings } = await check(nodes, edges)
  const found = warnings.filter((w) => /label/.test(w))
  assert.equal(found.length, 6)
  assert.match(found[5], /2 more edge label\(s\)/)
})

test('an edge that leaves by the far side loops round, so its label is not in the gap', async () => {
  const narrow = [sized('a', 0, 0), sized('b', 123, 0)]
  const warn = async (extra) =>
    labelWarnings((await check(narrow, [edge({ label: 'reads from', ...extra })])).warnings)
  assert.equal((await warn({ sourceHandle: 'right', targetHandle: 'left' })).length, 1)
  assert.equal((await warn({ sourceHandle: 'left', targetHandle: 'right' })).length, 0)
  assert.equal((await warn({ sourceHandle: 'right', targetHandle: 'right' })).length, 0)
  // The edge may run from the right-hand element to the left-hand one.
  const reverse = edge({ source: 'b', target: 'a', label: 'reads from' })
  const same = await check(narrow, [{ ...reverse, sourceHandle: 'left', targetHandle: 'right' }])
  assert.equal(labelWarnings(same.warnings).length, 1)
  const wrong = await check(narrow, [{ ...reverse, sourceHandle: 'right', targetHandle: 'left' }])
  assert.equal(labelWarnings(wrong.warnings).length, 0)
})
