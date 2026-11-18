// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installedIconOf, refForInstalledIcon } from './iconRefs.ts'

test('a built-in icon means the Tabler pack, an installed one itself, a custom one no pack', () => {
  assert.deepEqual(installedIconOf({ source: 'builtin', id: 'server' }), {
    pack: 'Tabler',
    path: 'Outline/server.svg'
  })
  assert.deepEqual(installedIconOf({ source: 'installed', pack: 'AWS', path: 'A/b.svg' }), {
    pack: 'AWS',
    path: 'A/b.svg'
  })
  assert.equal(installedIconOf({ source: 'custom', path: 'assets/x.svg' }), undefined)
})

test('a Tabler outline icon is stored as the built-in reference it always was', () => {
  assert.deepEqual(refForInstalledIcon('Tabler', 'Outline/arrow-big-up.svg'), {
    source: 'builtin',
    id: 'arrow-big-up'
  })
})

test('every other icon is stored as an installed reference', () => {
  assert.deepEqual(refForInstalledIcon('AWS', 'Compute/EC2.svg'), {
    source: 'installed',
    pack: 'AWS',
    path: 'Compute/EC2.svg'
  })
  // Another subset of the Tabler pack, or a name a built-in id cannot be, stays installed.
  assert.equal(refForInstalledIcon('Tabler', 'Filled/star.svg').source, 'installed')
  assert.equal(refForInstalledIcon('Tabler', 'Outline/Odd Name.svg').source, 'installed')
})
