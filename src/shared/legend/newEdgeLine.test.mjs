// Run with `npm test`. The legend line new edges are drawn with (ADR 0196).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edgeStyleFromLegendLine, newEdgeLineEntry, withNewEdgeLine } from './newEdgeLine.ts'

const dataFlow = {
  id: 'data',
  kind: 'line',
  label: 'Data flow',
  color: '#4a90d9',
  lineStyle: 'solid',
  startMarker: 'none',
  endMarker: 'arrowClosed'
}
const event = { id: 'event', kind: 'line', label: 'Event', lineStyle: 'dashed', animation: 'flow' }
const dot = { id: 'dot', kind: 'entity', label: 'GDPR', color: '#e6194b' }

test('the entry new edges follow is the first marked line, and nothing marks an entity', () => {
  assert.equal(newEdgeLineEntry(undefined), undefined)
  assert.equal(newEdgeLineEntry([dataFlow, event]), undefined)
  assert.equal(newEdgeLineEntry([dataFlow, { ...event, forNewEdges: true }])?.id, 'event')
  // a file that marks two uses the first; a mark on another kind is ignored
  assert.equal(
    newEdgeLineEntry([
      { ...dot, forNewEdges: true },
      { ...event, forNewEdges: true },
      { ...dataFlow, forNewEdges: true }
    ])?.id,
    'event'
  )
  assert.equal(newEdgeLineEntry([{ ...dot, forNewEdges: true }]), undefined)
})

test('an edge gets the fields the entry has, the colour the caller gives, and no width or opacity', () => {
  assert.deepEqual(edgeStyleFromLegendLine(dataFlow, '#123456'), {
    stroke: '#123456',
    lineStyle: 'solid',
    startMarker: 'none',
    endMarker: 'arrowClosed'
  })
  // an entry that leaves a field out leaves it out, motion included
  assert.deepEqual(edgeStyleFromLegendLine(event), { lineStyle: 'dashed', animation: 'flow' })
})

test('marking one line clears the others, and none clears all', () => {
  const legend = [dataFlow, event, dot]
  const marked = withNewEdgeLine(legend, 'data')
  assert.deepEqual(
    marked.map((e) => e.forNewEdges === true),
    [true, false, false]
  )
  const moved = withNewEdgeLine(marked, 'event')
  assert.deepEqual(
    moved.map((e) => e.forNewEdges === true),
    [false, true, false]
  )
  // the field goes, it is not left as false
  assert.equal('forNewEdges' in moved[0], false)
  const none = withNewEdgeLine(moved, null)
  assert.equal(
    none.some((e) => 'forNewEdges' in e),
    false
  )
})

test('an id that is not a line, or nothing to change, gives the same array back', () => {
  const legend = [dataFlow, event, dot]
  assert.equal(withNewEdgeLine(legend, 'dot'), legend)
  assert.equal(withNewEdgeLine(legend, 'gone'), legend)
  assert.equal(withNewEdgeLine(legend, null), legend)
  const marked = withNewEdgeLine(legend, 'data')
  assert.equal(withNewEdgeLine(marked, 'data'), marked)
})
