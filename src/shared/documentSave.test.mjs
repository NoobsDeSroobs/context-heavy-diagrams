// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adoptDisk,
  anyNoteDirty,
  dirtyBaselines,
  dirtyDrafts,
  editNote,
  loadedNoteShadow,
  markSaved,
  newNoteShadow,
  planSave,
  recoveredNoteShadow,
  resolveConflicts,
  restoredNoteShadow
} from './documentSave.ts'

const note = (over = {}) => ({
  nodeId: 'entity-1',
  desiredPath: 'd/details/A-1.md',
  nodeDetailsPath: 'd/details/A-1.md',
  shadow: undefined,
  ...over
})
const plan = (notes, over = {}) => planSave({ hubDirty: false, newLocation: false, notes, ...over })

// --- shadow model ---------------------------------------------------------

test('editNote: dirty exactly when content differs from the baseline', () => {
  const s = loadedNoteShadow('n', 'p.md', 's1', 'hello')
  assert.equal(s.dirty, false)
  const edited = editNote(s, 'hello!')
  assert.equal(edited.dirty, true)
  // typing it back is clean again
  assert.equal(editNote(edited, 'hello').dirty, false)
})

test('newNoteShadow opened but untouched is not dirty; typing then erasing is not dirty', () => {
  const s = newNoteShadow('n')
  assert.equal(s.dirty, false)
  assert.equal(editNote(editNote(s, 'x'), '').dirty, false)
})

test('adoptDisk replaces baseline and content and clears dirty', () => {
  const s = editNote(loadedNoteShadow('n', 'p.md', 's1', 'a'), 'mine')
  const r = adoptDisk(s, 'theirs', 's2')
  assert.deepEqual(
    [r.content, r.baselineContent, r.baselineStamp, r.dirty],
    ['theirs', 'theirs', 's2', false]
  )
})

test('markSaved: keeps text typed while the save was in flight dirty', () => {
  const s = editNote(loadedNoteShadow('n', 'p.md', 's1', 'a'), 'b')
  const typedMore = editNote(s, 'bc')
  const r = markSaved(typedMore, 'q.md', 's2', 'b')
  assert.equal(r.originalPath, 'q.md')
  assert.equal(r.baselineContent, 'b')
  assert.equal(r.dirty, true)
  assert.equal(markSaved(s, 'q.md', 's2', 'b').dirty, false)
})

test('anyNoteDirty / dirtyDrafts only see notes with unsaved edits', () => {
  const clean = loadedNoteShadow('c', 'c.md', 's', 'x')
  const dirty = editNote(loadedNoteShadow('d', 'd.md', 's', 'x'), 'y')
  const map = { c: clean, d: dirty }
  assert.equal(anyNoteDirty(map), true)
  assert.equal(anyNoteDirty({ c: clean }), false)
  assert.deepEqual(dirtyDrafts(map), { d: 'y' })
})

test('recoveredNoteShadow is dirty with no baseline to conflict-check', () => {
  const r = recoveredNoteShadow('n', 'p.md', 'text')
  assert.equal(r.dirty, true)
  assert.equal(r.baselineStamp, null)
})

test('a snapshot round-trip keeps the baseline, so an outside edit is still detectable', () => {
  const dirty = editNote(loadedNoteShadow('n', 'd/details/A-1.md', 'stamp-7', 'orig'), 'mine')
  const clean = loadedNoteShadow('c', 'c.md', 's', 'x')
  const baselines = dirtyBaselines({ n: dirty, c: clean })
  assert.deepEqual(Object.keys(baselines), ['n'])
  const restored = restoredNoteShadow('n', dirtyDrafts({ n: dirty }).n, baselines.n)
  assert.equal(restored.content, 'mine')
  assert.equal(restored.dirty, true)
  assert.equal(restored.baselineStamp, 'stamp-7')
  assert.equal(restored.originalPath, 'd/details/A-1.md')
  // and planning from it checks against the recorded stamp
  const p = planSave({
    hubDirty: false,
    newLocation: false,
    notes: [{ nodeId: 'n', desiredPath: 'd/details/A-1.md', nodeDetailsPath: 'd/details/A-1.md', shadow: restored }]
  })
  assert.equal(p.ops[0].expectedStamp, 'stamp-7')
})

