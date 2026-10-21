// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchLinkedDiagrams } from './linkedSearch.ts'

const node = (id, label, extra = {}) => ({
  id,
  position: { x: 0, y: 0 },
  data: { label, ...extra }
})
const file = (nodes, edges = []) => ({ nodes, edges })
const link = (nodeId, relativePath) => ({ nodeId, relativePath })

// A fake filesystem keyed by "absolute" path; links resolve as `dir/rel` with
// `/`-joined segments, good enough to exercise the walk. Counts loads so the
// short-circuit and visited-set behaviour is observable.
function depsFor(files, term) {
  const loads = []
  const notesRead = []
  return {
    loads,
    notesRead,
    resolve: (from, rel) => `${from.slice(0, from.lastIndexOf('/'))}/${rel}`,
    keyOf: (p) => p.toLowerCase(),
    load: async (p) => {
      loads.push(p)
      if (!files[p]) throw new Error('ENOENT')
      return files[p]
    },
    matchNode: (n) =>
      String(n.data?.label ?? '')
        .toLowerCase()
        .includes(term),
    matchNodeNote: async (n) => {
      notesRead.push(n.id)
      return String(n.data?.note ?? '')
        .toLowerCase()
        .includes(term)
    },
    matchEdge: (e) => (e.label ?? '').toLowerCase().includes(term)
  }
}

test('a link matches when anything in its subtree does, however deep', async () => {
  const files = {
    '/d/a.chd': file([node('a1', 'nothing', { linkedDiagram: 'b.chd' })]),
    '/d/b.chd': file([node('b1', 'nothing', { linkedDiagram: 'c.chd' })]),
    '/d/c.chd': file([node('c1', 'uses OAuth')]),
    '/d/x.chd': file([node('x1', 'unrelated')])
  }
  const result = await searchLinkedDiagrams(
    '/d/root.chd',
    [link('server', 'a.chd'), link('client', 'x.chd')],
    depsFor(files, 'oauth')
  )
  assert.deepEqual(result.matchedNodeIds, ['server'])
  assert.deepEqual(result.unreadable, [])
})

test('an edge in a linked diagram counts as a match', async () => {
  const files = {
    '/d/a.chd': file([node('a1', 'x')], [{ id: 'e1', source: 'a1', target: 'a1', label: 'OAuth' }])
  }
  const result = await searchLinkedDiagrams(
    '/d/root.chd',
    [link('s', 'a.chd')],
    depsFor(files, 'oauth')
  )
  assert.deepEqual(result.matchedNodeIds, ['s'])
})

test('stops at the first match instead of reading the rest of the subtree', async () => {
  const files = {
    '/d/a.chd': file([node('a1', 'hit'), node('a2', 'x', { linkedDiagram: 'b.chd' })]),
    '/d/b.chd': file([node('b1', 'never read')])
  }
  const deps = depsFor(files, 'hit')
  await searchLinkedDiagrams('/d/root.chd', [link('s', 'a.chd')], deps)
  assert.deepEqual(deps.loads, ['/d/a.chd'])
})

test('cycles and links back to the open diagram terminate', async () => {
  const files = {
    '/d/a.chd': file([
      node('a1', 'x', { linkedDiagram: 'root.chd' }),
      node('a2', 'x', { linkedDiagram: 'b.chd' })
    ]),
    '/d/b.chd': file([node('b1', 'x', { linkedDiagram: 'a.chd' })])
  }
  const deps = depsFor(files, 'nomatch')
  const result = await searchLinkedDiagrams('/d/root.chd', [link('s', 'a.chd')], deps)
  assert.deepEqual(result.matchedNodeIds, [])
  assert.deepEqual(deps.loads, ['/d/a.chd', '/d/b.chd'])
})

test('two links sharing a subtree both match it', async () => {
  const files = {
    '/d/a.chd': file([node('a1', 'x', { linkedDiagram: 'shared.chd' })]),
    '/d/b.chd': file([node('b1', 'x', { linkedDiagram: 'shared.chd' })]),
    '/d/shared.chd': file([node('s1', 'hit')])
  }
  const result = await searchLinkedDiagrams(
    '/d/root.chd',
    [link('one', 'a.chd'), link('two', 'b.chd')],
    depsFor(files, 'hit')
  )
  assert.deepEqual(result.matchedNodeIds, ['one', 'two'])
})

test('an unreadable linked diagram is reported, and the other links still search', async () => {
  const files = { '/d/ok.chd': file([node('o1', 'hit')]) }
  const result = await searchLinkedDiagrams(
    '/d/root.chd',
    [link('gone', 'gone.chd'), link('ok', 'ok.chd')],
    depsFor(files, 'hit')
  )
  assert.deepEqual(result.matchedNodeIds, ['ok'])
  assert.deepEqual(result.unreadable, ['/d/gone.chd'])
})

test('cost order: in-memory hits skip every note read, and notes are tried before descending', async () => {
  const files = {
    // the label hit is on the LAST node, and an earlier node has a note to read
    '/d/a.chd': file([
      node('a1', 'x', { note: 'n' }),
      node('a2', 'hit', { linkedDiagram: 'b.chd' })
    ]),
    '/d/b.chd': file([node('b1', 'x')]),
    // no in-memory hit here; the note hit must stop it before b2.chd is loaded
    '/d/c.chd': file([node('c1', 'x', { note: 'has hit inside', linkedDiagram: 'b2.chd' })]),
    '/d/b2.chd': file([node('z', 'x')])
  }
  const deps = depsFor(files, 'hit')
  await searchLinkedDiagrams('/d/root.chd', [link('s', 'a.chd')], deps)
  assert.deepEqual(deps.notesRead, [])
  assert.deepEqual(deps.loads, ['/d/a.chd'])

  const deps2 = depsFor(files, 'hit')
  const result = await searchLinkedDiagrams('/d/root.chd', [link('s', 'c.chd')], deps2)
  assert.deepEqual(result.matchedNodeIds, ['s'])
  assert.deepEqual(deps2.loads, ['/d/c.chd'])
})
