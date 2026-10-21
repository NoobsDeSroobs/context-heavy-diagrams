// Run with `npm test`. Covers what Delete really removes when containers are
// involved (ADR 0012 child promotion, and the select-everything exception).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDeletion } from './containerRemoval.ts'

const node = (id, parentId, selected = false) => ({ id, parentId, selected })
const edge = (id, source, target, selected = false) => ({ id, source, target, selected })
const ids = (list) => list.map((x) => x.id).sort()

// React Flow hands over the cascaded set: the container plus every descendant,
// and every edge touching any of them.
const cascade = (...nodes) => nodes

test('only the container selected: it goes, its children are promoted and keep their edges', () => {
  const nodes = cascade(node('c', undefined, true), node('a', 'c'), node('b', 'c'))
  const edges = [edge('c-x', 'c', 'x'), edge('a-y', 'a', 'y'), edge('a-b', 'a', 'b')]
  const result = resolveDeletion(nodes, edges)
  assert.deepEqual(ids(result.nodes), ['c'])
  assert.deepEqual(ids(result.edges), ['c-x'])
})

test('container and all its children selected: everything is deleted', () => {
  const nodes = cascade(node('c', undefined, true), node('a', 'c', true), node('b', 'c', true))
  const edges = [edge('c-x', 'c', 'x'), edge('a-y', 'a', 'y')]
  const result = resolveDeletion(nodes, edges)
  assert.deepEqual(ids(result.nodes), ['a', 'b', 'c'])
  assert.deepEqual(ids(result.edges), ['a-y', 'c-x'])
})

test('container and some children selected: only the selected ones go with it', () => {
  const nodes = cascade(node('c', undefined, true), node('a', 'c', true), node('b', 'c'))
  const edges = [edge('a-y', 'a', 'y'), edge('b-y', 'b', 'y')]
  const result = resolveDeletion(nodes, edges)
  assert.deepEqual(ids(result.nodes), ['a', 'c'])
  assert.deepEqual(ids(result.edges), ['a-y'])
})

test('nested: an unselected inner container is promoted too, with its own contents', () => {
  const nodes = cascade(node('outer', undefined, true), node('inner', 'outer'), node('e', 'inner'))
  const result = resolveDeletion(nodes, [edge('e-z', 'e', 'z')])
  assert.deepEqual(ids(result.nodes), ['outer'])
  assert.deepEqual(ids(result.edges), [])
})

test('nested: a selected grandchild is deleted even if its container is promoted', () => {
  const nodes = cascade(
    node('outer', undefined, true),
    node('inner', 'outer'),
    node('e', 'inner', true)
  )
  const result = resolveDeletion(nodes, [])
  assert.deepEqual(ids(result.nodes), ['e', 'outer'])
})

test('the top of a removal is deleted even when it is not marked selected (deleted by id)', () => {
  const result = resolveDeletion(cascade(node('c', undefined, false), node('a', 'c')), [])
  assert.deepEqual(ids(result.nodes), ['c'])
})

test('plain elements are unaffected: a deleted entity and its edges go, nothing else', () => {
  const result = resolveDeletion(
    [node('e', undefined, true)],
    [edge('e-x', 'e', 'x'), edge('p-q', 'p', 'q', true)]
  )
  assert.deepEqual(ids(result.nodes), ['e'])
  assert.deepEqual(ids(result.edges), ['e-x', 'p-q'])
})

test('a selected edge between survivors is still deleted', () => {
  const nodes = cascade(node('c', undefined, true), node('a', 'c'), node('b', 'c'))
  const result = resolveDeletion(nodes, [edge('a-b', 'a', 'b', true)])
  assert.deepEqual(ids(result.edges), ['a-b'])
})
