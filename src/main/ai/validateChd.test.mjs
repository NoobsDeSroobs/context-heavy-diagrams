import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DECISION_KINDS,
  validateFile,
  validateText,
  WAIT_FOR_ALL_KINDS,
  WAIT_FOR_FIRST_KINDS
} from '../../../resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs'
import { STENCIL_KINDS } from '../../shared/stencils/kinds.ts'

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
  // "reads from" needs about 98px (a 74px chip and 12px of arrowhead either side); the gap is 23px.
  const { errors, warnings } = await check(
    [sized('a', 0, 0), sized('b', 123, 0)],
    [edge({ label: 'reads from' })]
  )
  assert.deepEqual(errors, [])
  const found = labelWarnings(warnings)
  assert.equal(found.length, 1)
  assert.match(found[0], /edge 'e' \("reads from"\) has 23px between 'a' and 'b'.*about 98px/)
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
  const roomy = await check([sized('a', 0, 0), sized('b', 0, 110)], [edge({ label: long })])
  assert.deepEqual(labelWarnings(roomy.warnings), [], '50px of height holds a one-line chip')
  const tight = await check([sized('a', 0, 0), sized('b', 0, 70)], [edge({ label: long })])
  assert.equal(labelWarnings(tight.warnings).length, 1)
  assert.match(labelWarnings(tight.warnings)[0], /has 10px.*about 48px/)
})

