import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'

// What a canvas feature hook needs from the rest of the canvas (ADR 0126). A hook that changes
// nodes or edges calls pushSnapshot first (ADR 0018). Hooks destructure what they use, so their
// callback dependencies stay the individual members and the object's own identity is irrelevant.
export interface CanvasApi {
  rfInstance: ReactFlowInstance
  graphRef: MutableRefObject<{ nodes: Node[]; edges: Edge[] }>
  setNodes: Dispatch<SetStateAction<Node[]>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  pushSnapshot: () => void
  markDirty: () => void
  currentPath: string | null
}
