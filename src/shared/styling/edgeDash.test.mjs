import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_DASH_PART,
  MIN_DASH_PART,
  dasharrayOf,
  dashPattern,
  dashPeriod,
  knownDashPart
} from './edgeDash.ts'

test('the line styles draw the dash patterns they always did', () => {
  assert.equal(dasharrayOf(dashPattern({})), undefined)
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'solid' })), undefined)
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dashed' })), '8 6')
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dotted' })), '2 4')
})

test('a stored dash length and gap change a dashed or dotted line, one at a time or both', () => {
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dashed', dashLength: 20 })), '20 6')
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dotted', dashGap: 10 })), '2 10')
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dashed', dashLength: 3, dashGap: 9 })), '3 9')
})

test('a solid line stays solid whatever dash values are stored, unless it is flowing', () => {
  assert.equal(
    dasharrayOf(dashPattern({ lineStyle: 'solid', dashLength: 20, dashGap: 5 })),
    undefined
  )
  assert.equal(dasharrayOf(dashPattern({ dashLength: 20 })), undefined)
  // flowing makes it dashed, with the stored values on top of the default pattern
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'solid' }, true)), '8 6')
  assert.equal(dasharrayOf(dashPattern({ dashLength: 20, dashGap: 5 }, true)), '20 5')
})

test('a stored length is drawn within a range, and a junk value is the style’s own', () => {
  assert.equal(knownDashPart(undefined), undefined)
  assert.equal(knownDashPart('long'), undefined)
  assert.equal(knownDashPart(NaN), undefined)
  assert.equal(knownDashPart(0), MIN_DASH_PART)
  assert.equal(knownDashPart(-4), MIN_DASH_PART)
  assert.equal(knownDashPart(1e9), MAX_DASH_PART)
  assert.equal(dasharrayOf(dashPattern({ lineStyle: 'dashed', dashLength: 'long' })), '8 6')
})

test('one repeat of the pattern is the dash and the gap', () => {
  assert.equal(dashPeriod({ dash: 8, gap: 6 }), 14)
})
