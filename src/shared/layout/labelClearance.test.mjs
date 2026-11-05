// The label-clearance check (ADR 0146) and the committed copy of it that the skill's script imports.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { bundleLabelClearance, LABEL_CLEARANCE_BUNDLE } from '../../../scripts/build-cli.mjs'
import { hiddenLabels, labelChipSize, labelNeededGap } from './labelClearance.ts'

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

test('the gap needed is the chip plus what the larger end graphic needs either side', () => {
  const needed = (label, font, horizontal, ends) => labelNeededGap(label, font, horizontal, ends)
  // The default edge: no graphic at the start, a closed arrow at the end (12px).
  assert.equal(needed('reads from', plain, true), 98)
  assert.equal(needed('reads from', { ...plain, weight: 'bold' }, true), 102)
  assert.equal(needed('one\ntwo\nthree', plain, false), 86)
  const both = (marker) =>
    needed('reads from', plain, true, { startMarker: marker, endMarker: marker })
  assert.equal(both('none'), 90)
  assert.equal(both('crowsFootOne'), 84)
  assert.equal(both('crowsFootZeroOrMany'), 110)
  assert.equal(both('not-a-marker'), 98, 'an unknown graphic counts as 12px')
})

test('a label slid towards one end needs 3px at the near side and its graphic at the far side', () => {
  const at = (position, ends) => labelNeededGap('reads from', plain, true, { position, ...ends })
  assert.equal(at(0.5), 98)
  assert.equal(at(0.52), 98, 'a nudge from the middle is still centred')
  // Towards the source: 3px + half the chip (36.7px) over 0.3 of the gap; the far side, 12px, needs less.
  assert.equal(at(0.3), 133)
  assert.equal(at(0.7), 133, 'towards the target, the near side is the target side')
  assert.equal(at(0.3, { endMarker: 'crowsFootZeroOrMany' }), 133, 'the far side is not the limit')
  assert.equal(at(0.44), 91, 'a little off the middle: the near side is the limit')
  assert.equal(
    at(0.44, { endMarker: 'crowsFootZeroOrMany' }),
    98,
    'with a big graphic the far side (18px) is'
  )
})

test('a label that does not fit in the gap is found, with the gap and what it needs', () => {
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
      needed: 98,
      horizontal: true
    }
  )
  assert.deepEqual(hiddenLabels([entity('a', 0, 0), entity('b', 200, 0)], [edge()]), [])
})

test("an edge label inherits the diagram's font unless the edge sets its own", () => {
  const nodes = [entity('a', 0, 0), entity('b', 200, 0)] // 100px: plain 98, bold 102, monospace 113
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
  assert.equal(found({ style: { labelPosition: 1.5 } }), 0, 'a label position off the edge')
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
