// Run with `npm test`. The persisted form of stories (ADR 0195): written when used, left out when
// empty, order kept, and read back unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagram, serializeDiagram } from './index.ts'

const file = (extra = {}) => ({ version: 1, nodes: [], edges: [], ...extra })

test('stories and their steps are written, and read back as written', () => {
  const stories = [
    {
      id: 'story-1',
      name: 'Integration',
      steps: [{ show: ['vis-1'] }, {}, { hide: ['vis-1'], show: ['vis-2'] }]
    }
  ]
  const back = parseDiagram(serializeDiagram(file({ stories })))
  assert.deepEqual(back.stories, stories)
})

test('the order of the stories and of their steps is kept', () => {
  const stories = [
    { id: 'z', name: 'Second by id', steps: [{ show: ['b'] }, { show: ['a'] }] },
    { id: 'a', name: 'First by id', steps: [] }
  ]
  const back = parseDiagram(serializeDiagram(file({ stories })))
  assert.deepEqual(
    back.stories.map((s) => s.id),
    ['z', 'a']
  )
  assert.deepEqual(back.stories[0].steps, [{ show: ['b'] }, { show: ['a'] }])
})

test('no stories, and empty lists in a step, are left out of the file', () => {
  assert.equal('stories' in JSON.parse(serializeDiagram(file({ stories: [] }))), false)
  const out = JSON.parse(
    serializeDiagram(file({ stories: [{ id: 's', name: 'S', steps: [{ show: [], hide: [] }] }] }))
  )
  assert.deepEqual(out.stories[0].steps, [{}])
})

test('an id repeated in one list of a step is written once', () => {
  const out = JSON.parse(
    serializeDiagram(file({ stories: [{ id: 's', name: 'S', steps: [{ show: ['a', 'a'] }] }] }))
  )
  assert.deepEqual(out.stories[0].steps[0].show, ['a'])
})