// --- planning -------------------------------------------------------------

test('nothing dirty, nothing moved: no ops and the hub is not rewritten', () => {
  const p = plan([note()])
  assert.deepEqual(p.ops, [])
  assert.equal(p.writeHub, false)
  assert.deepEqual(p.finalPaths, { 'entity-1': 'd/details/A-1.md' })
})

test('a dirty existing note is written in place; editing it alone does not dirty the hub', () => {
  const shadow = editNote(loadedNoteShadow('entity-1', 'd/details/A-1.md', 's1', 'a'), 'b')
  const p = plan([note({ shadow })])
  assert.deepEqual(p.ops, [
    {
      kind: 'write',
      nodeId: 'entity-1',
      from: 'd/details/A-1.md',
      to: 'd/details/A-1.md',
      content: 'b',
      expectedStamp: 's1'
    }
  ])
  assert.equal(p.writeHub, false)
})

test('a brand-new dirty note is created and the hub is rewritten to point at it', () => {
  const shadow = editNote(newNoteShadow('entity-1'), 'first words')
  const p = plan([note({ nodeDetailsPath: null, shadow })])
  assert.equal(p.ops.length, 1)
  assert.equal(p.ops[0].from, null)
  assert.equal(p.ops[0].expectedStamp, null)
  assert.equal(p.writeHub, true)
  assert.deepEqual(p.finalPaths, { 'entity-1': 'd/details/A-1.md' })
})

test('an unedited note whose label changed is moved, and the hub is rewritten', () => {
  const p = plan([note({ desiredPath: 'd/details/Renamed-1.md' })])
  assert.deepEqual(p.ops, [
    { kind: 'move', nodeId: 'entity-1', from: 'd/details/A-1.md', to: 'd/details/Renamed-1.md' }
  ])
  assert.equal(p.writeHub, true)
  assert.equal(p.finalPaths['entity-1'], 'd/details/Renamed-1.md')
})

test('a dirty note whose label changed is written to the new name; the old is its `from`', () => {
  const shadow = editNote(loadedNoteShadow('entity-1', 'd/details/A-1.md', 's1', 'a'), 'b')
  const p = plan([note({ desiredPath: 'd/details/Renamed-1.md', shadow })])
  assert.equal(p.ops[0].kind, 'write')
  assert.equal(p.ops[0].from, 'd/details/A-1.md')
  assert.equal(p.ops[0].to, 'd/details/Renamed-1.md')
  assert.equal(p.writeHub, true)
})

test('the shadow\'s original path wins over the diagram\'s (the real file is the identity)', () => {
  const shadow = loadedNoteShadow('entity-1', 'd/details/Actual-1.md', 's1', 'a')
  const p = plan([note({ nodeDetailsPath: 'd/details/A-1.md', shadow })])
  assert.equal(p.ops[0].from, 'd/details/Actual-1.md')
})

test('hub-only edits write the hub with no note ops', () => {
  const p = plan([note()], { hubDirty: true })
  assert.deepEqual(p.ops, [])
  assert.equal(p.writeHub, true)
})

test('Save As / first save: dirty notes go to the new location unchecked; others untouched', () => {
  const dirty = editNote(loadedNoteShadow('entity-1', 'old/details/A-1.md', 's1', 'a'), 'b')
  const p = plan(
    [
      note({ shadow: dirty, nodeDetailsPath: 'old/details/A-1.md' }),
      note({ nodeId: 'entity-2', nodeDetailsPath: 'old/details/B-2.md', desiredPath: 'new/details/B-2.md' })
    ],
    { newLocation: true, hubDirty: true }
  )
  assert.equal(p.ops.length, 1)
  assert.equal(p.ops[0].from, null)
  assert.equal(p.ops[0].expectedStamp, null)
  assert.equal(p.finalPaths['entity-2'], 'old/details/B-2.md')
})

