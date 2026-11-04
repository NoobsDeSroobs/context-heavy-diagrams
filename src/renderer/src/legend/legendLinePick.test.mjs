// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legendLineFromEdgeStyle } from './legendLinePick.ts'

const defaults = { lineStyle: 'solid', startMarker: 'none', endMarker: 'arrowClosed' }
const flip = (color, theme) => `${color}@${theme}`

test('an explicit style is copied, with the colour as shown in the current theme', () => {
  const look = legendLineFromEdgeStyle(
    { stroke: '#f00', lineStyle: 'dashed', startMarker: 'circle', endMarker: 'diamond' },
    'light',
    flip,
    defaults
  )
  assert.deepEqual(look, {
    color: '#f00@light',
    lineStyle: 'dashed',
    startMarker: 'circle',
    endMarker: 'diamond'
  })
})

test('an unstyled edge becomes the built-in look, with no colour so it follows the theme', () => {
  for (const style of [undefined, {}]) {
    const look = legendLineFromEdgeStyle(style, 'dark', flip, defaults)
    assert.deepEqual(look, { lineStyle: 'solid', startMarker: 'none', endMarker: 'arrowClosed' })
    assert.equal('color' in look, false)
  }
})

test('an explicit "none" marker is kept, not replaced by the default arrow', () => {
  const look = legendLineFromEdgeStyle({ endMarker: 'none' }, 'dark', flip, defaults)
  assert.equal(look.endMarker, 'none')
})

test('width and opacity are not part of a legend entry', () => {
  const look = legendLineFromEdgeStyle(
    { strokeWidth: 5, strokeOpacity: 40, labelPosition: 0.2 },
    'dark',
    flip,
    defaults
  )
  assert.deepEqual(Object.keys(look).sort(), ['endMarker', 'lineStyle', 'startMarker'])
})

test('an edge’s animation and dash settings are copied, and an edge without them adds none', () => {
  const motion = {
    animation: 'pulse',
    animationSpeed: 2,
    animationDirection: 'reverse',
    pulseDistance: 40,
    dashLength: 3,
    dashGap: 9
  }
  const look = legendLineFromEdgeStyle(
    { stroke: '#f00', lineStyle: 'dotted', ...motion },
    'dark',
    flip,
    defaults
  )
  assert.deepEqual(
    { ...look },
    {
      color: '#f00@dark',
      lineStyle: 'dotted',
      startMarker: 'none',
      endMarker: 'arrowClosed',
      ...motion
    }
  )
  const still = legendLineFromEdgeStyle({ stroke: '#f00' }, 'dark', flip, defaults)
  for (const key of Object.keys(motion)) assert.equal(key in still, false, key)
})
