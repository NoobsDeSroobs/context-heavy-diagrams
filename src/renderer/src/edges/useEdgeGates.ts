import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { edgeCrossing, gatesOnPath, type Gate, type Rect } from '@shared/crossings/crossings'
import { flattenPath } from '@shared/geometry/pathSampling'

const NONE: Gate[] = []

interface Boundary {
  id: string
  rect: Rect
}

const sameBoundaries = (a: Boundary[] | null, b: Boundary[] | null): boolean =>
  a === b || (a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b))

// The gates where an edge goes through the border of a container, from the containers' places
// in the canvas. Subscribes to nothing while `enabled` is false, and re-renders the edge only when the
// borders it crosses move or change size.
export function useEdgeGates(
  enabled: boolean,
  source: string,
  target: string,
  path: string
): Gate[] {
  const boundaries = useStore((state): Boundary[] | null => {
    if (!enabled) return null
    const lookup = state.nodeLookup
    const crossing = edgeCrossing(source, target, (id) => lookup.get(id)?.parentId)
    if (!crossing) return null
    return [...crossing.leaving, ...crossing.entering].flatMap((id) => {
      const node = lookup.get(id)
      if (!node) return []
      const at = node.internals.positionAbsolute
      const width = node.measured.width ?? node.width ?? 0
      const height = node.measured.height ?? node.height ?? 0
      return [{ id, rect: { x: at.x, y: at.y, width, height } }]
    })
  }, sameBoundaries)
  return useMemo(
    () => (boundaries && boundaries.length > 0 ? gatesOnPath(flattenPath(path), boundaries) : NONE),
    [boundaries, path]
  )
}
