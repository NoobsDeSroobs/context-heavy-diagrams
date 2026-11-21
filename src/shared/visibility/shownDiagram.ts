// The diagram as a person sees it with some visibility sets hidden (ADR 0194), for the exports that
// draw from the file's data (SVG, draw.io). What the rule hides is left out; the rest is as it was,
// except where leaving an element out would leave something that cannot be drawn:
// - an edge whose end is left out has nothing to join, so it is left out of the export too;
// - an element inside a container that is left out is put in the nearest container that is
//   drawn, or on the canvas, at the place it has on screen.
import type { DiagramFile } from '../diagram/file.ts'
import type { DiagramNode } from '../nodes/schema.ts'
import { shownFilter } from './visibility.ts'

export function shownDiagram(diagram: DiagramFile, hiddenSetIds: ReadonlySet<string>): DiagramFile {
  const shown = shownFilter(diagram.visibilitySets ?? [], hiddenSetIds)
  if (
    diagram.nodes.every((n) => shown(n.visibilitySetIds)) &&
    diagram.edges.every((e) => shown(e.visibilitySetIds))
  ) {
    return diagram
  }
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]))
  const kept = new Set(diagram.nodes.filter((n) => shown(n.visibilitySetIds)).map((n) => n.id))

  const nodes = diagram.nodes
    .filter((n) => kept.has(n.id))
    .map((n): DiagramNode => {
      if (!n.parentId || kept.has(n.parentId)) return n
      // Climb past the containers that are left out, adding their places up: a child's position is
      // relative to its parent, so it stays where it is drawn by taking each skipped parent's
      // position as its own offset.
      let x = n.position.x
      let y = n.position.y
      let parent = byId.get(n.parentId)
      const seen = new Set<string>([n.id])
      while (parent && !kept.has(parent.id) && !seen.has(parent.id)) {
        seen.add(parent.id)
        x += parent.position.x
        y += parent.position.y
        parent = parent.parentId ? byId.get(parent.parentId) : undefined
      }
      const { parentId: _gone, ...rest } = n
      void _gone
      return parent && kept.has(parent.id)
        ? { ...rest, parentId: parent.id, position: { x, y } }
        : { ...rest, position: { x, y } }
    })

  const edges = diagram.edges.filter(
    (e) => shown(e.visibilitySetIds) && kept.has(e.source) && kept.has(e.target)
  )
  return { ...diagram, nodes, edges }
}
