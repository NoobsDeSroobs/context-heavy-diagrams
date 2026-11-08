// Run with `npm test`. Exercises the executor against a real temp directory.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeSave } from './documentSaveExec.ts'
import { containedPath } from '../containedPath.ts'

let dir
let diagram
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-save-'))
  diagram = join(dir, 'd.chd')
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const stamp = async (p) => {
  try {
    const s = await stat(p)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return null
  }
}
const deps = (over = {}) => ({ contain: containedPath, stamp, serializeHub: () => 'HUB', ...over })
const write = (nodeId, from, to, content, expectedStamp = null) => ({
  kind: 'write',
  nodeId,
  from,
  to,
  content,
  expectedStamp
})
const move = (nodeId, from, to) => ({ kind: 'move', nodeId, from, to })
const req = (over = {}) => ({
  diagramPath: diagram,
  writeHub: false,
  expectedHubStamp: null,
  ops: [],
  overwrite: false,
  ...over
})
const put = async (rel, content) => {
  await mkdir(join(dir, rel, '..'), { recursive: true })
  await writeFile(join(dir, rel), content)
}
const read = (rel) => readFile(join(dir, rel), 'utf-8')
const has = (rel) => existsSync(join(dir, rel))

// A note that was read (baseline recorded) and then changed outside the app.
const outsideEdited = async (rel) => {
  await put(rel, 'v1')
  const baseline = await stamp(join(dir, rel))
  await put(rel, 'changed outside the app')
  return baseline
}

test('nothing to do: nothing is written and the outcome is saved', async () => {
  const r = await executeSave(req(), deps())
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [])
  assert.equal(existsSync(diagram), false)
})

