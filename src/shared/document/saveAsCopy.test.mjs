// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applySaveAsRefs,
  mapRefs,
  PATH_FIELDS,
  planSaveAsCopy,
  refNodesOf,
  relativeFrom,
  resolveRel
} from './saveAsCopy.ts'

const node = (id, data = {}) => ({ id, data: { label: id.toUpperCase(), ...data } })
const diagram = (...nodes) => ({ version: 1, nodes, edges: [] })

// An in-memory old folder: diagrams are objects, other files are `true`.
function folder(files) {
  return {
    exists: async (rel) => rel in files,
    readDiagram: async (rel) =>
      files[rel] && typeof files[rel] === 'object' ? structuredClone(files[rel]) : null,
    serialize: (d) => JSON.stringify(d)
  }
}

const ALL = { notes: true, images: true, linked: true }
const plan = (files, root, over = {}, names = ['A.chd', 'B.chd']) =>
  planSaveAsCopy({
    oldFileName: names[0],
    newFileName: names[1],
    rootNodes: root,
    options: ALL,
    io: folder(files),
    ...over
  })
const written = (p, to) => {
  const op = p.assets.find((a) => a.to === to)
  return op && op.kind === 'write' ? JSON.parse(op.content) : undefined
}
const copies = (p) =>
  p.assets
    .filter((a) => a.kind === 'copy')
    .map((a) => `${a.from} -> ${a.to}`)
    .sort()

// --- paths ------------------------------------------------------------------

test('resolveRel keeps a path inside the folder and refuses everything else', () => {
  assert.equal(resolveRel('', 'a/b.chd'), 'a/b.chd')
  assert.equal(resolveRel('sub', '../x.chd'), 'x.chd')
  assert.equal(resolveRel('sub', './y/../z.chd'), 'sub/z.chd')
  assert.equal(resolveRel('', 'a\\b.chd'), 'a/b.chd')
  assert.equal(resolveRel('', '../out.chd'), null)
  assert.equal(resolveRel('sub', '../../out.chd'), null)
  assert.equal(resolveRel('', '/etc/passwd'), null)
  assert.equal(resolveRel('', '\\\\server\\share\\x.chd'), null)
  assert.equal(resolveRel('', 'C:\\x.chd'), null)
  assert.equal(resolveRel('', 'C:x.chd'), null)
  assert.equal(resolveRel('', ''), null)
})

test('relativeFrom writes a path as seen from the diagram that holds it', () => {
  assert.equal(relativeFrom('', 'B/child.chd'), 'B/child.chd')
  assert.equal(relativeFrom('B', 'B/child/notes/n.md'), 'child/notes/n.md')
  assert.equal(relativeFrom('B', 'B.chd'), '../B.chd')
  assert.equal(relativeFrom('B/sub', 'B/child.chd'), '../child.chd')
  assert.equal(relativeFrom('B/sub', 'B/sub/y.chd'), 'y.chd')
})

// --- the root diagram -------------------------------------------------------

test('the root diagram keeps its notes and images in a folder named after the copy', async () => {
  const files = {
    'A/notes/n.md': true,
    'A/assets/references/pic.png': true,
    'A/assets/icons/lock.svg': true
  }
  const p = await plan(files, [
    node('n1', {
      notes: 'A/notes/n.md',
      references: ['A/assets/references/pic.png'],
      icons: {
        topLeft: { source: 'custom', path: 'A/assets/icons/lock.svg' },
        topRight: { source: 'builtin', id: 'tabler:server' }
      }
    })
  ])
  assert.deepEqual(copies(p), [
    'A/assets/icons/lock.svg -> B/assets/icons/lock.svg',
    'A/assets/references/pic.png -> B/assets/references/pic.png'
  ])
  assert.deepEqual(p.rootRefs.n1.references, ['B/assets/references/pic.png'])
  assert.deepEqual(p.rootRefs.n1.icons, {
    topLeft: { source: 'custom', path: 'B/assets/icons/lock.svg' },
    topRight: { source: 'builtin', id: 'tabler:server' }
  })
  // The root's notes are planned with the save, not here, but they are counted.
  assert.equal(p.counts.notes, 1)
  assert.equal(p.counts.images, 2)
  assert.deepEqual(p.problems, [])
})

