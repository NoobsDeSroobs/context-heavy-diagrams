// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BETA_FEATURES,
  betaAnswer,
  betaNotes,
  betaOfKind,
  isBetaOn,
  kindIsOffered,
  kindListText,
  normalizeFeatures,
  overdueBetas,
  registryProblems,
  unmarkedBetas
} from './features.ts'
import { DEFAULT_PREFERENCES, normalizePreferences } from '../preferences/preferences.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const LOOP = {
  id: 'loops',
  label: 'Loop kinds',
  description: 'Steps that say how they repeat.',
  reviewBy: '2027-03-01',
  kinds: ['step-loop']
}
const BADGE = {
  id: 'badge',
  label: 'Corner badge',
  description: 'A badge on an element.',
  reviewBy: '2027-02-01',
  usedBy: (diagram) => diagram.nodes.some((n) => n.data.badge !== undefined)
}
const REGISTRY = [LOOP, BADGE]

const diagramWith = (...nodes) => ({ nodes: nodes.map((data) => ({ id: 'n', data })), edges: [] })

test('a feature never switched on is off, and an unknown id is dropped', () => {
  assert.deepEqual(normalizeFeatures(undefined, REGISTRY), { loops: false, badge: false })
  assert.deepEqual(normalizeFeatures({ loops: true, gone: true, badge: 'yes' }, REGISTRY), {
    loops: true,
    badge: false
  })
  assert.deepEqual(normalizeFeatures('nonsense', REGISTRY), { loops: false, badge: false })
})

test('the preferences carry the flags, seeded with their defaults at every boundary', () => {
  assert.deepEqual(DEFAULT_PREFERENCES.features, {})
  assert.deepEqual(normalizePreferences({}).features, {})
  // With the registry as shipped, a stored id it does not list is dropped.
  assert.deepEqual(normalizePreferences({ features: { removed: true } }).features, {})
})

test('a beta is on only when its flag is true', () => {
  assert.equal(isBetaOn({ loops: true }, 'loops', REGISTRY), true)
  assert.equal(isBetaOn({ loops: false }, 'loops', REGISTRY), false)
  assert.equal(isBetaOn({}, 'loops', REGISTRY), false)
  assert.equal(isBetaOn({ other: true }, 'other', REGISTRY), false)
})

test('a beta kind is offered only while its feature is on; other kinds always are', () => {
  assert.equal(betaOfKind('step-loop', REGISTRY)?.id, 'loops')
  assert.equal(betaOfKind('step', REGISTRY), undefined)
  assert.equal(kindIsOffered('step', {}, REGISTRY), true)
  assert.equal(kindIsOffered('step-loop', {}, REGISTRY), false)
  assert.equal(kindIsOffered('step-loop', { loops: false }, REGISTRY), false)
  assert.equal(kindIsOffered('step-loop', { loops: true }, REGISTRY), true)
})

test('what an assistant reads marks a beta kind', () => {
  assert.equal(kindListText(['step', 'step-loop'], REGISTRY), 'step, step-loop (beta)')
  assert.equal(kindListText(['step', 'decision']), 'step, decision')
})

test('a diagram that uses a beta is told so, in a note and not an error', () => {
  assert.deepEqual(betaNotes(diagramWith({ kind: 'step' }), REGISTRY), [])
  assert.deepEqual(betaAnswer(diagramWith({ kind: 'step' }), REGISTRY), {})
  const looped = betaNotes(diagramWith({ kind: 'step-loop' }), REGISTRY)
  assert.equal(looped.length, 1)
  assert.match(looped[0], /Loop kinds/)
  assert.match(looped[0], /2027-03-01/)
  const badged = betaAnswer(diagramWith({ badge: 1 }), REGISTRY)
  assert.equal(badged.beta?.length, 1)
  assert.match(badged.beta[0], /Corner badge/)
})

test('a beta is overdue the day after its review date', () => {
  assert.deepEqual(overdueBetas(REGISTRY, new Date('2027-02-01T12:00:00Z')), [])
  assert.deepEqual(
    overdueBetas(REGISTRY, new Date('2027-02-02T00:00:00Z')).map((f) => f.id),
    ['badge']
  )
  assert.equal(overdueBetas(REGISTRY, new Date('2027-03-02T00:00:00Z')).length, 2)
})

test('the registry check finds a duplicate id, a bad date and a kind claimed twice', () => {
  assert.deepEqual(registryProblems(REGISTRY), [])
  const problems = registryProblems([
    LOOP,
    { ...LOOP, label: 'Again' },
    { ...BADGE, reviewBy: 'soon' }
  ])
  assert.equal(problems.length, 3)
  assert.match(problems.join('\n'), /used twice/)
  assert.match(problems.join('\n'), /not a date/)
  assert.match(problems.join('\n'), /step-loop/)
})

test('a spec text must mark each beta by name', () => {
  assert.deepEqual(unmarkedBetas(REGISTRY, ''), ['loops: step-loop', 'badge: Corner badge'])
  assert.deepEqual(
    unmarkedBetas(REGISTRY, '- `step-loop` (beta): repeats\nCorner badge (beta) is a mark'),
    []
  )
  // The name and "(beta)" on different lines does not count.
  assert.equal(unmarkedBetas([LOOP], 'step-loop\n(beta)').length, 1)
})

// The shipped registry: the rules every beta has to keep.
test('the shipped betas are well formed', () => {
  assert.deepEqual(registryProblems(BETA_FEATURES), [])
})

test('no shipped beta is past its review date: delete, postpone or promote it', () => {
  const overdue = overdueBetas(BETA_FEATURES, new Date()).map((f) => `${f.id} (${f.reviewBy})`)
  assert.deepEqual(overdue, [])
})

test('every shipped beta is marked beta in the spec an assistant reads', () => {
  for (const file of [
    'resources/ai/skills/chd-diagrams/references/field-reference.md',
    'docs/file-format.md'
  ]) {
    const text = readFileSync(join(root, file), 'utf-8')
    assert.deepEqual(unmarkedBetas(BETA_FEATURES, text), [], file)
  }
})
