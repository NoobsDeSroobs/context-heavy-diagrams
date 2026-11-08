// Run with `npm test`. Plans a Save As against a real temp directory.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planSaveAs } from './saveAsPlan.ts'

let dir
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chd-saveas-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const node = (id, data = {}) => ({ id, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const put = async (rel, content = 'x') => {
  await mkdir(join(dir, rel, '..'), { recursive: true })
  await writeFile(join(dir, rel), content)
}
const diagramJson = (...nodes) => JSON.stringify({ version: 1, nodes, edges: [] })
const ALL = { notes: true, images: true, linked: true }
const ask = (newRel, nodes, options = ALL) =>
  planSaveAs({
    currentPath: join(dir, 'A.chd'),
    newPath: join(dir, newRel),
    options,
    nodes
  })

test('a plan reads the old folder and lists what the copy needs', async () => {
  await put('A.chd', diagramJson())
  await put('A/assets/references/p.png')
  await put('child.chd', diagramJson(node('c1', { linkedDiagram: 'A.chd' })))
  const p = await ask('B.chd', [
    node('n1', { references: ['A/assets/references/p.png'], linkedDiagram: 'child.chd' })
  ])
  assert.deepEqual(p.problems, [])
  assert.deepEqual(p.assets.map((a) => a.to).sort(), ['B/assets/references/p.png', 'B/child.chd'])
  assert.equal(p.rootRefs.n1.linkedDiagram, 'B/child.chd')
})

test('a name that is taken, as a file or as a folder, cannot be used', async () => {
  await put('A.chd', diagramJson())
  await put('A/assets/p.png')
  const nodes = [node('n1', { references: ['A/assets/p.png'] })]

  await put('Taken.chd', diagramJson())
  assert.match((await ask('Taken.chd', nodes)).problems[0], /"Taken.chd" already exists/)

  await mkdir(join(dir, 'Folder'))
  assert.match(
    (await ask('Folder.chd', nodes)).problems[0],
    /A folder named "Folder" already exists/
  )
  // Nothing goes into the folder, so a leftover one does not matter.
  assert.deepEqual((await ask('Folder.chd', [node('n1')])).problems, [])
})

test('the diagram itself, and a name without .chd, cannot be the target', async () => {
  await put('A.chd', diagramJson())
  assert.match((await ask('A.chd', [])).problems[0], /the diagram you are editing/)
  assert.match((await ask('B.txt', [])).problems[0], /must end in \.chd/)
})

test('saving into the same folder under a new name is fine', async () => {
  await put('A.chd', diagramJson())
  await put('child.chd', diagramJson())
  const p = await ask('B.chd', [node('n1', { linkedDiagram: 'child.chd' })])
  assert.deepEqual(p.problems, [])
  assert.deepEqual(
    p.assets.map((a) => a.to),
    ['B/child.chd']
  )
})

test('a path that leaves the folder is not read', async () => {
  await put('A.chd', diagramJson())
  await mkdir(join(dir, 'in'))
  const p = await planSaveAs({
    currentPath: join(dir, 'in', 'A.chd'),
    newPath: join(dir, 'in', 'B.chd'),
    options: ALL,
    nodes: [node('n1', { linkedDiagram: '../A.chd', references: ['../A.chd'] })]
  })
  assert.deepEqual(p.assets, [])
  assert.deepEqual(
    p.removed.map((r) => r.reason),
    ["outside this diagram's folder", "outside this diagram's folder"]
  )
})