test('what is not ticked is removed from the copy', async () => {
  const files = { 'A/notes/n.md': true, 'A/assets/references/pic.png': true, 'c.chd': diagram() }
  const root = [
    node('n1', {
      notes: 'A/notes/n.md',
      references: ['A/assets/references/pic.png'],
      linkedDiagram: 'c.chd',
      icons: { topLeft: { source: 'custom', path: 'A/assets/i.svg' } }
    })
  ]
  const p = await plan(files, root, { options: { notes: false, images: false, linked: false } })
  assert.deepEqual(p.assets, [])
  assert.deepEqual(p.rootRefs.n1, {})
  // The dialog can say how many links go.
  assert.equal(p.counts.linked, 1)
})

test('a reference to a missing file or outside the folder is removed and listed', async () => {
  const files = { 'A/notes/here.md': true }
  const p = await plan(files, [
    node('n1', {
      references: ['A/assets/gone.png', '../elsewhere.png', 'C:\\pics\\x.png', '/abs/y.png'],
      linkedDiagram: '../other.chd'
    })
  ])
  assert.deepEqual(p.rootRefs.n1, {})
  assert.deepEqual(p.assets, [])
  assert.deepEqual(
    p.removed.map((r) => [r.path, r.reason]),
    [
      ['../other.chd', "outside this diagram's folder"],
      ['A/assets/gone.png', 'file not found'],
      ['../elsewhere.png', "outside this diagram's folder"],
      ['C:\\pics\\x.png', "outside this diagram's folder"],
      ['/abs/y.png', "outside this diagram's folder"]
    ]
  )
  assert.equal(p.removed[0].owner, 'B.chd')
  assert.equal(p.removed[0].label, 'N1')
})

// --- linked diagrams --------------------------------------------------------

test('a linked diagram is copied into the new folder with its own notes, images and links', async () => {
  const files = {
    'child.chd': diagram(
      node('c1', {
        notes: 'child/notes/n.md',
        references: ['child/assets/references/p.png'],
        linkedDiagram: 'A.chd'
      })
    ),
    'child/notes/n.md': true,
    'child/assets/references/p.png': true
  }
  const p = await plan(files, [node('n1', { linkedDiagram: 'child.chd' })])
  assert.equal(p.rootRefs.n1.linkedDiagram, 'B/child.chd')
  assert.deepEqual(copies(p), [
    'child/assets/references/p.png -> B/child/assets/references/p.png',
    'child/notes/n.md -> B/child/notes/n.md'
  ])
  const child = written(p, 'B/child.chd')
  const data = child.nodes[0].data
  // Seen from B/child.chd: its own files are beside it, and the old diagram is now ../B.chd.
  assert.equal(data.notes, 'child/notes/n.md')
  assert.deepEqual(data.references, ['child/assets/references/p.png'])
  assert.equal(data.linkedDiagram, '../B.chd')
  assert.deepEqual(p.counts, { notes: 1, images: 1, linked: 1 })
})

test('children in sub folders keep their place and the links between them still work', async () => {
  const files = {
    'sub/x.chd': diagram(
      node('x1', { linkedDiagram: '../y.chd' }),
      node('x2', { linkedDiagram: 'z.chd' })
    ),
    'sub/z.chd': diagram(),
    'y.chd': diagram(node('y1', { linkedDiagram: 'sub/x.chd' }))
  }
  const p = await plan(files, [node('n1', { linkedDiagram: 'sub/x.chd' })])
  assert.equal(p.rootRefs.n1.linkedDiagram, 'B/sub/x.chd')
  const x = written(p, 'B/sub/x.chd')
  assert.equal(x.nodes[0].data.linkedDiagram, '../y.chd')
  assert.equal(x.nodes[1].data.linkedDiagram, 'z.chd')
  assert.equal(written(p, 'B/y.chd').nodes[0].data.linkedDiagram, 'sub/x.chd')
  assert.ok(written(p, 'B/sub/z.chd'))
})

