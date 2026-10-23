import { createContext } from 'react'
import type { ResizeParams } from '@xyflow/react'
import type { GravityPreset, HighlightDefinition, MetadataEntry } from '@shared/diagram'
import type { ContextMenuItem } from '../ui/ContextMenu'
import type { Theme } from '../styling/theme'

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
  // Reference images (see ADR 0069). openReferencesFor: entity/
  // container right-click "Reference images…" — opens a floating viewer
  // window per attached reference, or the file picker if the node has none
  // yet. addReferencesToNode / removeReferenceFromNode: the property
  // panel's own References section. All rendered/owned at Canvas level.
  openReferencesFor: (nodeId: string) => void
  openReferenceWindow: (nodeId: string, path: string) => void
  addReferencesToNode: (nodeId: string) => void
  removeReferenceFromNode: (nodeId: string, path: string) => void
  // Ctrl/Cmd+click on a node navigates a linked diagram. Fully decided/implemented in
  // Canvas.tsx (it owns `nodes` and `openContextMenu`); node components just
  // forward the click, they don't decide chooser-vs-navigate themselves.
  handleLinkClick: (nodeId: string, clientX: number, clientY: number) => void
  // Undo history (see ADR 0018) groups a continuous mouse gesture into one
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
  // Container's "Attach contained entities" menu item — bulk
  // version of the drag-in reparenting, for encapsulating a lot of
  // already-positioned free-floating nodes at once rather than one drag per
  // node. Only ever attaches currently-top-level nodes fully inside the
  // container's bounds — a node already inside some other container is left
  // alone, not silently moved.
  attachContainedNodes: (containerId: string) => void
  // A node's "Detach from parent" menu item (shown only when it has a
  // parentId) — clears parentId and rebases the node's position from
  // parent-relative to absolute so it stays put visually. The one-click
  // inverse of drag-out / "Attach contained entities" — see ADR 0075.
  detachFromParent: (nodeId: string) => void
  // Every currently-enabled highlight matching this element's metadata —
  // see ADR 0025. Bound to Canvas's own highlights/enabled-set
  // state so node/edge components don't need either piece directly, just
  // the element's own metadata to check.
  matchHighlights: (metadata: Record<string, MetadataEntry> | undefined) => HighlightDefinition[]
  // Global preference (preferences.ts/PreferencesPanel, ADR 0032), not
  // diagram content — same "thread it through context so edges don't need
  // Canvas's own state directly" reasoning as matchHighlights above.
  edgeStraightSegmentLength: number
  // Global preference (preferences.ts/PreferencesPanel, ADR 0036) — the
  // property panel's count field already clamps to this via its own `max`
  // prop, but manual right-click "add point here" needed the same limit
  // threaded down to the node components, same reasoning as
  // edgeStraightSegmentLength above.
  maxConnectionPointsPerSide: number
  // Current resolved theme — needed by every render/edit site that touches
  // an explicit fill/stroke/fontColor, for the theme-adaptive Value flip
  // (see ADR 0034). Same threading reasoning as the two fields above.
  theme: Theme
  // Which node the layer panel is currently pointing at — an "entity
  // highlight" (see ADR 0035), a different concept from
  // matchHighlights above ("property highlight": every entity sharing a
  // metadata value) despite the shared English word. Deliberately not
  // real selection — see the ADR for why. Session-only, null means none.
  entityHighlightNodeId: string | null
  // The active named style palette's colors/fonts (preferences.ts, ADR 0048,
  // multi-palette per ADR 0068 — resolved via
  // effectiveStylePalette). Threaded the same way as the global preferences
  // above, so PropertyPanel's NodeStyleFields/EdgeFields can read it
  // without Canvas.tsx having to prop-drill through every intermediate
  // component.
  paletteColors: { label: string; value: string }[]
  paletteFonts: string[]
  // The font this diagram is drawn in unless an element sets its own: the diagram's, else the
  // personal default (ADR 0130). undefined means the built-in font. The property panel shows it
  // for an element with no font of its own.
  diagramFontFamily: string | undefined
  // Diagram-level catalog (see ADR 0050), already resolved to this
  // app's built-in four if the diagram hasn't defined its own — see
  // lineGravityPresets.ts's effectiveGravityPresets. LineNode's point
  // context menu reads this directly rather than a hardcoded list.
  gravityPresets: GravityPreset[]
  // Ids of every node/edge the current search overlay run matched (see
  // ADR 0062) — empty whenever the overlay is closed or hasn't been
  // run yet. Raw id set, not a per-element lookup function, same
  // convention as entityHighlightNodeId above: cheap enough for each
  // component to check `.has(id)` itself.
  searchMatchIds: Set<string>
  // "Isolate" (see ADR 0063) — true means every element NOT in
  // searchMatchIds should render dimmed. Deliberately a single flag, not
  // its own id set: it's always exactly "everything outside the current
  // search match set," so each node/edge component just checks
  // `isolateActive && !searchMatchIds.has(id)` itself.
  isolateActive: boolean
  // Global preference (preferences.ts/PreferencesPanel, ADR 0063), same
  // threading convention as edgeStraightSegmentLength/
  // maxConnectionPointsPerSide above.
  isolateOpacity: number
  // See ADR 0065 — replaces the current selection with every element of one
  // type. Exposed here so each node type's own right-click context menu
  // can offer "Select all entities"/"...containers"/etc. without Canvas.tsx
  // having to build every node's context menu itself.
  selectAllOfType: (type: 'entity' | 'container' | 'text' | 'line' | 'edge') => void
  // Multi-select resize (ADR 0098) — the three resizable node types forward
  // their NodeResizer's start/resize/end here so Canvas can scale the rest of
  // the selection by the same percentage.
  groupResize: {
    start: (nodeId: string) => void
    resize: (nodeId: string, params: ResizeParams) => void
    end: () => void
  }
  // The node (an Entity just created by dropping an edge on empty canvas,
  // ADR 0107) whose label should open straight into edit mode, and the call
  // that clears the request once the label has taken it. Session-only.
  pendingLabelEditId: string | null
  clearPendingLabelEdit: () => void
}

// The accessor hook lives in its own file (useDiagramContext.ts) — a file
// mixing this plain Context object with a hook export trips ESLint's
// react-refresh/only-export-components rule (it can't tell a Context isn't
// a component), even though "Context + its own accessor hook, same file"
// is otherwise the idiomatic React pattern (see React's own docs example).
// It wasn't split earlier because the import-path update touches every
// node/edge/panel component that reads this context.
const DiagramContext = createContext<DiagramContextValue | null>(null)

export default DiagramContext
