// Run with `npm test`. icons.ts, references.ts, diagram.ts (files:check) and
// details.ts all resolve a stored relative path by delegating to this
// function, so covering it here covers those call sites too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { resolveLinkPath } from './linkPaths.ts'

const diagramPath = join('project', 'diagrams', 'main.chd')

test('resolves a forward-slash relative path against the diagram directory', () => {
  const result = resolveLinkPath(diagramPath, 'assets/icon.svg')
  assert.equal(result, join('project', 'diagrams', 'assets', 'icon.svg'))
})

test('resolves a backslash-authored relative path the same way, regardless of host OS', () => {
  const result = resolveLinkPath(diagramPath, 'assets\\icon.svg')
  assert.equal(result, join('project', 'diagrams', 'assets', 'icon.svg'))
})

test('returns an absolute stored path unchanged instead of joining it', () => {
  const absolute = resolve('other-drive', 'shared', 'icon.svg')
  const result = resolveLinkPath(diagramPath, absolute)
  assert.equal(result, absolute)
})
