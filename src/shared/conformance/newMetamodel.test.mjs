import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { newMetamodelText, metamodelNameFromPath, withMetamodelSuffix } from './newMetamodel.ts'
import { validateMetamodel } from './validate.ts'

const template = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'resources', 'metamodels', 'template.chdmeta'),
  'utf8'
)

test('whatever the user types ends up as one .chdmeta file', () => {
  for (const typed of [
    'mine',
    'mine.json',
    'mine.chdmeta',
    'mine.CHDMETA',
    'mine.chdprofile.json'
  ]) {
    assert.match(withMetamodelSuffix(`C:\\rules\\${typed}`), /mine(\.chdmeta|\.CHDMETA)$/i)
  }
  assert.equal(withMetamodelSuffix('/rules/mine.json'), '/rules/mine.chdmeta')
  assert.equal(withMetamodelSuffix('/rules/mine.chdprofile.json'), '/rules/mine.chdmeta')
  assert.equal(withMetamodelSuffix('/rules/mine'), '/rules/mine.chdmeta')
  assert.equal(withMetamodelSuffix('/rules/mine.chdmeta'), '/rules/mine.chdmeta')
})

test('the metamodel is named after its file', () => {
  assert.equal(metamodelNameFromPath('/rules/my-style.chdmeta'), 'my style')
  assert.equal(metamodelNameFromPath('C:\\rules\\Team_Rules.json'), 'Team Rules')
  assert.equal(metamodelNameFromPath('/rules/.chdmeta'), 'My metamodel')
})

test('a new metamodel is the template with only its name changed', () => {
  const text = newMetamodelText(template, 'my style')
  assert.ok(text.endsWith('\n'))
  const made = JSON.parse(text)
  const original = JSON.parse(template)
  assert.equal(made.name, 'my style')
  assert.deepEqual({ ...made, name: original.name }, original)
  assert.deepEqual(Object.keys(made), Object.keys(original))
})

test('a new metamodel is not usable until its edges are chosen', () => {
  const { errors } = validateMetamodel(JSON.parse(newMetamodelText(template, 'x')))
  assert.equal(errors.length, 2)
})
