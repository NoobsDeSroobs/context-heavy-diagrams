import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_STENCIL_KIND,
  STENCIL_KINDS,
  STENCIL_MARK_PATHS,
  stencilKind,
  stencilLabelInsets,
  stencilLabelOutside,
  stencilMarkBox,
  stencilSearchText
} from './kinds.ts'

test('the kind ids are unique and the default is one of them', () => {
  const ids = STENCIL_KINDS.map((k) => k.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes(DEFAULT_STENCIL_KIND))
})

test('an unknown kind is drawn as a step', () => {
  assert.equal(stencilKind('from-the-future').id, 'step')
  assert.equal(stencilKind(undefined).id, 'step')
})

test('only the steps carry their label inside', () => {
  assert.equal(stencilLabelOutside('step'), false)
  assert.equal(stencilLabelOutside('exclusive-choice'), true)
  assert.equal(stencilLabelOutside('start-event'), true)
})

test('BPMN terms are search keywords, not names', () => {
  assert.match(stencilSearchText('exclusive-choice'), /gateway/)
  for (const kind of STENCIL_KINDS) {
    assert.doesNotMatch(kind.name, /bpmn|gateway/i)
  }
})

test('an id says what the kind is, general first, so related kinds sort together', () => {
  for (const kind of STENCIL_KINDS) assert.match(kind.id, /^[a-z]+(-[a-z]+)*$/)
  const steps = STENCIL_KINDS.filter((k) => k.group === 'Steps').map((k) => k.id)
  assert.ok(steps.every((id) => id === 'step' || id.startsWith('step-')))
  const events = STENCIL_KINDS.filter((k) => k.group === 'Events').map((k) => k.id)
  assert.deepEqual(events, ['start-event', 'event', 'timer-event', 'message-event', 'end-event'])
})

test('every mark a kind uses has a drawing, and a step keeps its mark in the slot on the right', () => {
  for (const kind of STENCIL_KINDS) {
    if (kind.mark) assert.ok(STENCIL_MARK_PATHS[kind.mark], kind.id)
  }
  const user = stencilKind('step-user')
  const at = stencilMarkBox(user, user.size.width, user.size.height)
  assert.ok(at.x > user.size.width / 2 && at.x + at.size <= user.size.width)
  const small = stencilMarkBox(user, 22, 14, true)
  assert.ok(small.size < 14 && small.x + small.size <= 22, 'a swatch mark stays inside the swatch')
  assert.deepEqual(stencilLabelInsets('step-user'), { left: 28, right: 28 })
  assert.deepEqual(stencilLabelInsets('step'), { left: 28, right: 0 })
})

test('the BPMN names of the new kinds find them', () => {
  const finds = (id, word) => stencilSearchText(id).toLowerCase().includes(word)
  assert.ok(finds('step-user', 'user task'))
  assert.ok(finds('step-automatic', 'service task'))
  assert.ok(finds('step-sub-flow', 'call activity'))
  assert.ok(finds('step-repeat', 'loop'))
  assert.ok(finds('inclusive-choice', 'inclusive gateway'))
  assert.ok(finds('event', 'intermediate event'))
  assert.ok(finds('timer-event', 'timer'))
  assert.ok(finds('message-event', 'message'))
})
