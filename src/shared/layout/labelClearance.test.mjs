// The label-clearance check (ADR 0146) and the committed copy of it that the skill's script imports.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { bundleLabelClearance, LABEL_CLEARANCE_BUNDLE } from '../../../scripts/build-cli.mjs'
import { hiddenLabels, labelChipSize } from './labelClearance.ts'

const plain = { size: 12, weight: 'normal' }
const entity = (id, x, y, extra = {}) => ({
  id,
  type: 'entity',
  position: { x, y },
  size: { width: 100, height: 60 },
  ...extra
})
const edge = (extra = {}) => ({ id: 'e', source: 'a', target: 'b', label: 'reads from', ...extra })

test('the chip is the text plus the chip padding, in the font of the label', () => {
  const width = (label, font = plain) => labelChipSize(label, font).width
  assert.ok(Math.abs(width('reads from') - 73.4) < 0.1)
  assert.ok(width('reads from', { ...plain, weight: 'bold' }) > width('reads from'))
  assert.ok(width('reads from', { ...plain, family: 'monospace' }) > width('reads from'))
  assert.ok(width('READS FROM') > width('reads from'), 'capitals are wider')
  assert.ok(width('読み取り元から') > width('reads from'), 'CJK characters are about a full em')
  assert.equal(width('x', { ...plain, size: 24 }) > width('x'), true)
  assert.equal(width(''), 8 + 14, 'an empty chip has the minimum text width')
})

test('the chip is as high as its lines, scaled by the font size', () => {
  const height = (label, font = plain) => labelChipSize(label, font).height
  assert.ok(Math.abs(height('one') - 23.2) < 0.01)
  assert.ok(Math.abs(height('one\ntwo\nthree') - 61.6) < 0.01)
  assert.ok(Math.abs(height('one', { ...plain, size: 24 }) - 42.4) < 0.01)
})

test('a label wider than the gap is found, with the gap and what it needs', () => {
  const nodes = [entity('a', 0, 0), entity('b', 123, 0)]
  const [hidden] = hiddenLabels(nodes, [edge()])
  assert.deepEqual(
    { ...hidden, gap: Math.round(hidden.gap) },
    {
      edgeId: 'e',
      label: 'reads from',
      sourceId: 'a',
      targetId: 'b',
      gap: 23,
      needed: 74,
      horizontal: true
    }
  )
  assert.deepEqual(hiddenLabels([entity('a', 0, 0), entity('b', 200, 0)], [edge()]), [])
})

test("an edge label inherits the diagram's font unless the edge sets its own", () => {
  const nodes = [entity('a', 0, 0), entity('b', 176, 0)] // 76px: plain 74, bold 78, monospace 89
  assert.equal(hiddenLabels(nodes, [edge()]).length, 0)
  assert.equal(hiddenLabels(nodes, [edge()], 'monospace').length, 1)
  assert.equal(
    hiddenLabels(nodes, [edge({ style: { fontFamily: 'serif' } })], 'monospace').length,
    0
  )
  assert.equal(hiddenLabels(nodes, [edge({ style: { fontWeight: 'bold' } })]).length, 1)
})

test('what cannot be judged is left out', () => {
  const nodes = [entity('a', 0, 0), entity('b', 123, 0)]
  const found = (extra) => hiddenLabels(nodes, [edge(extra)]).length
  assert.equal(found({ label: '  ' }), 0, 'a blank label')
  assert.equal(found({ points: [{ x: 1, y: 1 }] }), 0, 'bend points')
  assert.equal(found({ style: { labelPosition: 0.2 } }), 0, 'a moved label')
  assert.equal(found({ sourceHandle: 'left', targetHandle: 'right' }), 0, 'a looping edge')
  assert.equal(found({ sourceHandle: 'cp-1' }), 1, 'a connection point counts as facing')
  assert.equal(hiddenLabels([entity('a', 0, 0), entity('b', 50, 0)], [edge()]).length, 0, 'overlap')
  assert.equal(
    hiddenLabels([entity('a', 0, 0), entity('b', 123, 0, { type: 'line' })], [edge()]).length,
    0
  )
  assert.equal(hiddenLabels([{ id: 'a' }, { id: 'b' }], [edge()]).length, 0, 'no geometry')
})

test('positions inside a container add up, and an edge to its own container is ignored', () => {
  const nodes = [
    entity('a', 0, 0),
    entity('c', 130, 0, { type: 'container', size: { width: 300, height: 200 } }),
    entity('b', 0, 0, { parentId: 'c' })
  ]
  const found = hiddenLabels(nodes, [edge(), edge({ id: 'own', source: 'b', target: 'c' })])
  assert.deepEqual(
    found.map((hidden) => [hidden.edgeId, hidden.gap]),
    [['e', 30]]
  )
})

// The skill's script imports a generated copy of this file; it must be the current one.
test('the committed label_clearance.mjs is what the build makes of labelClearance.ts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chd-bundle-'))
  try {
    const fresh = join(dir, 'label_clearance.mjs')
    await bundleLabelClearance(fresh)
    const normalise = async (file) => (await readFile(file, 'utf-8')).replaceAll('\r\n', '\n')
    assert.equal(
      await normalise(LABEL_CLEARANCE_BUNDLE),
      await normalise(fresh),
      'run `npm run build:cli` and commit scripts/label_clearance.mjs'
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