test('writes a new note (creating folders) and the hub, reporting fresh stamps', async () => {
  const r = await executeSave(
    req({ writeHub: true, ops: [write('n1', null, 'd/notes/A-1.md', 'hello')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/notes/A-1.md'), 'hello')
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.hubWritten, true)
  assert.equal(r.notes.n1.path, 'd/notes/A-1.md')
  assert.ok(r.notes.n1.stamp)
  assert.ok(r.hubStamp)
  assert.deepEqual(r.conflicts, [])
  assert.deepEqual(r.remaining, { hub: false, nodeIds: [] })
})

test('crash-safe order: when the hub is serialised both old and new note files exist', async () => {
  await put('d/notes/Old-1.md', 'body')
  let seen
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/notes/Old-1.md', 'd/notes/New-1.md')] }),
    deps({
      serializeHub: () => {
        seen = [has('d/notes/Old-1.md'), has('d/notes/New-1.md')]
        return 'HUB'
      }
    })
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(seen, [true, true])
  // old removed only afterwards
  assert.equal(has('d/notes/Old-1.md'), false)
  assert.equal(await read('d/notes/New-1.md'), 'body')
})

test('a dirty note whose label changed: new name written, old name removed', async () => {
  await put('d/notes/Old-1.md', 'old text')
  const r = await executeSave(
    req({ ops: [write('n1', 'd/notes/Old-1.md', 'd/notes/New-1.md', 'new text')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/notes/New-1.md'), 'new text')
  assert.equal(has('d/notes/Old-1.md'), false)
})

test('a move whose source is missing is skipped (reported), nothing deleted or created', async () => {
  let reverted
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/notes/Gone-1.md', 'd/notes/New-1.md')] }),
    deps({
      serializeHub: (ids) => {
        reverted = ids
        return 'HUB'
      }
    })
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.skippedMoves, ['n1'])
  assert.deepEqual(reverted, ['n1'])
  assert.equal(has('d/notes/New-1.md'), false)
  assert.equal(r.notes.n1, undefined)
})

// --- conflicts: save everything that doesn't conflict, hold the rest ---------

test('a conflicting note is held back; everything else — including the hub — still saves', async () => {
  const baseline = await outsideEdited('d/notes/A-1.md')
  await put('d/notes/Fine-2.md', 'untouched')

  const r = await executeSave(
    req({
      writeHub: true,
      ops: [
        write('n1', 'd/notes/A-1.md', 'd/notes/A-1.md', 'mine', baseline),
        write('n2', 'd/notes/Fine-2.md', 'd/notes/Fine-2.md', 'also mine', null)
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [{ kind: 'note', path: 'd/notes/A-1.md', nodeId: 'n1' }])
  // the conflicting file is untouched...
  assert.equal(await read('d/notes/A-1.md'), 'changed outside the app')
  // ...and the rest went through, hub included
  assert.equal(await read('d/notes/Fine-2.md'), 'also mine')
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.hubWritten, true)
  assert.deepEqual(Object.keys(r.notes), ['n2'])
  assert.deepEqual(r.remaining, { hub: false, nodeIds: ['n1'] })
})

test("the user's case: diagram and a note both edited, the note conflicts -> the diagram still saves", async () => {
  const baseline = await outsideEdited('d/notes/A-1.md')
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [write('n1', 'd/notes/A-1.md', 'd/notes/A-1.md', 'mine', baseline)]
    }),
    deps()
  )
  assert.equal(r.hubWritten, true)
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.conflicts.length, 1)
})

test('a conflicting note that is also being renamed: hub is saved but keeps the OLD path for it', async () => {
  const baseline = await outsideEdited('d/notes/Old-1.md')
  let reverted
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [write('n1', 'd/notes/Old-1.md', 'd/notes/New-1.md', 'mine', baseline)]
    }),
    deps({
      serializeHub: (ids) => {
        reverted = ids
        return 'HUB'
      }
    })
  )
  assert.equal(r.hubWritten, true)
  assert.deepEqual(reverted, ['n1'])
  assert.equal(has('d/notes/New-1.md'), false)
  assert.equal(await read('d/notes/Old-1.md'), 'changed outside the app')
  // the finish-the-job request must rewrite the diagram, since the path changes
  assert.deepEqual(r.remaining, { hub: true, nodeIds: ['n1'] })
})

test("the hub changed on disk is held back — and so are creates/renames the hub can't point at yet", async () => {
  await writeFile(diagram, 'v1')
  const hubBaseline = await stamp(diagram)
  await writeFile(diagram, 'changed outside the app!')
  await put('d/notes/Edit-1.md', 'old')
  await put('d/notes/Old-2.md', 'renamed body')

  const r = await executeSave(
    req({
      writeHub: true,
      expectedHubStamp: hubBaseline,
      ops: [
        // in place: safe without the hub
        write('inplace', 'd/notes/Edit-1.md', 'd/notes/Edit-1.md', 'edited'),
        // new note: the hub can't reference it
        write('fresh', null, 'd/notes/Fresh-3.md', 'brand new'),
        // rename: deleting the old name would break the unchanged hub
        move('renamed', 'd/notes/Old-2.md', 'd/notes/New-2.md')
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [{ kind: 'hub', path: diagram }])
  assert.equal(r.hubWritten, false)
  assert.equal(await readFile(diagram, 'utf-8'), 'changed outside the app!')
  assert.equal(await read('d/notes/Edit-1.md'), 'edited')
  assert.equal(has('d/notes/Fresh-3.md'), false)
  assert.equal(has('d/notes/New-2.md'), false)
  assert.equal(await read('d/notes/Old-2.md'), 'renamed body')
  assert.deepEqual(Object.keys(r.notes), ['inplace'])
  assert.deepEqual(r.remaining, { hub: true, nodeIds: ['fresh', 'renamed'] })
})

test('the hub changed on disk is a conflict only when the hub is being written', async () => {
  await writeFile(diagram, 'v1')
  const baseline = await stamp(diagram)
  await writeFile(diagram, 'changed outside the app!')
  const r = await executeSave(req({ writeHub: false, expectedHubStamp: baseline }), deps())
  assert.deepEqual(r.conflicts, [])
})

test('finishing the job: a second request with overwrite completes what was held back', async () => {
  const baseline = await outsideEdited('d/notes/Old-1.md')
  const ops = [write('n1', 'd/notes/Old-1.md', 'd/notes/New-1.md', 'mine', baseline)]
  const first = await executeSave(req({ writeHub: true, ops }), deps())
  assert.equal(first.remaining.hub, true)

  const seen = []
  const second = await executeSave(
    req({
      writeHub: first.remaining.hub,
      ops: ops.filter((o) => first.remaining.nodeIds.includes(o.nodeId)),
      overwrite: true
    }),
    deps({
      serializeHub: (ids) => {
        seen.push(ids)
        return 'HUB2'
      }
    })
  )
  assert.equal(second.status, 'saved')
  assert.deepEqual(second.conflicts, [])
  assert.deepEqual(second.remaining, { hub: false, nodeIds: [] })
  assert.deepEqual(seen, [[]])
  assert.equal(await read('d/notes/New-1.md'), 'mine')
  assert.equal(has('d/notes/Old-1.md'), false)
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB2')
})

test('overwrite: true writes over a conflicting file', async () => {
  const baseline = await outsideEdited('d/notes/A-1.md')
  const r = await executeSave(
    req({
      overwrite: true,
      ops: [write('n1', 'd/notes/A-1.md', 'd/notes/A-1.md', 'mine', baseline)]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [])
  assert.equal(await read('d/notes/A-1.md'), 'mine')
})

test('no baseline (null) or a vanished file is never a conflict', async () => {
  const r = await executeSave(
    req({
      writeHub: true,
      expectedHubStamp: null,
      ops: [write('n1', 'd/notes/Missing-1.md', 'd/notes/Missing-1.md', 'x', 'some-old-stamp')]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [])
})

test('a failure part-way reports what was completed and leaves the hub unwritten', async () => {
  await put('blocker', 'i am a file, not a folder')
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [
        write('ok', null, 'd/notes/Ok-1.md', 'fine'),
        write('bad', null, 'blocker/notes/Bad-2.md', 'cannot be created')
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'failed')
  assert.equal(r.hubWritten, false)
  assert.deepEqual(Object.keys(r.notes), ['ok'])
  assert.equal(existsSync(diagram), false)
})

// --- Paths stored in a diagram are untrusted (ADR 0115) -----------------------
// A shared diagram can name any file as a note. Save must never copy from, or
// delete, anything outside the diagram's own folder.
import { relative, sep } from 'node:path'

let outside
beforeEach(async () => {
  outside = await mkdtemp(join(tmpdir(), 'chd-outside-'))
  await writeFile(join(outside, 'victim.txt'), 'precious')
})
afterEach(() => rm(outside, { recursive: true, force: true }))
const toStored = (p) => p.split(sep).join('/')
const pointerToVictim = () => toStored(relative(dir, join(outside, 'victim.txt')))

test('hostile move: a note path outside the folder is not copied and not deleted', async () => {
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', pointerToVictim(), 'd/notes/A.md')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await readFile(join(outside, 'victim.txt'), 'utf-8'), 'precious')
  assert.equal(has('d/notes/A.md'), false)
  assert.deepEqual(r.skippedMoves, ['n1'])
})

test('hostile write: the outside file named as the old note survives', async () => {
  const r = await executeSave(
    req({ writeHub: true, ops: [write('n1', pointerToVictim(), 'd/notes/A.md', 'new text')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/notes/A.md'), 'new text')
  assert.equal(await readFile(join(outside, 'victim.txt'), 'utf-8'), 'precious')
})

test('hostile write: an absolute old-note path is never deleted either', async () => {
  const absolute = join(outside, 'victim.txt')
  const r = await executeSave(
    req({ writeHub: true, ops: [write('n1', absolute, 'd/notes/A.md', 'new text')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await readFile(absolute, 'utf-8'), 'precious')
})

test('a destination outside the folder fails the save and writes nothing there', async () => {
  const escape = toStored(relative(dir, join(outside, 'planted.txt')))
  const r = await executeSave(
    req({ writeHub: true, ops: [write('n1', null, escape, 'x')] }),
    deps()
  )
  assert.equal(r.status, 'failed')
  assert.equal(existsSync(join(outside, 'planted.txt')), false)
  assert.equal(existsSync(diagram), false)
})

test('".." that stays inside the folder still works', async () => {
  await put('d/notes/old.md', 'kept')
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/notes/../notes/old.md', 'd/notes/new.md')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/notes/new.md'), 'kept')
  assert.equal(has('d/notes/old.md'), false)
})

test('a folder emptied by moving its notes out is removed', async () => {
  await put('d/details/A-1.md', 'one')
  await put('d/details/B-2.md', 'two')
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [
        move('n1', 'd/details/A-1.md', 'd/notes/A-1.md'),
        move('n2', 'd/details/B-2.md', 'd/notes/B-2.md')
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/notes/A-1.md'), 'one')
  assert.equal(has('d/details'), false)
})

test('a folder that still has something in it is left alone', async () => {
  await put('d/details/A-1.md', 'one')
  await put('d/details/other.txt', 'not a note of this diagram')
  await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/details/A-1.md', 'd/notes/A-1.md')] }),
    deps()
  )
  assert.equal(has('d/details/A-1.md'), false)
  assert.equal(await read('d/details/other.txt'), 'not a note of this diagram')
})

test('the diagram folder itself is never removed, even when it ends up empty', async () => {
  await put('A-1.md', 'one')
  await executeSave(req({ writeHub: true, ops: [move('n1', 'A-1.md', 'notes/A-1.md')] }), deps())
  assert.equal(has('A-1.md'), false)
  assert.equal(has('notes/A-1.md'), true)
  assert.equal(existsSync(dir), true)
})

// --- Save As: copying the notes that were never opened -----------------------

const copy = (nodeId, from, to) => ({ kind: 'copy', nodeId, from, to })

test('copy: the note comes from the previous folder, which is left as it was', async () => {
  await put('prev/notes/A.md', 'alpha')
  const out = await executeSave(
    req({
      writeHub: true,
      ops: [copy('n1', 'notes/A.md', 'notes/A.md')],
      copyFromDir: join(dir, 'prev')
    }),
    deps()
  )
  assert.equal(out.status, 'saved')
  assert.equal(await read('notes/A.md'), 'alpha')
  assert.equal(await read('prev/notes/A.md'), 'alpha')
  assert.deepEqual(Object.keys(out.notes), ['n1'])
  assert.deepEqual(out.skippedMoves, [])
})

test('copy: a file already there with other text is kept, with a warning', async () => {
  await put('prev/notes/A.md', 'alpha')
  await put('notes/A.md', "someone else's note")
  const out = await executeSave(
    req({ ops: [copy('n1', 'notes/A.md', 'notes/A.md')], copyFromDir: join(dir, 'prev') }),
    deps()
  )
  assert.equal(await read('notes/A.md'), "someone else's note")
  assert.equal(out.warnings.length, 1)
})

test('copy: an identical file already there is no cause for a warning', async () => {
  await put('prev/notes/A.md', 'alpha')
  await put('notes/A.md', 'alpha')
  const out = await executeSave(
    req({ ops: [copy('n1', 'notes/A.md', 'notes/A.md')], copyFromDir: join(dir, 'prev') }),
    deps()
  )
  assert.deepEqual(out.warnings, [])
})

test('copy: Save As in the same folder shares the note and does not damage it', async () => {
  await put('notes/A.md', 'alpha')
  const out = await executeSave(
    req({ ops: [copy('n1', 'notes/A.md', 'notes/A.md')], copyFromDir: dir }),
    deps()
  )
  assert.equal(await read('notes/A.md'), 'alpha')
  assert.deepEqual(out.warnings, [])
  assert.deepEqual(Object.keys(out.notes), ['n1'])
})

test('copy: a missing source copies nothing and the node keeps its old path', async () => {
  const out = await executeSave(
    req({ ops: [copy('n1', 'notes/A.md', 'notes/A.md')], copyFromDir: join(dir, 'prev') }),
    deps()
  )
  assert.deepEqual(out.skippedMoves, ['n1'])
  assert.equal(has('notes/A.md'), false)
})

test('copy: a source outside the previous folder is never read', async () => {
  await put('secret.md', 'do not copy')
  const out = await executeSave(
    req({ ops: [copy('n1', '../secret.md', 'notes/A.md')], copyFromDir: join(dir, 'prev') }),
    deps()
  )
  assert.deepEqual(out.skippedMoves, ['n1'])
  assert.equal(has('notes/A.md'), false)
})

test('assets: images and linked diagrams are copied and written before the diagram', async () => {
  await put('prev/assets/p.png', 'PNG')
  const out = await executeSave(
    req({
      writeHub: true,
      copyFromDir: join(dir, 'prev'),
      assets: [
        { kind: 'copy', from: 'assets/p.png', to: 'd/assets/p.png' },
        { kind: 'write', to: 'd/child.chd', content: 'CHILD' }
      ]
    }),
    deps()
  )
  assert.equal(out.status, 'saved')
  assert.equal(await read('d/assets/p.png'), 'PNG')
  assert.equal(await read('d/child.chd'), 'CHILD')
  assert.equal(await read('prev/assets/p.png'), 'PNG')
  assert.equal(out.hubWritten, true)
})

test('assets: a place that is taken stops the save before anything is written', async () => {
  await put('prev/a.png', 'A')
  await put('d/taken.png', 'someone else')
  const out = await executeSave(
    req({
      writeHub: true,
      copyFromDir: join(dir, 'prev'),
      assets: [
        { kind: 'write', to: 'd/first.chd', content: 'X' },
        { kind: 'copy', from: 'a.png', to: 'd/taken.png' }
      ]
    }),
    deps()
  )
  assert.equal(out.status, 'failed')
  assert.match(out.error, /"d\/taken.png" already exists/)
  assert.equal(has('d/first.chd'), false)
  assert.equal(await read('d/taken.png'), 'someone else')
  assert.equal(out.hubWritten, false)
})

test('assets: a source that vanished is a warning, and one outside the folder is never read', async () => {
  await put('secret.png', 'do not copy')
  const out = await executeSave(
    req({
      copyFromDir: join(dir, 'prev'),
      assets: [
        { kind: 'copy', from: 'gone.png', to: 'd/gone.png' },
        { kind: 'copy', from: '../secret.png', to: 'd/secret.png' }
      ]
    }),
    deps()
  )
  assert.equal(out.status, 'saved')
  assert.equal(out.warnings.length, 2)
  assert.equal(has('d/gone.png'), false)
  assert.equal(has('d/secret.png'), false)
})

test('assets: a destination outside the new folder fails the save', async () => {
  const out = await executeSave(
    req({ assets: [{ kind: 'write', to: '../escape.chd', content: 'X' }] }),
    deps()
  )
  assert.equal(out.status, 'failed')
  assert.match(out.error, /outside the diagram's folder/)
})
