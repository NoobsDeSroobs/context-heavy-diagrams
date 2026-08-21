import { createContext, useContext } from 'react'
import type { HighlightDefinition, MetadataEntry } from '@shared/diagram'
import type { ContextMenuItem } from './components/ContextMenu'
import type { Theme } from './theme'

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
  // "Fill…"/"Border…" context-menu items (ADR 0010) — same fixed-popup
  // reasoning as openIconPicker above.
  openColorPicker: (nodeId: string, kind: 'fill' | 'border', anchorRect: DOMRect) => void
  // Fixed right-side dock — no anchor needed, it's not attached to the node.
  openDetailsPanel: (nodeId: string) => void
  // Ctrl/Cmd+click on a node — see epic 0009. Fully decided/implemented in
  // Canvas.tsx (it owns `nodes` and `openContextMenu`); node components just
  // forward the click, they don't decide chooser-vs-navigate themselves.
  handleLinkClick: (nodeId: string, clientX: number, clientY: number) => void
  // Undo history (epic 0006) groups a continuous mouse gesture into one
  // step by watching React Flow's own dragging/resizing change flags — but
  // rotation has no such flag (it's just repeated updateNodeData calls
  // during a mousemove loop), so TextNode's rotate handler calls these
  // itself at drag-start/drag-end to get the same grouping.
  beginContinuousEdit: () => void
  endContinuousEdit: () => void
  // For discrete (non-continuous) edits made via rfInstance.updateNodeData
  // — label commits, link/connection-point add-remove — which bypass
  // Canvas's own onNodesChange entirely (updateNodeData calls React Flow's
  // internal store directly), so nothing else observes them for undo
  // history. Call this immediately before the updateNodeData call.
  pushSnapshot: () => void
  // Container's "Attach contained shapes" menu item (epic 0004) — bulk
  // version of the drag-in reparenting, for encapsulating a lot of
  // already-positioned free-floating nodes at once rather than one drag per
  // node. Only ever attaches currently-top-level nodes fully inside the
  // container's bounds — a node already inside some other container is left
  // alone, not silently moved.
  attachContainedNodes: (containerId: string) => void
  // Every currently-enabled highlight matching this element's metadata —
  // see epic 0026/ADR 0025. Bound to Canvas's own highlights/enabled-set
  // state so node/edge components don't need either piece directly, just
  // the element's own metadata to check.
  matchHighlights: (metadata: Record<string, MetadataEntry> | undefined) => HighlightDefinition[]
  // Global setting (settings.ts/SettingsPanel, epic 0047/ADR 0032), not
  // diagram content — same "thread it through context so edges don't need
  // Canvas's own state directly" reasoning as matchHighlights above.
  edgeStraightSegmentLength: number
  // Current resolved theme — needed by every render/edit site that touches
  // an explicit fill/stroke/fontColor, for the theme-adaptive Value flip
  // (epic 0040/ADR 0034). Same threading reasoning as the two fields above.
  theme: Theme
}

const DiagramContext = createContext<DiagramContextValue | null>(null)

export function useDiagramContext(): DiagramContextValue {
  const ctx = useContext(DiagramContext)
  if (!ctx) throw new Error('useDiagramContext must be used within a DiagramContext.Provider')
  return ctx
}

export default DiagramContext
