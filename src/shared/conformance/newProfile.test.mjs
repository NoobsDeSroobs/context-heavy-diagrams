import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { newProfileText, profileNameFromPath, withProfileSuffix } from './newProfile.ts'
import { validateProfile } from './validate.ts'

const template = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'resources', 'profiles', 'template.chdprofile.json'),
  'utf8'
)

test('whatever the user types ends up as one .chdprofile.json file', () => {
  for (const typed of ['mine', 'mine.json', 'mine.chdprofile.json', 'mine.CHDPROFILE.JSON']) {
    assert.match(
      withProfileSuffix(`C:\\rules\\${typed}`),
      /mine(\.chdprofile\.json|\.CHDPROFILE\.JSON)$/i
    )
  }
  assert.equal(withProfileSuffix('/rules/mine.json'), '/rules/mine.chdprofile.json')
  assert.equal(withProfileSuffix('/rules/mine'), '/rules/mine.chdprofile.json')
  assert.equal(withProfileSuffix('/rules/mine.chdprofile.json'), '/rules/mine.chdprofile.json')
})

test('the profile is named after its file', () => {
  assert.equal(profileNameFromPath('/rules/my-style.chdprofile.json'), 'my style')
  assert.equal(profileNameFromPath('C:\\rules\\Team_Rules.json'), 'Team Rules')
  assert.equal(profileNameFromPath('/rules/.chdprofile.json'), 'My architecture style')
})

test('a new profile is the template with only its name changed', () => {
  const text = newProfileText(template, 'my style')
  assert.ok(text.endsWith('\n'))
  const made = JSON.parse(text)
  const original = JSON.parse(template)
  assert.equal(made.name, 'my style')
  assert.deepEqual({ ...made, name: original.name }, original)
  assert.deepEqual(Object.keys(made), Object.keys(original))
})

test('a new profile is not usable until its edges are chosen', () => {
  const { errors } = validateProfile(JSON.parse(newProfileText(template, 'x')))
  assert.equal(errors.length, 2)
})
