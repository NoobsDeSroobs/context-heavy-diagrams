import EntityNode from '../nodes/EntityNode'
import TextNode from '../nodes/TextNode'
import ContainerNode from '../nodes/ContainerNode'
import LineNode from '../nodes/LineNode'
import LabeledEdge from '../edges/LabeledEdge'
import { markerUrl } from '../edges/markerIds'

// Defined at module scope so React Flow gets a stable reference — recreating
// these objects every render triggers a React Flow warning and remounts. Shared by the editing
// canvas and the compare window, so both draw an element the same way.
export const nodeTypes = {
  entity: EntityNode,
  text: TextNode,
  container: ContainerNode,
  line: LineNode
}
export const edgeTypes = { labeled: LabeledEdge }

// Static, at module scope, so React Flow gets a stable reference (same reason as
// nodeTypes/edgeTypes above): EdgeWrapper reads defaultEdgeOptions through its own unguarded
// useStore selector, so a fresh object per render would re-render every edge.
//
// markerEnd is a raw 'url(#id)' string pointing at this app's context-stroke marker
// (edgeMarkers.tsx), not RF's { type: MarkerType.ArrowClosed }. RF colours that one from a
// `defaultColor` this app never sets, so it stayed stock grey and washed out on a light PNG export.
// RF passes a string through untouched (createMarkerIds only acts on object markers), and the
// arrowhead then inherits whatever colour the edge draws in, live or exported.
export const DEFAULT_EDGE_OPTIONS = {
  type: 'labeled',
  markerEnd: markerUrl('arrowClosed')
}
