// Run with `npm test`. Exercises the executor against a real temp directory.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeSave } from './documentSaveExec.ts'

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
const deps = (over = {}) => ({ stamp, serializeHub: () => 'HUB', ...over })
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
    req({ writeHub: true, ops: [write('n1', null, 'd/details/A-1.md', 'hello')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/details/A-1.md'), 'hello')
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.hubWritten, true)
  assert.equal(r.notes.n1.path, 'd/details/A-1.md')
  assert.ok(r.notes.n1.stamp)
  assert.ok(r.hubStamp)
  assert.deepEqual(r.conflicts, [])
  assert.deepEqual(r.remaining, { hub: false, nodeIds: [] })
})

test('crash-safe order: when the hub is serialised both old and new note files exist', async () => {
  await put('d/details/Old-1.md', 'body')
  let seen
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/details/Old-1.md', 'd/details/New-1.md')] }),
    deps({
      serializeHub: () => {
        seen = [has('d/details/Old-1.md'), has('d/details/New-1.md')]
        return 'HUB'
      }
    })
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(seen, [true, true])
  // old removed only afterwards
  assert.equal(has('d/details/Old-1.md'), false)
  assert.equal(await read('d/details/New-1.md'), 'body')
})

test('a dirty note whose label changed: new name written, old name removed', async () => {
  await put('d/details/Old-1.md', 'old text')
  const r = await executeSave(
    req({ ops: [write('n1', 'd/details/Old-1.md', 'd/details/New-1.md', 'new text')] }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.equal(await read('d/details/New-1.md'), 'new text')
  assert.equal(has('d/details/Old-1.md'), false)
})

test('a move whose source is missing is skipped (reported), nothing deleted or created', async () => {
  let reverted
  const r = await executeSave(
    req({ writeHub: true, ops: [move('n1', 'd/details/Gone-1.md', 'd/details/New-1.md')] }),
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
  assert.equal(has('d/details/New-1.md'), false)
  assert.equal(r.notes.n1, undefined)
})

// --- conflicts: save everything that doesn't conflict, hold the rest ---------

test('a conflicting note is held back; everything else — including the hub — still saves', async () => {
  const baseline = await outsideEdited('d/details/A-1.md')
  await put('d/details/Fine-2.md', 'untouched')

  const r = await executeSave(
    req({
      writeHub: true,
      ops: [
        write('n1', 'd/details/A-1.md', 'd/details/A-1.md', 'mine', baseline),
        write('n2', 'd/details/Fine-2.md', 'd/details/Fine-2.md', 'also mine', null)
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [{ kind: 'note', path: 'd/details/A-1.md', nodeId: 'n1' }])
  // the conflicting file is untouched...
  assert.equal(await read('d/details/A-1.md'), 'changed outside the app')
  // ...and the rest went through, hub included
  assert.equal(await read('d/details/Fine-2.md'), 'also mine')
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.hubWritten, true)
  assert.deepEqual(Object.keys(r.notes), ['n2'])
  assert.deepEqual(r.remaining, { hub: false, nodeIds: ['n1'] })
})

test('the user\'s case: diagram and a note both edited, the note conflicts -> the diagram still saves', async () => {
  const baseline = await outsideEdited('d/details/A-1.md')
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [write('n1', 'd/details/A-1.md', 'd/details/A-1.md', 'mine', baseline)]
    }),
    deps()
  )
  assert.equal(r.hubWritten, true)
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB')
  assert.equal(r.conflicts.length, 1)
})

test('a conflicting note that is also being renamed: hub is saved but keeps the OLD path for it', async () => {
  const baseline = await outsideEdited('d/details/Old-1.md')
  let reverted
  const r = await executeSave(
    req({
      writeHub: true,
      ops: [write('n1', 'd/details/Old-1.md', 'd/details/New-1.md', 'mine', baseline)]
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
  assert.equal(has('d/details/New-1.md'), false)
  assert.equal(await read('d/details/Old-1.md'), 'changed outside the app')
  // the finish-the-job request must rewrite the diagram, since the path changes
  assert.deepEqual(r.remaining, { hub: true, nodeIds: ['n1'] })
})

test('the hub changed on disk is held back — and so are creates/renames the hub can\'t point at yet', async () => {
  await writeFile(diagram, 'v1')
  const hubBaseline = await stamp(diagram)
  await writeFile(diagram, 'changed outside the app!')
  await put('d/details/Edit-1.md', 'old')
  await put('d/details/Old-2.md', 'renamed body')

  const r = await executeSave(
    req({
      writeHub: true,
      expectedHubStamp: hubBaseline,
      ops: [
        // in place: safe without the hub
        write('inplace', 'd/details/Edit-1.md', 'd/details/Edit-1.md', 'edited'),
        // new note: the hub can't reference it
        write('fresh', null, 'd/details/Fresh-3.md', 'brand new'),
        // rename: deleting the old name would break the unchanged hub
        move('renamed', 'd/details/Old-2.md', 'd/details/New-2.md')
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [{ kind: 'hub', path: diagram }])
  assert.equal(r.hubWritten, false)
  assert.equal(await readFile(diagram, 'utf-8'), 'changed outside the app!')
  assert.equal(await read('d/details/Edit-1.md'), 'edited')
  assert.equal(has('d/details/Fresh-3.md'), false)
  assert.equal(has('d/details/New-2.md'), false)
  assert.equal(await read('d/details/Old-2.md'), 'renamed body')
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
  const baseline = await outsideEdited('d/details/Old-1.md')
  const ops = [write('n1', 'd/details/Old-1.md', 'd/details/New-1.md', 'mine', baseline)]
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
  assert.equal(await read('d/details/New-1.md'), 'mine')
  assert.equal(has('d/details/Old-1.md'), false)
  assert.equal(await readFile(diagram, 'utf-8'), 'HUB2')
})

test('overwrite: true writes over a conflicting file', async () => {
  const baseline = await outsideEdited('d/details/A-1.md')
  const r = await executeSave(
    req({
      overwrite: true,
      ops: [write('n1', 'd/details/A-1.md', 'd/details/A-1.md', 'mine', baseline)]
    }),
    deps()
  )
  assert.equal(r.status, 'saved')
  assert.deepEqual(r.conflicts, [])
  assert.equal(await read('d/details/A-1.md'), 'mine')
})

test('no baseline (null) or a vanished file is never a conflict', async () => {
  const r = await executeSave(
    req({
      writeHub: true,
      expectedHubStamp: null,
      ops: [write('n1', 'd/details/Missing-1.md', 'd/details/Missing-1.md', 'x', 'some-old-stamp')]
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
        write('ok', null, 'd/details/Ok-1.md', 'fine'),
        write('bad', null, 'blocker/details/Bad-2.md', 'cannot be created')
      ]
    }),
    deps()
  )
  assert.equal(r.status, 'failed')
  assert.equal(r.hubWritten, false)
  assert.deepEqual(Object.keys(r.notes), ['ok'])
  assert.equal(existsSync(diagram), false)
})
