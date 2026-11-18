// Run with `npm test`. A pack's icon in the exports (ADR 0188): its own viewBox and colours are
// kept, `currentColor` becomes the text colour of the export.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iconParts } from './iconMarkup.ts'
import { DEFAULT_SVG_EXPORT_OPTIONS, iconKey, renderDiagramSvg } from './renderDiagram.ts'
import { renderDiagramDrawio } from './drawio.ts'

const TABLER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="icon icon-tabler" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16" /></svg>'
const VENDOR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" width="64" height="48"><defs><linearGradient id="g"><stop offset="0" stop-color="#f90"/></linearGradient></defs><rect width="64" height="48" fill="url(#g)"/></svg>'

test('the root keeps how it paints and its view box, not its size or class', () => {
  const parts = iconParts(TABLER, '#222')
  assert.equal(parts.viewBox, '0 0 24 24')
  assert.equal(parts.attrs, ' fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"')
  assert.equal(parts.inner, '<path d="M4 4h16" />')
})

test('a pack with another view box keeps it, and a missing one comes from the size', () => {
  assert.equal(iconParts(VENDOR, '#222').viewBox, '0 0 64 48')
  assert.equal(
    iconParts('<svg width="32" height="16"><path d="M0 0"/></svg>', '#222').viewBox,
    '0 0 32 16'
  )
  assert.equal(iconParts('<svg><path d="M0 0"/></svg>', '#222').viewBox, '0 0 24 24')
  assert.equal(iconParts('<svg viewBox="0 0 0 0"><path/></svg>', '#222').viewBox, '0 0 24 24')
})

test('colours of its own are kept and markup that is not an svg is refused', () => {
  assert.ok(iconParts(VENDOR, '#222').inner.includes('stop-color="#f90"'))
  assert.equal(iconParts('<div></div>', '#222'), null)
})

const diagram = (icon) => ({
  version: 1,
  nodes: [
    {
      id: 'a',
      type: 'entity',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 60 },
      data: { label: 'a', icons: { topLeft: icon } }
    }
  ],
  edges: []
})
const installed = { source: 'installed', pack: 'Acme', path: 'Core/box.svg' }

test('the SVG export draws an installed icon in its own view box', () => {
  const icons = new Map([[iconKey(installed), { kind: 'svg', markup: VENDOR }]])
  const svg = renderDiagramSvg(diagram(installed), { ...DEFAULT_SVG_EXPORT_OPTIONS, icons })
  assert.match(svg, /<svg x="[^"]+" y="[^"]+" width="18" height="18" viewBox="0 0 64 48"/)
  assert.ok(svg.includes('url(#g)'))
})

test('the SVG export gives a line icon the text colour', () => {
  const icons = new Map([[iconKey(installed), { kind: 'svg', markup: TABLER }]])
  const svg = renderDiagramSvg(diagram(installed), { ...DEFAULT_SVG_EXPORT_OPTIONS, icons })
  assert.ok(!svg.includes('currentColor'))
  assert.match(svg, /viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="#/)
})

test('the draw.io export draws an installed icon in its own view box', () => {
  const icons = new Map([[iconKey(installed), { kind: 'svg', markup: VENDOR }]])
  const { xml } = renderDiagramDrawio(diagram(installed), { theme: 'light', icons })
  const encoded = /image=data:image\/svg\+xml,([A-Za-z0-9+/=]+);/.exec(xml)[1]
  const svg = Buffer.from(encoded, 'base64').toString()
  assert.ok(svg.includes('viewBox="0 0 64 48"'))
  assert.ok(svg.includes('stop-color="#f90"'))
})