test('a cycle and a diagram linked twice are each copied once', async () => {
  const files = {
    'b.chd': diagram(node('b1', { linkedDiagram: 'c.chd' })),
    'c.chd': diagram(
      node('c1', { linkedDiagram: 'b.chd' }),
      node('c2', { linkedDiagram: 'A.chd' })
    ),
    'd.chd': diagram()
  }
  const p = await plan(files, [
    node('n1', { linkedDiagram: 'b.chd' }),
    node('n2', { linkedDiagram: 'd.chd' }),
    node('n3', { linkedDiagram: 'd.chd' })
  ])
  assert.deepEqual(p.assets.map((a) => a.to).sort(), ['B/b.chd', 'B/c.chd', 'B/d.chd'])
  assert.equal(written(p, 'B/c.chd').nodes[0].data.linkedDiagram, 'b.chd')
  assert.equal(written(p, 'B/c.chd').nodes[1].data.linkedDiagram, '../B.chd')
  assert.equal(p.rootRefs.n2.linkedDiagram, p.rootRefs.n3.linkedDiagram)
  assert.equal(p.counts.linked, 3)
})

test('the settings apply to every copied diagram', async () => {
  const files = {
    'child.chd': diagram(
      node('c1', {
        notes: 'child/notes/n.md',
        references: ['child/p.png'],
        linkedDiagram: 'deep.chd'
      })
    ),
    'deep.chd': diagram(node('d1', { notes: 'deep/notes/n.md' })),
    'child/notes/n.md': true,
    'child/p.png': true,
    'deep/notes/n.md': true
  }
  const p = await plan(files, [node('n1', { linkedDiagram: 'child.chd' })], {
    options: { notes: false, images: true, linked: true }
  })
  assert.equal(written(p, 'B/child.chd').nodes[0].data.notes, undefined)
  assert.equal(written(p, 'B/deep.chd').nodes[0].data.notes, undefined)
  assert.deepEqual(copies(p), ['child/p.png -> B/child/p.png'])
})

test('a link to a missing diagram is removed and listed', async () => {
  const p = await plan({}, [node('n1', { linkedDiagram: 'nowhere.chd' })])
  assert.deepEqual(p.rootRefs.n1, {})
  assert.deepEqual(
    p.removed.map((r) => r.reason),
    ['diagram not found']
  )
})

test('a link that leaves the old folder is not followed, inside a child too', async () => {
  const files = { 'child.chd': diagram(node('c1', { linkedDiagram: '../up.chd' })) }
  const p = await plan(files, [node('n1', { linkedDiagram: 'child.chd' })])
  assert.equal(written(p, 'B/child.chd').nodes[0].data.linkedDiagram, undefined)
  assert.deepEqual(
    p.removed.map((r) => [r.owner, r.path]),
    [['B/child.chd', '../up.chd']]
  )
})

// --- a copy of a copy -------------------------------------------------------

test("the old diagram's own folder maps onto the new one, so copies do not nest", async () => {
  const files = {
    'B/assets/references/pic.png': true,
    'B/child.chd': diagram(node('c1', { references: ['assets/references/q.png'] })),
    'B/assets/references/q.png': true
  }
  const p = await plan(
    files,
    [node('n1', { references: ['B/assets/references/pic.png'], linkedDiagram: 'B/child.chd' })],
    {},
    ['B.chd', 'C.chd']
  )
  assert.equal(p.rootRefs.n1.references[0], 'C/assets/references/pic.png')
  assert.equal(p.rootRefs.n1.linkedDiagram, 'C/child.chd')
  assert.equal(written(p, 'C/child.chd').nodes[0].data.references[0], 'assets/references/q.png')
})

// --- things that cannot be copied -------------------------------------------

test('two sources that would land on one name are refused', async () => {
  // The old diagram's own folder and the folder beside it both become B/assets.
  const files = { 'A/assets/p.png': true, 'assets/p.png': true }
  const p = await plan(files, [node('n1', { references: ['A/assets/p.png', 'assets/p.png'] })])
  assert.equal(p.problems.length, 1)
  assert.match(
    p.problems[0],
    /Both "A\/assets\/p.png" and "assets\/p.png" would be copied to "B\/assets\/p.png"/
  )
})