test('no label, bend points, a moved label, overlap and a text-size change are handled', async () => {
  const narrow = [sized('a', 0, 0), sized('b', 110, 0)]
  const none = async (extra) => labelWarnings((await check(narrow, [edge(extra)])).warnings)
  assert.deepEqual(await none({}), [], 'an edge with no label')
  assert.deepEqual(await none({ label: 'reads from', points: [{ x: 50, y: 30 }] }), [])
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
  // "reads from" needs about 98px in the default font, 102px in bold and 113px in monospace.
  const nodes = [sized('a', 0, 0), sized('b', 200, 0)] // 100px of gap
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
  // Three lines at 12px: 3 x 19.2px of text + 4px of chip + 24px of line = 86px.
  assert.equal(labelWarnings((await three(85)).warnings).length, 1)
  assert.match(labelWarnings((await three(85)).warnings)[0], /about 86px/)
  assert.deepEqual(labelWarnings((await three(86)).warnings), [])
  const big = await check(gap(40), [edge({ label: 'x', style: { fontSize: 24 } })])
  assert.match(labelWarnings(big.warnings)[0], /about 67px/)
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

test('a diagram given as text gets every structural check, named as given', () => {
  const text = JSON.stringify({
    version: 1,
    nodes: [node('a'), node('a')],
    edges: [edge({ target: 'zzz' })]
  })
  const { errors } = validateText(text, '(inline)')
  assert.equal(errors.length, 2)
  const all = errors.join(' | ')
  assert.ok(
    errors.every((e) => e.startsWith('[(inline)] ')),
    all
  )
  assert.match(all, /duplicate node id 'a'/)
  assert.match(all, /doesn't match any node id/)
  assert.match(validateText('{ nope', '(inline)').errors[0], /invalid JSON/)
})

test('text has no folder: a path to a missing file is not looked for, and the result says so', async () => {
  const ref = { notes: 'notes/missing.md', linkedDiagram: 'gone.chd', references: ['no.png'] }
  const diagram = { version: 1, nodes: [node('a', { data: ref })], edges: [] }
  const asText = validateText(JSON.stringify(diagram))
  assert.deepEqual(asText.errors, [])
  assert.deepEqual(asText.warnings, [])
  assert.equal(asText.notes.length, 1)
  assert.match(asText.notes[0], /not checked/)
  // The same diagram as a file in a folder does warn, so nothing else differs.
  const file = join(dir, 'd.chd')
  await writeFile(file, JSON.stringify(diagram))
  assert.equal(validateFile(file).warnings.length, 3)
  assert.equal(validateFile(file).notes, undefined)
})

test('an installed icon needs a pack name and a path of a subset folder and an .svg file', async () => {
  const icon = (pack, path) => ({ icons: { topLeft: { source: 'installed', pack, path } } })
  const good = await check([node('a', { data: icon('AWS', 'Compute/EC2.svg') })], [])
  assert.deepEqual(good.warnings, [])
  assert.deepEqual(good.errors, [])
  for (const [pack, path] of [
    ['AWS', '../EC2.svg'],
    ['AWS', 'EC2.svg'],
    ['AWS', 'a/b/c.svg'],
    ['AWS', 'Compute\\EC2.svg'],
    ['AWS', 'Compute/EC2.png'],
    ['AWS', 'Compute/.svg'],
    ['AWS', 'Compute/CON.svg'],
    ['AWS', 'Compute/EC2.svg '],
    ['AWS', '/Compute/EC2.svg'],
    ['', 'Compute/EC2.svg']
  ]) {
    const { warnings, errors } = await check([node('a', { data: icon(pack, path) })], [])
    assert.deepEqual(errors, [])
    assert.equal(warnings.length, 1, JSON.stringify([pack, path]))
    assert.match(warnings[0], /icons\.topLeft.*the icon is not drawn/)
  }
})

test('an installed icon is checked in a diagram given as text, and in the legend', () => {
  const text = JSON.stringify({
    version: 1,
    nodes: [],
    edges: [],
    legend: [
      {
        id: 'l1',
        kind: 'icon',
        label: 'x',
        icon: { source: 'installed', pack: 'AWS', path: '../x.svg' }
      }
    ]
  })
  const { warnings } = validateText(text)
  assert.ok(warnings.some((w) => /legend entry 'l1' icon.*not drawn/.test(w)))
})

test('visibility sets: a sound catalogue and membership pass without a word', async () => {
  const { errors, warnings } = await check(
    [node('a', { visibilitySetIds: ['s1'] }), node('b')],
    [edge({ visibilitySetIds: ['s1'] })],
    { visibilitySets: [{ id: 's1', name: 'Today' }] }
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
})

test('visibility sets: a malformed catalogue or membership is an error', async () => {
  const bad = await check([node('a', { visibilitySetIds: 'today' }), node('b')], [], {
    visibilitySets: [{ id: 's1', name: ' ' }, { name: 'No id' }, { id: 's1', name: 'Twice' }]
  })
  assert.ok(bad.errors.some((e) => /needs a name/.test(e)))
  assert.ok(bad.errors.some((e) => /has no id/.test(e)))
  assert.ok(bad.errors.some((e) => /visibilitySetIds must be a list/.test(e)))
  const notAList = await check([node('a'), node('b')], [], { visibilitySets: {} })
  assert.ok(notAList.errors.some((e) => /visibilitySets must be a list/.test(e)))
})

test('visibility sets: two names alike, and ids with no set, are warnings, not errors', async () => {
  const { errors, warnings } = await check(
    [node('a', { visibilitySetIds: ['gone'] }), node('b')],
    [],
    {
      visibilitySets: [
        { id: 's1', name: 'Today' },
        { id: 's2', name: 'TODAY' }
      ]
    }
  )
  assert.deepEqual(errors, [])
  assert.ok(warnings.some((w) => /two visibility sets are named/.test(w)))
  assert.ok(warnings.some((w) => /not in visibilitySets.*gone/.test(w)))
})

// A flow of behaviours: `gate` makes a gateway of the kind, `link` joins ids by edges.
const stencil = (id, kind, label) =>
  node(id, { type: 'stencil', data: { kind, label: label ?? id } })
const flow = (nodes, links) =>
  check(
    nodes,
    links.map(([source, target], i) => ({ id: `e${i}`, source, target }))
  )
const joinWarnings = (warnings) => warnings.filter((w) => /waits for every arrow/.test(w))

test('every gateway kind of the app is classified as a decision, a wait for all or a wait for first', () => {
  const known = new Set([...DECISION_KINDS, ...WAIT_FOR_ALL_KINDS, ...WAIT_FOR_FIRST_KINDS])
  for (const kind of STENCIL_KINDS) {
    if (kind.id.startsWith('branch-')) assert.ok(known.has(kind.id), kind.id)
  }
  for (const id of known)
    assert.ok(
      STENCIL_KINDS.some((k) => k.id === id),
      id
    )
})

test('two ways of one decision meeting at a wait for all are a warning', async () => {
  // Yes goes straight to the join; No goes through two parallel steps that a wait for first gathers.
  const { errors, warnings } = await flow(
    [
      stencil('d', 'branch-exclusive', 'Can finance alone?'),
      stencil('j', 'branch-all'),
      stencil('s', 'branch-parallel'),
      stencil('x', 'step'),
      stencil('y', 'step'),
      stencil('w', 'branch-one')
    ],
    [
      ['d', 'j'],
      ['d', 's'],
      ['s', 'x'],
      ['s', 'y'],
      ['x', 'w'],
      ['y', 'w'],
      ['w', 'j']
    ]
  )
  assert.deepEqual(errors, [])
  const found = joinWarnings(warnings)
  assert.equal(found.length, 1)
  assert.match(found[0], /'j'.*decision 'd' \("Can finance alone\?"\)/)
})

test('a decision closed by a decision symbol before the join is fine', async () => {
  const { warnings } = await flow(
    [
      stencil('d', 'branch-exclusive'),
      stencil('a', 'step'),
      stencil('b', 'step'),
      stencil('m', 'branch-exclusive'),
      stencil('j', 'branch-parallel'),
      stencil('other', 'step')
    ],
    [
      ['d', 'a'],
      ['d', 'b'],
      ['a', 'm'],
      ['b', 'm'],
      ['m', 'j'],
      ['other', 'j']
    ]
  )
  assert.deepEqual(joinWarnings(warnings), [])
})

test('a wait for first, or a plain step taking two arrows, also gathers the ways of a decision', async () => {
  for (const gatherer of [stencil('m', 'branch-one'), stencil('m', 'step')]) {
    const { warnings } = await flow(
      [
        stencil('d', 'branch-inclusive'),
        stencil('a', 'step'),
        stencil('b', 'step'),
        gatherer,
        stencil('j', 'branch-all'),
        stencil('other', 'step')
      ],
      [
        ['d', 'a'],
        ['d', 'b'],
        ['a', 'm'],
        ['b', 'm'],
        ['m', 'j'],
        ['other', 'j']
      ]
    )
    assert.deepEqual(joinWarnings(warnings), [], gatherer.data.kind)
  }
})

test('a decision into a wait for first, a parallel split into a wait for all and a loop are fine', async () => {
  const { warnings } = await flow(
    [
      stencil('d', 'branch-exclusive'),
      stencil('a', 'step'),
      stencil('b', 'step'),
      stencil('first', 'branch-one'),
      stencil('p', 'branch-parallel'),
      stencil('x', 'step'),
      stencil('y', 'step'),
      stencil('all', 'branch-all')
    ],
    [
      ['d', 'a'],
      ['d', 'b'],
      ['a', 'first'],
      ['b', 'first'],
      ['first', 'p'],
      ['p', 'x'],
      ['p', 'y'],
      ['x', 'all'],
      ['y', 'all'],
      ['all', 'd']
    ]
  )
  assert.deepEqual(joinWarnings(warnings), [])
})

test('a Run in parallel with one arrow in is a split, not a join', async () => {
  const { warnings } = await flow(
    [
      stencil('d', 'branch-exclusive'),
      stencil('a', 'branch-parallel'),
      stencil('b', 'step'),
      stencil('x', 'step')
    ],
    [
      ['d', 'a'],
      ['d', 'b'],
      ['a', 'x'],
      ['b', 'x']
    ]
  )
  assert.deepEqual(joinWarnings(warnings), [])
})
