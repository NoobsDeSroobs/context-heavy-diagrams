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

async function check(nodes, edges) {
  const file = join(dir, 'd.chd')
  await writeFile(file, JSON.stringify({ version: 1, nodes, edges }))
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

test('entity nodes raise no shape warning', async () => {
  const { warnings } = await check([node('a'), node('b')], [])
  assert.deepEqual(warnings, [])
})
