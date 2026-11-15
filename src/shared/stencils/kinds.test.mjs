import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_STENCIL_KIND,
  STENCIL_KINDS,
  stencilKind,
  stencilLabelOutside,
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
  assert.equal(stencilLabelOutside('decision'), true)
  assert.equal(stencilLabelOutside('start'), true)
})

test('BPMN terms are search keywords, not names', () => {
  assert.match(stencilSearchText('decision'), /gateway/)
  for (const kind of STENCIL_KINDS) {
    assert.doesNotMatch(kind.name, /bpmn|gateway|event/i)
  }
})
