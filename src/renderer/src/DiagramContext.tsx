import { createContext, useContext } from 'react'
import type { ContextMenuItem } from './components/ContextMenu'

export interface DiagramContextValue {
  // Current file path, or null for an unsaved diagram — nodes need this to
  // resolve their sibling assets/ folder (custom icons, later details).
  diagramPath: string | null
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  // Rendered at Canvas level, fixed-positioned from the node's own
  // getBoundingClientRect() — deliberately NOT rendered inside the node
  // itself, so it doesn't inherit React Flow's zoom/pan transform and end
  // up scaling like a shape on the canvas.
  openIconPicker: (nodeId: string, anchorRect: DOMRect) => void
}

const DiagramContext = createContext<DiagramContextValue | null>(null)

export function useDiagramContext(): DiagramContextValue {
  const ctx = useContext(DiagramContext)
  if (!ctx) throw new Error('useDiagramContext must be used within a DiagramContext.Provider')
  return ctx
}

export default DiagramContext
