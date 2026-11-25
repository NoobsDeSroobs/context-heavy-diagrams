import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_STENCIL_KIND,
  END_OUTCOMES,
  endOutcomeOf,
  endReachOf,
  flowPositionOf,
  STENCIL_KINDS,
  STENCIL_MARK_PATHS,
  stencilDoubleBorder,
  stencilKind,
  stencilLabelInsets,
  stencilLabelOutside,
  stencilMarkBox,
  stencilMarkOf,
  stencilSearchText,
  stencilLightColors,
  stencilSolid,
  stencilStyle
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
  assert.equal(stencilLabelOutside('branch-exclusive'), true)
  assert.equal(stencilLabelOutside('event-start'), true)
})

test('BPMN terms are search keywords, not names', () => {
  assert.match(stencilSearchText('branch-exclusive'), /gateway/)
  for (const kind of STENCIL_KINDS) {
    assert.doesNotMatch(kind.name, /bpmn|gateway/i)
  }
})

test('an id is the base word first and the subtype after, so related kinds sort together', () => {
  for (const kind of STENCIL_KINDS) assert.match(kind.id, /^[a-z]+(-[a-z]+)*$/)
  const steps = STENCIL_KINDS.filter((k) => k.group === 'Steps').map((k) => k.id)
  assert.ok(steps.every((id) => id === 'step' || id.startsWith('step-')))
  const decisions = STENCIL_KINDS.filter((k) => k.group === 'Decisions').map((k) => k.id)
  assert.deepEqual(decisions, ['branch-exclusive', 'branch-inclusive'])
  const parallel = STENCIL_KINDS.filter((k) => k.group === 'Parallel').map((k) => k.id)
  assert.deepEqual(parallel, ['branch-parallel', 'branch-all', 'branch-one'])
  const events = STENCIL_KINDS.filter((k) => k.group === 'Events').map((k) => k.id)
  assert.deepEqual(events, [
    'event-start',
    'event',
    'event-timer',
    'event-message',
    'event-human',
    'event-end'
  ])
})

test('every mark a kind uses has a drawing, and a step keeps its mark in the slot on the right', () => {
  for (const kind of STENCIL_KINDS) {
    if (kind.mark) assert.ok(STENCIL_MARK_PATHS[kind.mark], kind.id)
  }
  const user = stencilKind('step-human')
  const at = stencilMarkBox(user, user.size.width, user.size.height)
  assert.ok(at.x > user.size.width / 2 && at.x + at.size <= user.size.width)
  const small = stencilMarkBox(user, 22, 14, true)
  assert.ok(small.size < 14 && small.x + small.size <= 22, 'a swatch mark stays inside the swatch')
  assert.deepEqual(stencilLabelInsets('step-human'), { left: 28, right: 28 })
  assert.deepEqual(stencilLabelInsets('step'), { left: 28, right: 0 })
})

test('the BPMN names of the new kinds find them', () => {
  const finds = (id, word) => stencilSearchText(id).toLowerCase().includes(word)
  assert.ok(finds('step-human', 'user task'))
  assert.ok(finds('step-automatic', 'service task'))
  assert.ok(finds('step-sub-flow', 'call activity'))
  assert.ok(finds('step-repeat', 'loop'))
  assert.ok(finds('branch-inclusive', 'inclusive gateway'))
  assert.ok(finds('event', 'intermediate event'))
  assert.ok(finds('event-timer', 'timer'))
  assert.ok(finds('event-message', 'message'))
})

test('the old id of the human step is read as the new one', () => {
  assert.equal(stencilKind('step-user').id, 'step-human')
  assert.equal(stencilKind('step-user').name, 'Human step')
})

test('only an end has an outcome and a reach: the outcome sets its mark, a reach of the flow a solid disc', () => {
  const end = stencilKind('event-end')
  assert.equal(stencilMarkOf(end, {}), 'check')
  for (const outcome of END_OUTCOMES) {
    assert.equal(stencilMarkOf(end, { outcome: outcome.id }), outcome.mark)
    assert.ok(STENCIL_MARK_PATHS[outcome.mark], outcome.id)
  }
  assert.equal(stencilMarkOf(end, { outcome: 'from-the-future' }), 'check', 'unknown is success')
  assert.equal(endOutcomeOf(undefined), 'success')
  assert.equal(endReachOf('from-the-future'), 'path')
  assert.equal(stencilSolid(end, {}), false)
  assert.equal(stencilSolid(end, { reach: 'flow' }), true)
  const step = stencilKind('step-human')
  assert.equal(stencilMarkOf(step, { outcome: 'failed' }), 'person', 'a step ignores an outcome')
  assert.equal(stencilSolid(step, { reach: 'flow' }), false)
})

test('the light theme has its own default colours, used only where the node has none', () => {
  assert.equal(stencilStyle('step', undefined)?.fill, '#345a60')
  assert.deepEqual(stencilLightColors('step', undefined), { fill: '#a5c8ce', stroke: '#3b6e77' })
  assert.deepEqual(stencilLightColors('branch-exclusive', undefined), { fill: '#f7edd6' })
  assert.deepEqual(stencilLightColors('step', { fill: '#ff0000' }), { stroke: '#3b6e77' })
})

test('the parallel kinds share a plum of their own, away from the decisions in lightness in both themes', () => {
  for (const id of ['branch-parallel', 'branch-all', 'branch-one']) {
    assert.equal(stencilStyle(id, undefined)?.fill, '#2f0f34', id)
    assert.deepEqual(stencilLightColors(id, undefined), { fill: '#ae62b3', stroke: '#6b2a72' }, id)
  }
  // Families told apart without colour: at least 20 grey levels (of 255) between neighbours.
  const grey = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return 0.299 * r + 0.587 * g + 0.114 * b
  }
  const families = ['event-start', 'branch-parallel', 'step', 'branch-exclusive']
  const dark = families.map((id) => grey(stencilStyle(id, undefined).fill)).sort((a, b) => a - b)
  const light = families
    .map((id) => grey(stencilLightColors(id, undefined).fill))
    .sort((a, b) => a - b)
  for (const levels of [dark, light]) {
    for (let i = 1; i < levels.length; i += 1)
      assert.ok(levels[i] - levels[i - 1] >= 20, String(levels))
  }
})

test('an event that starts a flow has one ring and one in the flow two; the plain start and the end have no position', () => {
  for (const id of ['event', 'event-timer', 'event-message', 'event-human']) {
    const kind = stencilKind(id)
    assert.equal(kind.positioned, true, id)
    assert.equal(stencilDoubleBorder(kind, {}), true, `${id} defaults to in the flow`)
    assert.equal(stencilDoubleBorder(kind, { flowPosition: 'in-flow' }), true)
    assert.equal(stencilDoubleBorder(kind, { flowPosition: 'start' }), false)
    assert.equal(
      stencilDoubleBorder(kind, { flowPosition: 'from-the-future' }),
      true,
      'unknown is in the flow'
    )
  }
  assert.equal(flowPositionOf(undefined), 'in-flow')
  for (const id of ['event-start', 'event-end', 'step', 'branch-parallel']) {
    const kind = stencilKind(id)
    assert.ok(!kind.positioned, id)
    assert.equal(
      stencilDoubleBorder(kind, { flowPosition: 'start' }),
      false,
      `${id} is drawn as itself`
    )
  }
})
