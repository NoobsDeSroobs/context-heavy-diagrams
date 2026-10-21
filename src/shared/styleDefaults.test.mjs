// Run with `npm test`. The built-in default look is data (ADR 0117); these tests
// pin what the panel shows, what the CSS receives, and that the few places that
// still repeat a default (the React Flow fallback edge colour) cannot drift.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  NODE_STYLE_DEFAULTS,
  EDGE_STYLE_DEFAULTS,
  defaultStyleCssVars,
  displayColor,
  styledNodeType
} from './styleDefaults.ts'

// Same shape as the real helper in colorOpacity.ts, which tests can't import (extensionless imports).
const withOpacity = (color, pct) =>
  pct == null || pct >= 100 ? color : `color-mix(in srgb, ${color} ${pct}%, transparent)`

const flip = (color, theme) => (theme === 'light' ? `flipped(${color})` : color)

test('a stored colour is shown flipped for the theme; an unset one is the built-in default', () => {
  const fallback = { dark: '#222222', light: '#f8f8f8' }
  assert.equal(displayColor('#ff0000', fallback, 'light', flip), 'flipped(#ff0000)')
  assert.equal(displayColor('#ff0000', fallback, 'dark', flip), '#ff0000')
  assert.equal(displayColor(undefined, fallback, 'light', flip), '#f8f8f8')
  assert.equal(displayColor(undefined, fallback, 'dark', flip), '#222222')
})

test('an unknown or missing node type is treated as an entity', () => {
  assert.equal(styledNodeType(undefined), 'entity')
  assert.equal(styledNodeType('line'), 'entity')
  assert.equal(styledNodeType('container'), 'container')
  assert.equal(styledNodeType('text'), 'text')
})

test('the entity look is today’s look: surface fill, grey 1.5px border, 13px text', () => {
  const d = NODE_STYLE_DEFAULTS.entity
  assert.equal(d.fill.dark, '#222222')
  assert.equal(d.stroke.dark, '#515c67')
  assert.equal(d.strokeWidth, 1.5)
  assert.equal(d.fontSize, 13)
  assert.equal(d.textAlign, 'center')
})

test('a container is see-through and a text node has no visible border', () => {
  assert.equal(NODE_STYLE_DEFAULTS.container.fillOpacity, 0)
  assert.equal(NODE_STYLE_DEFAULTS.text.fillOpacity, 0)
  assert.equal(NODE_STYLE_DEFAULTS.text.strokeWidth, 0)
  assert.equal(NODE_STYLE_DEFAULTS.text.strokeOpacity, 0)
})

test('the CSS variables carry the values for the current theme', () => {
  const dark = defaultStyleCssVars('dark', withOpacity)
  const light = defaultStyleCssVars('light', withOpacity)
  assert.equal(dark['--default-entity-fill'], '#222222')
  assert.equal(light['--default-entity-fill'], '#f8f8f8')
  assert.equal(dark['--default-entity-stroke-width'], '1.5px')
  assert.equal(dark['--default-container-font-size'], '12px')
  assert.match(dark['--default-container-fill'], /^color-mix\(in srgb, #222222 0%, transparent\)$/)
  assert.match(
    dark['--default-entity-font-color'],
    /^color-mix\(in srgb, #fffff5 86%, transparent\)$/
  )
})

test('every node type gets the same set of CSS variables', () => {
  const names = (type) =>
    Object.keys(defaultStyleCssVars('dark', withOpacity))
      .filter((k) => k.startsWith(`--default-${type}-`))
      .map((k) => k.replace(`--default-${type}-`, ''))
      .sort()
  assert.deepEqual(names('container'), names('entity'))
  assert.deepEqual(names('text'), names('entity'))
})

test('React Flow’s fallback edge colour in base.css equals the data (drift guard)', () => {
  // Comments are stripped first: base.css quotes React Flow's own stock colour in one.
  const css = readFileSync(
    new URL('../renderer/src/assets/base.css', import.meta.url),
    'utf8'
  ).replace(/\/\*[\s\S]*?\*\//g, '')
  const colours = [...css.matchAll(/--xy-edge-stroke-default:\s*(#[0-9a-fA-F]{6})/g)].map((m) =>
    m[1].toLowerCase()
  )
  // Dark block first, then the OS-light block and the explicit light block.
  assert.deepEqual(colours, [
    EDGE_STYLE_DEFAULTS.stroke.dark,
    EDGE_STYLE_DEFAULTS.stroke.light,
    EDGE_STYLE_DEFAULTS.stroke.light
  ])
})
