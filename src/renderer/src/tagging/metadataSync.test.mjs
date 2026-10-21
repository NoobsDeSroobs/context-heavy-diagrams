// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedMetadata, syncElementMetadata } from './metadataSync.ts'

const tag = (over) => ({ key: 'env', lock: 'lockedEditable', ...over })

test('seedMetadata seeds every named tag at its default and lock, and nothing for none', () => {
  assert.equal(seedMetadata([]), undefined)
  assert.equal(seedMetadata([tag({ key: '' })]), undefined)
  assert.deepEqual(
    seedMetadata([tag({ defaultValue: 'prod' }), tag({ key: 'owner', lock: 'lockedStatic' })]),
    {
      env: { value: 'prod', lock: 'lockedEditable' },
      owner: { value: null, lock: 'lockedStatic' }
    }
  )
})

test('lockedEditable keeps a valid value and resets an invalid one', () => {
  const def = tag({ allowedValues: ['dev', 'prod'], defaultValue: 'dev' })
  const diag = []
  assert.deepEqual(
    syncElementMetadata({ env: { value: 'prod', lock: 'lockedEditable' } }, [def], 'Box', diag),
    { env: { value: 'prod', lock: 'lockedEditable' } }
  )
  assert.deepEqual(diag, [])
  assert.deepEqual(
    syncElementMetadata({ env: { value: 'qa', lock: 'lockedEditable' } }, [def], 'Box', diag),
    { env: { value: 'dev', lock: 'lockedEditable' } }
  )
  assert.deepEqual(diag, ['Invalid value in Box.env, reset to default value.'])
})

test('null is always a valid value, whatever allowedValues says', () => {
  const diag = []
  const def = tag({ allowedValues: ['dev'], defaultValue: 'dev' })
  const out = syncElementMetadata(
    { env: { value: null, lock: 'lockedEditable' } },
    [def],
    'Box',
    diag
  )
  assert.deepEqual(out, { env: { value: null, lock: 'lockedEditable' } })
  assert.deepEqual(diag, [])
})

test('lockedStatic always takes the template value', () => {
  const diag = []
  const out = syncElementMetadata(
    { env: { value: 'x', lock: 'lockedStatic' } },
    [tag({ lock: 'lockedStatic', defaultValue: 'fixed' })],
    'Box',
    diag
  )
  assert.deepEqual(out, { env: { value: 'fixed', lock: 'lockedStatic' } })
  assert.equal(diag.length, 1)
})

test('a free entry on a newly required key is kept under a demoted key', () => {
  const diag = []
  const out = syncElementMetadata(
    { env: { value: 'mine' } },
    [tag({ defaultValue: 'dev' })],
    'Box',
    diag
  )
  assert.deepEqual(out, {
    env: { value: 'dev', lock: 'lockedEditable' },
    'env (demoted)': { value: 'mine' }
  })
  assert.match(diag[0], /previous free value moved to "env \(demoted\)"/)
})

test('a locked key that is no longer required becomes a free tag', () => {
  const diag = []
  const out = syncElementMetadata({ old: { value: 1, lock: 'lockedEditable' } }, [], 'Box', diag)
  assert.deepEqual(out, { old: { value: 1 } })
  assert.equal(diag.length, 1)
})

test('an element with no metadata and no template stays undefined', () => {
  assert.equal(syncElementMetadata(undefined, [], 'Box', []), undefined)
})