test('many untouched notes produce no work at all', () => {
  const notes = Array.from({ length: 100 }, (_, i) =>
    note({ nodeId: `entity-${i}`, desiredPath: `d/${i}.md`, nodeDetailsPath: `d/${i}.md` })
  )
  const p = plan(notes)
  assert.equal(p.ops.length, 0)
  assert.equal(p.writeHub, false)
})

// --- resolving conflicts ----------------------------------------------------

const w = (nodeId, from, to) => ({ kind: 'write', nodeId, from, to, content: 'c', expectedStamp: 's' })
const mv = (nodeId, from, to) => ({ kind: 'move', nodeId, from, to })

test('resolve: keep mine for a note conflict just re-sends its write', () => {
  const op = w('n1', 'a.md', 'a.md')
  const r = resolveConflicts([op], { n1: 'mine' })
  assert.deepEqual(r.runOps, [op])
  assert.deepEqual(r.adoptDiskNodeIds, [])
  assert.equal(r.writeHub, false)
  assert.equal(r.reloadHub, false)
})

test('resolve: take disk for a note drops the write and adopts the file', () => {
  const r = resolveConflicts([w('n1', 'a.md', 'a.md')], { n1: 'disk' })
  assert.deepEqual(r.runOps, [])
  assert.deepEqual(r.adoptDiskNodeIds, ['n1'])
  assert.equal(r.writeHub, false)
})

test('resolve: take disk for a note that is also being renamed still moves the disk content', () => {
  const r = resolveConflicts([w('n1', 'old.md', 'new.md')], { n1: 'disk' })
  assert.deepEqual(r.runOps, [mv('n1', 'old.md', 'new.md')])
  assert.deepEqual(r.adoptDiskNodeIds, ['n1'])
  assert.equal(r.writeHub, true) // the diagram must now point at the new path
})

test('resolve: per-file choices are independent', () => {
  const r = resolveConflicts(
    [w('a', 'a.md', 'a.md'), w('b', 'b.md', 'b.md'), w('c', 'c.md', 'c.md')],
    { a: 'mine', b: 'disk', c: 'mine' }
  )
  assert.deepEqual(r.runOps.map((o) => o.nodeId), ['a', 'c'])
  assert.deepEqual(r.adoptDiskNodeIds, ['b'])
})

test('resolve: keep mine for the diagram also releases creates/renames held because of it', () => {
  const held = w('fresh', null, 'new.md')
  const r = resolveConflicts([held, mv('renamed', 'o.md', 'n.md')], { hub: 'mine' })
  assert.equal(r.runOps.length, 2)
  assert.equal(r.writeHub, true)
  assert.equal(r.reloadHub, false)
})

test('resolve: take disk for the diagram reloads it and keeps only safe in-place note writes', () => {
  const inPlaceMine = w('a', 'a.md', 'a.md')
  const renameMine = w('b', 'o.md', 'n.md')
  const heldByHub = w('fresh', null, 'new.md')
  const r = resolveConflicts([inPlaceMine, renameMine, heldByHub, mv('m', 'x.md', 'y.md')], {
    hub: 'disk',
    a: 'mine',
    b: 'mine'
  })
  assert.equal(r.reloadHub, true)
  assert.deepEqual(r.runOps, [inPlaceMine])
  assert.equal(r.writeHub, false)
})

test('resolve: with the diagram reloaded, a note taken from disk does not also get renamed', () => {
  const r = resolveConflicts([w('n1', 'old.md', 'new.md')], { hub: 'disk', n1: 'disk' })
  assert.deepEqual(r.runOps, [])
  assert.deepEqual(r.adoptDiskNodeIds, ['n1'])
  assert.equal(r.reloadHub, true)
})

test('resolve: only notes in conflict (no diagram conflict) never rewrite the diagram for in-place writes', () => {
  const r = resolveConflicts([w('n1', 'a.md', 'a.md')], { n1: 'mine' })
  assert.equal(r.writeHub, false)
})