test('the same file used twice is copied once', async () => {
  const files = { 'p.png': true }
  const p = await plan(files, [
    node('n1', { references: ['p.png'] }),
    node('n2', { references: ['p.png'] })
  ])
  assert.deepEqual(copies(p), ['p.png -> B/p.png'])
  assert.deepEqual(p.problems, [])
  assert.equal(p.counts.images, 1)
})

// --- mapRefs ----------------------------------------------------------------

test('mapRefs leaves a node without references and every other field alone', async () => {
  const nodes = [node('n1', { points: [{ x: 1, y: 2 }], security: { t: 1 } })]
  const out = await mapRefs(nodes, async () => 'x')
  assert.deepEqual(out, nodes)
  assert.notEqual(out[0], nodes[0])
})

// --- the window's side --------------------------------------------------------

test('refNodesOf keeps only what planning needs', () => {
  const nodes = [
    { id: 'a', data: { label: 'A', notes: 'n.md', points: [1], references: ['r.png'] } },
    { id: 'b', data: {} },
    { id: 'c' }
  ]
  assert.deepEqual(refNodesOf(nodes), [
    { id: 'a', data: { label: 'A', notes: 'n.md', references: ['r.png'] } },
    { id: 'b', data: {} },
    { id: 'c', data: {} }
  ])
})

test('applySaveAsRefs sets the planned fields and removes what was not ticked', () => {
  const nodes = [
    { id: 'a', data: { label: 'A', notes: 'n.md', linkedDiagram: 'c.chd', references: ['r.png'] } },
    { id: 'b', data: { label: 'B', notes: 'm.md' } }
  ]
  const rootRefs = { a: { references: ['B/r.png'] } }
  const out = applySaveAsRefs(nodes, { rootRefs }, { notes: false, images: true, linked: false })
  assert.deepEqual(out[0].data, { label: 'A', references: ['B/r.png'] })
  assert.deepEqual(out[1].data, { label: 'B' })
  // Nothing to change: the same node comes back.
  const same = applySaveAsRefs(nodes, { rootRefs: {} }, { notes: true, images: true, linked: true })
  assert.equal(same[0], nodes[0])
})

// --- every path field is handled -------------------------------------------------

// A guard, not a proof: it reads the schema files and fails when a field that looks like a stored
// path (documented as a relative path, or named like one) is not one Save As knows about. Add the
// field to PATH_FIELDS, to mapRefs and to the dialog before making this pass.
test('every stored path in the schema is a field Save As carries or removes', async () => {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const found = new Set()
  for (const feature of await readdir(root, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    let source
    try {
      source = await readFile(join(root, feature.name, 'schema.ts'), 'utf-8')
    } catch {
      continue
    }
    let comment = ''
    for (const line of source.split(/\r?\n/)) {
      const text = line.trim()
      if (text.startsWith('//')) {
        comment += ` ${text}`
        continue
      }
      for (const m of text.matchAll(/(?:^|[{;,]\s*)(\w+)\??:\s*string(\[\])?\s*(?=[;,}]|$)/g)) {
        const name = m[1]
        if (/relative path/i.test(comment) || /path|file/i.test(name)) found.add(name)
      }
      comment = ''
    }
  }
  // `path` is the custom icon's, carried as `icons`; `linkedDiagram` has no comment to find.
  const covered = new Set([...PATH_FIELDS, 'path'])
  const unknown = [...found].filter((name) => !covered.has(name))
  assert.deepEqual(unknown, [], `fields that look like paths and are not handled: ${unknown}`)
  for (const name of ['notes', 'references', 'path'])
    assert.ok(found.has(name), `${name} not found`)
})

test('what is not ticked is still counted, so the dialog can say how much goes', async () => {
  const files = { 'A/notes/n.md': true, 'p.png': true, 'child.chd': diagram() }
  const root = [
    node('n1', {
      notes: 'A/notes/n.md',
      references: ['p.png', 'gone.png'],
      linkedDiagram: 'child.chd'
    })
  ]
  const p = await plan(files, root, { options: { notes: false, images: false, linked: false } })
  assert.deepEqual(p.counts, { notes: 1, images: 1, linked: 1 })
  assert.deepEqual(p.assets, [])
  assert.deepEqual(p.removed, [])
})
