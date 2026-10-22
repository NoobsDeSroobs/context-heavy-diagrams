// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMissingFileRemoval, collectResourceRefs } from './resourceRefs.ts'

const node = (id, data, type = 'entity') => ({ id, type, position: { x: 0, y: 0 }, data })

test('collects every on-disk path an element or legend entry points at', () => {
  const nodes = [
    node('a', {
      label: 'A',
      linkedDiagram: 'a/child.chd',
      details: 'details/a.md',
      icons: {
        topLeft: { source: 'custom', path: 'assets/x.svg' },
        topRight: { source: 'builtin', id: 'user' }
      },
      references: ['assets/references/one.png', '']
    })
  ]
  const legend = [
    {
      id: 'l1',
      kind: 'icon',
      label: 'Cloud',
      icon: { source: 'custom', path: 'assets/cloud.svg' }
    },
    { id: 'l2', kind: 'icon', label: 'Built-in', icon: { source: 'builtin', id: 'user' } },
    { id: 'l3', kind: 'line', label: 'Line', color: '#fff' }
  ]
  const refs = collectResourceRefs(nodes, legend)
  assert.deepEqual(
    refs.map((r) => [r.key, r.resourceKind, r.relativePath]),
    [
      ['a:linkedDiagram', 'linkedDiagram', 'a/child.chd'],
      ['a:details', 'details', 'details/a.md'],
      ['a:icon:topLeft', 'icon', 'assets/x.svg'],
      ['a:reference:0', 'reference', 'assets/references/one.png'],
      ['legend:l1', 'icon', 'assets/cloud.svg']
    ]
  )
  assert.equal(refs[0].ownerLabel, 'A')
  assert.equal(refs[4].ownerKind, 'legend')
})

test('removing a missing file clears just that reference from its node', () => {
  const nodes = [
    node('a', {
      label: 'A',
      linkedDiagram: 'a/child.chd',
      details: 'details/a.md',
      icons: { topLeft: { source: 'custom', path: 'assets/x.svg' } },
      references: ['one.png', 'two.png']
    })
  ]
  const entry = (resourceKind, extra = {}) => ({
    key: 'k',
    ownerKind: 'node',
    ownerId: 'a',
    ownerLabel: 'A',
    ownerType: 'entity',
    resourceKind,
    relativePath: '',
    resolvedPath: '',
    ...extra
  })
  const dataOf = (kind, extra) =>
    applyMissingFileRemoval(nodes, [], entry(kind, extra)).nodes[0].data

  assert.equal(dataOf('linkedDiagram').linkedDiagram, undefined)
  assert.equal(dataOf('details').details, undefined)
  assert.equal(dataOf('icon', { iconSlot: 'topLeft' }).icons, undefined)
  assert.deepEqual(dataOf('reference', { relativePath: 'one.png' }).references, ['two.png'])
  assert.equal(nodes[0].data.linkedDiagram, 'a/child.chd', 'the input is not mutated')
})

test('removing a legend entry drops it and leaves the nodes alone', () => {
  const nodes = [node('a', { label: 'A' })]
  const legend = [
    { id: 'l1', kind: 'line', label: 'x' },
    { id: 'l2', kind: 'line', label: 'y' }
  ]
  const out = applyMissingFileRemoval(nodes, legend, {
    key: 'legend:l1',
    ownerKind: 'legend',
    ownerId: 'l1',
    ownerLabel: 'x',
    ownerType: 'legend',
    resourceKind: 'icon',
    relativePath: 'p',
    resolvedPath: 'p'
  })
  assert.deepEqual(
    out.legend.map((e) => e.id),
    ['l2']
  )
  assert.equal(out.nodes, nodes)
})
