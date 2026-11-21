// Run with `npm test`. The persisted form of stories (ADR 0195): written when used, left out when
// empty, order kept, and read back unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiagram, serializeDiagram } from './index.ts'

const file = (extra = {}) => ({ version: 1, nodes: [], edges: [], ...extra })
const show = (set) => ({ action: 'show', set })
const hide = (set) => ({ action: 'hide', set })

test('stories and their actions are written, and read back as written', () => {
  const stories = [
    {
      id: 'story-1',
      name: 'Integration',
      steps: [{ actions: [show('vis-1')] }, {}, { actions: [hide('vis-1'), show('vis-2')] }]
    }
  ]
  const back = parseDiagram(serializeDiagram(file({ stories })))
  assert.deepEqual(back.stories, stories)
})

test('the order of the stories, the steps and the actions is kept', () => {
  const stories = [
    {
      id: 'z',
      name: 'Second by id',
      steps: [{ actions: [show('b'), hide('a'), show('a')] }, { actions: [show('a')] }]
    },
    { id: 'a', name: 'First by id', steps: [] }
  ]
  const back = parseDiagram(serializeDiagram(file({ stories })))
  assert.deepEqual(
    back.stories.map((s) => s.id),
    ['z', 'a']
  )
  assert.deepEqual(back.stories[0].steps, stories[0].steps)
})

test('no stories, and an empty list of actions, are left out of the file', () => {
  assert.equal('stories' in JSON.parse(serializeDiagram(file({ stories: [] }))), false)
  const out = JSON.parse(
    serializeDiagram(file({ stories: [{ id: 's', name: 'S', steps: [{ actions: [] }] }] }))
  )
  assert.deepEqual(out.stories[0].steps, [{}])
})

test('an action a later version wrote keeps its own fields, in a fixed order', () => {
  const stories = [
    {
      id: 's',
      name: 'S',
      steps: [{ actions: [{ set: 'vis-1', factor: 2, action: 'grow', ease: 'out' }] }]
    }
  ]
  const text = serializeDiagram(file({ stories }))
  assert.deepEqual(parseDiagram(text).stories[0].steps[0].actions[0], {
    action: 'grow',
    set: 'vis-1',
    ease: 'out',
    factor: 2
  })
  assert.equal(serializeDiagram(parseDiagram(text)), text)
})

test('the start state is written before the steps, and left out when it has no actions', () => {
  const stories = [
    {
      id: 's',
      name: 'Framed',
      start: { actions: [show('vis-1'), show('vis-2')] },
      steps: [{ actions: [show('vis-3')] }]
    },
    { id: 't', name: 'Plain', start: { actions: [] }, steps: [] }
  ]
  const text = serializeDiagram(file({ stories }))
  const back = parseDiagram(text)
  assert.deepEqual(back.stories[0].start, stories[0].start)
  assert.equal('start' in back.stories[1], false)
  assert.ok(text.indexOf('"start"') < text.indexOf('"steps"'))
  assert.equal(serializeDiagram(parseDiagram(text)), text)
})
