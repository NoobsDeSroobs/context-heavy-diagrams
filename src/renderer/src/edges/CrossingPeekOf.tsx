import type { ReactFlowInstance } from '@xyflow/react'
import { crossingText, edgeCrossing } from '@shared/crossings/crossings'
import type { PeekTarget } from '../notes/useNotesPeek'
import CrossingPeek from './CrossingPeek'

// The crossing peek of the edge under the pointer, or nothing when that edge stays in one container.
export default function CrossingPeekOf({
  peek,
  rfInstance
}: {
  peek: PeekTarget
  rfInstance: ReactFlowInstance
}): React.JSX.Element | null {
  const edge = rfInstance.getEdge(peek.nodeId)
  if (!edge) return null
  const crossing = edgeCrossing(edge.source, edge.target, (id) => rfInstance.getNode(id)?.parentId)
  if (!crossing) return null
  const nameOf = (id: string): string => {
    const label = rfInstance.getNode(id)?.data?.label
    const first = typeof label === 'string' ? label.split('\n')[0].trim() : ''
    return first || id
  }
  return (
    <CrossingPeek
      key={peek.nodeId}
      target={peek}
      route={crossingText(crossing, nameOf)}
      borders={crossing.leaving.length + crossing.entering.length}
    />
  )
}
