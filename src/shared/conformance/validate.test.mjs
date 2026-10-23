import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateProfile } from './validate.ts'

const profilesDir = join(import.meta.dirname, '..', '..', '..', 'resources', 'profiles')
const load = (name) => JSON.parse(readFileSync(join(profilesDir, name), 'utf8'))

// A small valid profile to break one thing at a time.
const base = () => ({
  profileVersion: 1,
  name: 'Test',
  edges: { meaning: 'dependsOn', presence: 'optional' },
  roles: {
    a: { match: { tag: { key: 'role', value: 'a' } } },
    box: { match: { type: 'container' } }
  },
  rules: [{ id: 'r1', kind: 'forbiddenEdge', from: 'a', to: 'a' }]
})

const errorsOf = (profile) => validateProfile(profile).errors.join('\n')

test('every shipped profile except the template is valid', () => {
  const files = readdirSync(profilesDir).filter((f) => f.endsWith('.chdprofile.json'))
  assert.ok(files.length >= 3)
  for (const file of files) {
    if (file === 'template.chdprofile.json') continue
    const { errors } = validateProfile(load(file))
    assert.deepEqual(errors, [], file)
  }
})

test('the template is invalid until both edge values are chosen, and nothing else is wrong', () => {
  const { profile, errors } = validateProfile(load('template.chdprofile.json'))
  assert.equal(profile, null)
  assert.equal(errors.length, 2)
  assert.match(errors[0], /edges\.meaning is not chosen/)
  assert.match(errors[1], /edges\.presence is not chosen/)
  const chosen = load('template.chdprofile.json')
  chosen.edges = { meaning: 'flowsTo', presence: 'required' }
  assert.deepEqual(validateProfile(chosen).errors, [])
})

test('a valid profile is returned as it is', () => {
  const raw = base()
  const { profile, errors } = validateProfile(raw)
  assert.deepEqual(errors, [])
  assert.deepEqual(profile, raw)
})

test('"none" and a missing value are both not chosen', () => {
  const p = base()
  p.edges = { meaning: 'none' }
  const text = errorsOf(p)
  assert.match(text, /edges\.meaning is not chosen/)
  assert.match(text, /edges\.presence is not chosen/)
  delete p.edges
  assert.match(errorsOf(p), /edges is required/)
})

test('forbidden edges need an irrelevant meaning, and an irrelevant meaning allows no direction rules', () => {
  const p = base()
  p.edges = { meaning: 'dependsOn', presence: 'forbidden' }
  assert.match(errorsOf(p), /"forbidden" requires edges\.meaning "irrelevant"/)
  p.edges = { meaning: 'irrelevant', presence: 'optional' }
  assert.match(errorsOf(p), /"forbiddenEdge" needs a direction/)
  p.rules = [{ id: 'size', kind: 'maxElements', of: '*', max: 3 }]
  assert.deepEqual(validateProfile(p).errors, [])
  p.edges = { meaning: 'irrelevant', presence: 'forbidden' }
  p.rules = [{ id: 'l', kind: 'requiredProperty', each: '@edges', property: 'label' }]
  assert.match(errorsOf(p), /edges are forbidden/)
})

test('an unknown key is an error at every level', () => {
  const p = base()
  p.extra = 1
  p.edges.mode = 'x'
  p.roles.a.match.tagg = {}
  p.rules[0].mesage = 'typo'
  const text = errorsOf(p)
  for (const key of ['extra', 'mode', 'tagg', 'mesage']) assert.match(text, new RegExp(`"${key}"`))
})

test('the version, name and descriptions are checked', () => {
  const p = base()
  p.profileVersion = 2
  p.name = '  '
  p.description = 5
  const text = errorsOf(p)
  assert.match(text, /profileVersion must be 1/)
  assert.match(text, /name is required/)
  assert.match(text, /description must be text/)
  assert.match(errorsOf([]), /must be a JSON object/)
})

test('role problems: no match, bad type, bad tag, bad name, duplicate after normalising', () => {
  const p = base()
  p.roles = {
    empty: { match: {} },
    typed: { match: { type: 'line' } },
    tagged: { match: { tag: { key: '' } } },
    listed: { match: { tag: { key: 'k', value: [] } } },
    'bad name': { match: { type: 'entity' } },
    Port: { match: { type: 'entity' } },
    port: { match: { type: 'entity' } }
  }
  p.rules = []
  const text = errorsOf(p)
  assert.match(text, /Role "empty": match needs at least one/)
  assert.match(text, /Role "typed" match: type must be one of/)
  assert.match(text, /Role "tagged" match: tag\.key is required/)
  assert.match(text, /Role "listed" match: tag\.value must be text/)
  assert.match(text, /Role "bad name": a name uses only/)
  assert.match(text, /Role "port": the name is used twice/)
})

test('insideRole must name a role and must not loop', () => {
  const p = base()
  p.roles = {
    x: { match: { insideRole: 'y' } },
    y: { match: { insideRole: 'x' } },
    z: { match: { insideRole: 'nowhere' } }
  }
  p.rules = []
  const text = errorsOf(p)
  assert.match(text, /inside "nowhere", which is not a role/)
  assert.match(text, /inside each other in a loop/)
})

test('rule problems: ids, kind, severity, role references, kind-specific fields', () => {
  const p = base()
  p.rules = [
    { id: 'dup', kind: 'forbiddenEdge', from: 'a', to: 'a' },
    { id: 'DUP', kind: 'forbiddenEdge', from: 'a', to: 'ghost', severity: 'fatal' },
    { id: 'no kind', kind: 'wat' },
    { id: 'req', kind: 'requiredEdge', each: 'a', edge: 'sideways', with: '*' },
    { id: 'in', kind: 'containment', each: 'a', mustBeInside: 'box', mustNotBeInside: 'box' },
    { id: 'in2', kind: 'containment', each: 'a', mustBeInside: '*' },
    { id: 'prop', kind: 'requiredProperty', each: 'a', property: { tag: '' } },
    { id: 'max', kind: 'maxElements', of: 'a', max: 0 },
    { kind: 'forbiddenEdge', from: 'a', to: 'a' }
  ]
  const text = errorsOf(p)
  assert.match(text, /Rule "DUP": the id is used twice/)
  assert.match(text, /"to" names "ghost", which is not a role/)
  assert.match(text, /severity must be one of/)
  assert.match(text, /kind must be one of/)
  assert.match(text, /edge must be one of/)
  assert.match(text, /give exactly one of "mustBeInside" and "mustNotBeInside"/)
  assert.match(text, /"mustBeInside" needs a role, not "\*"/)
  assert.match(text, /property must be "label" or/)
  assert.match(text, /max must be a whole number of at least 1/)
  assert.match(text, /Rule 9: id is required/)
})

test('role references are normalised like everything else', () => {
  const p = base()
  p.rules = [{ id: 'r', kind: 'forbiddenEdge', from: ' A ', to: 'Box' }]
  assert.deepEqual(validateProfile(p).errors, [])
})
