import { expect, test } from 'vitest'
import { MARKER_SHAPES } from '@shared/export/markerShapes'
import { DEFAULT_EDGE_MARKER_END, markerUrl } from './markerIds'

// React Flow turns defaultEdgeOptions.markerEnd into `url('#<value>')` for an edge with no marker of
// its own (getMarkerId in @xyflow/system returns a string unchanged, and the edge wrapper wraps it).
const asReactFlowWraps = (value: string): string => `url('#${value}')`

test('the default end marker is the bare id of a marker that exists', () => {
  expect(DEFAULT_EDGE_MARKER_END.startsWith('url(')).toBe(false)
  expect(Object.values(MARKER_SHAPES).map((shape) => shape.id)).toContain(DEFAULT_EDGE_MARKER_END)
})

test('what React Flow builds from the default points at the same marker as an explicit closed arrow', () => {
  expect(asReactFlowWraps(DEFAULT_EDGE_MARKER_END).replaceAll("'", '')).toBe(
    markerUrl('arrowClosed')
  )
})

test('a url(#id) default would have named no marker, which is the bug this guards', () => {
  const wrapped = asReactFlowWraps(markerUrl('arrowClosed') ?? '')
  expect(wrapped).toBe("url('#url(#" + DEFAULT_EDGE_MARKER_END + ")')")
  const ids = Object.values(MARKER_SHAPES).map((shape) => `url('#${shape.id}')`)
  expect(ids).not.toContain(wrapped)
})
