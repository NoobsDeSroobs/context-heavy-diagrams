# 0003: Styling panel

## Status
Implemented 2026-08-19 (branch `epic/0003-styling-panel`, not yet merged). All tasks below are done. See Notes for implementation decisions made along the way that weren't fully pinned down by the design pass, and for one verification gap worth a manual pass before merging.

## Goal
A right-side "diagram dock" that shows an item palette when nothing is selected (add a shape/container/text) and switches to a context-sensitive property panel when something is — driving fill, border, font, exact transform, and (for edges) line/marker styling. Plus, per [ADR 0010](../../decisions/0010-named-searchable-style-presets.md), a right-click-accessible searchable catalog of named style presets.

## Design

### Layout architecture — see [ADR 0013](../../decisions/0013-dock-layout-architecture.md)
Two independent, collapsible dock slots, both zero-width when empty, **nested not flat**:
```
[ canvas [ diagram dock ] ]  [ utility dock ]
```
- **Diagram dock** (this epic builds this): item palette (nothing selected) or property panel (selection active). Structurally nested inside the canvas view, not a sibling of it — this matters for a future "move the dock to the left side" setting to stay scoped to the canvas view's own layout.
- **Utility dock**: `DetailsPanel` (epic 0008) lives here. `DetailsPanel` needs retrofitting from its current `position: fixed; right: 0` overlay into a real flex child of this dock, as part of this epic's layout work — this is the one existing thing this epic needs to touch that isn't new.
- Both are real flex layout (canvas genuinely shrinks; React Flow auto-resizes via `ResizeObserver`), not overlays covering content. `IconPicker`/`ContextMenu` are unaffected — they're transient popups, not persistent panels, and correctly stay `position: fixed`.
- **Width is per-mode, not one fixed value**: the diagram dock's item-palette mode and property-panel mode each get their own width (palette needs less room than a property panel with several sections). Neither dock is user-resizable via a drag handle in v1.

### Style schema — see [ADR 0014](../../decisions/0014-node-and-edge-style-schema.md)
```ts
export interface FontStyle {
  fontSize?: number
  fontColor?: string
  fontWeight?: 'normal' | 'bold'
}

export interface NodeStyle extends FontStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  textAlign?: 'start' | 'center' | 'end'
}

export type LineStyleKind = 'solid' | 'dashed' | 'dotted'
export type MarkerKind =
  | 'none' | 'arrowOpen' | 'arrowClosed'
  | 'circle' | 'circleFilled' | 'diamond' | 'diamondFilled'
  | 'crowsFootOne' | 'crowsFootMany'
  | 'crowsFootOneOrMany' | 'crowsFootZeroOrOne' | 'crowsFootZeroOrMany'

export interface EdgeStyle extends FontStyle {
  stroke?: string
  strokeWidth?: number
  lineStyle?: LineStyleKind
  startMarker?: MarkerKind
  endMarker?: MarkerKind
}
```
`DiagramNode.style?: NodeStyle`, `DiagramEdge.style?: EdgeStyle` — additive, absent means "current hardcoded look."

### Property panel groups, per element type
- **Shape**: Fill, Border, Font, Transform (x/y/width/height — no rotation)
- **Container**: same four groups as Shape — **container fill is customizable** (deliberate change from today's always-transparent body; transparent stays the default value, just no longer hardcoded)
- **Text**: Font, Transform (x/y/width/height, *plus* rotation — text does rotate, shapes/containers don't)
- **Edge**: Start (marker), Line (stroke/width/lineStyle — where the named-preset picker lives), End (marker), Font (label styling)

All sections are **collapsible, open by default**.

### Multi-select behavior
- **Same type selected** (e.g. 3 shapes): edits apply to the whole selection. Where a field's current value *differs* across the selection, show a "mixed" placeholder (blank swatch / em-dash) rather than defaulting to the first item's value — editing it then applies uniformly. Standard Figma/Illustrator-style batch edit; avoids silently overwriting everyone with one item's value.
- **Mixed type selected** (e.g. 2 shapes + 1 edge): the panel shows **per-type sections, stacked** — a "Shapes (2)" section with its groups, an "Edges (1)" section with its own, both editable independently. These per-type sections are collapsible too.

### Item panel (default/nothing-selected content)
- **Click to add only, for this epic** — reuses the click-to-spawn-at-viewport-center behavior already built in epic 0004 (`screenToFlowPosition` + a small bounded jitter), just presented as dock icons instead of toolbar buttons. The toolbar's current "Add shape"/"Add container"/"Add text" buttons likely move into this panel rather than staying duplicated — worth confirming during implementation whether to remove them from the toolbar entirely or keep both as redundant entry points.
- **Drag-to-add is explicitly out of scope for this epic** — split into [epic 0029](0029-drag-to-add-from-item-panel.md), backlogged on purpose so this epic isn't blocked on the extra drag/drop-coordinate-translation work.

### Named presets — see [ADR 0010](../../decisions/0010-named-searchable-style-presets.md) (already accepted, predates this design pass)
Presets are a *picker mechanism*, never stored state — picking one just pre-fills the raw `style` fields above. Reached via right-click (`Fill…`/`Border…` on shapes, `Line style…` on edges), reusing `IconPicker`'s exact fixed-positioned searchable-popup pattern. The panel and the context-menu picker edit the same underlying fields.

**Explicitly deferred, on purpose: which naming system(s) the preset catalog actually draws from (UML? BPMN? ERD/crow's-foot? something invented for this tool?).** This needs its own real discussion later, informed by testing and real diagram-building over time — not something to guess at now. The schema above (`MarkerKind`, `LineStyleKind`) is deliberately visual/structural (`arrowOpen`, `crowsFootMany`) rather than notation-named, specifically so it stays valid no matter which naming system(s) eventually get chosen. **Do not invent preset names or a `builtinLineStyles.ts` catalog as part of implementing this epic's schema/panel/context-menu plumbing** — build the picker mechanism and leave the catalog itself near-empty (maybe a handful of obviously-safe generic entries like plain solid/dashed/dotted with no notation claim attached) until that follow-up discussion happens.

## Tasks
- [x] Add `NodeStyle`/`EdgeStyle`/`FontStyle`/`LineStyleKind`/`MarkerKind` to `src/shared/diagram.ts`, threaded through `toDiagramFile`/`fromDiagramFile`/`serializeDiagram`/`parseDiagram`
- [x] `docs/file-format.md` updated with the new `style` fields on both Node and Edge
- [x] Restructure `Canvas.tsx`'s top-level render tree to introduce the nested canvas-view/diagram-dock composite plus the sibling utility dock (see ADR 0013) — this is real layout surgery, not additive
- [x] Retrofit `DetailsPanel` from `position: fixed` into a flex child of the new utility dock
- [x] Diagram dock: item palette component (shape/container/text, click-to-add via existing `spawnPosition` logic from epic 0004)
- [x] Diagram dock: property panel component, with per-element-type collapsible group sections (Fill/Border/Font/Transform for nodes; Start/Line/End/Font for edges)
- [x] Mixed-value handling for same-type multi-select (the "blank/mixed placeholder, apply-to-all-on-edit" behavior)
- [x] Per-type stacked sections for mixed-type multi-select
- [x] Panel edits write through to `style` and re-render live
- [x] Render actual `style` values on `ShapeNode`/`ContainerNode`/`TextNode`/`LabeledEdge` (fill/stroke/font on nodes; stroke/lineStyle/markers/font on edges) — currently nothing reads `style` because it doesn't exist yet
- [x] Right-click context-menu entries — "Fill…"/"Border…" on shapes and containers, "Line style…" on edges — reusing `IconPicker`'s popup pattern, with a minimal/placeholder preset catalog only (see Design's note on deferring the naming-system decision)
- [x] Text alignment for shape/text labels (moved here from epic 0012, which needed this panel to exist first)

## Notes
Design pass done 2026-08-19, deliberately before any implementation — see [ADR 0013](../../decisions/0013-dock-layout-architecture.md) (dock layout) and [ADR 0014](../../decisions/0014-node-and-edge-style-schema.md) (style schema) for the full reasoning behind each decision, not just the summary above.

**Deliberately deferred, not forgotten**: the notation-base/naming-system discussion for the preset catalog (UML vs. BPMN vs. ERD vs. something invented) — see ADR 0014's Notes for why this was kept out of the schema discussion on purpose. Revisit once there's been real usage/testing to inform it, likely alongside or after epic 0022's diagram-type gallery.

**Also split out**: [epic 0029](0029-drag-to-add-from-item-panel.md) (drag-to-add from the item panel) — wanted eventually, deliberately sequenced after click-to-add ships first.

Expect real open questions once implementation starts that this design pass didn't anticipate — e.g. exact pixel widths for each dock mode, whether the toolbar's Add buttons get removed or stay duplicated, how the "mixed value" placeholder should actually look for each field type (color swatch vs. number input vs. dropdown). These are implementation-detail-level, not architecture-level — resolve them as they come up rather than treating this doc as needing to have anticipated every last one.

## Implementation notes (2026-08-19)

Decisions made while implementing that the design pass left open:

- **Dock widths**: item-palette mode 96px, property-panel mode 260px, utility dock (DetailsPanel) unchanged at 360px. Not user-resizable, per the design's own v1 scope call.
- **Toolbar's old Add-shape/Add-container/Add-text buttons were removed**, not kept duplicated — they're only in the item palette now.
- **Mixed-value placeholder**: color fields show "Unset"/"Mixed" as the text input's placeholder with a neutral gray swatch; number fields show "Mixed" as the placeholder with an empty value; selects show a disabled "Mixed" option. All editable-while-focused via a local-draft pattern (same technique `EditableLabel` already used) — binding a number/color-text input directly to a value recomputed from the live selection fights every keystroke otherwise.
- **Property panel field edits are undo-grouped per focus session**: color/number inputs call `beginContinuousEdit`/`endContinuousEdit` on focus/blur (one undo step per edit session, however many keystrokes), selects call `pushSnapshot()` once per change (they're already discrete).
- **Transform fields on a contained (child) node edit the node's raw `position.x`/`position.y`**, which is parent-relative for children per ADR 0012 — same value the file format already stores, but worth knowing it's not always canvas-absolute when reading the panel for a node inside a container.
- **"Fill…"/"Border…" context-menu popups target only the single right-clicked node**, not the current multi-selection (consistent with "Add icon"/"See details," which are also single-node-scoped) — the property panel is the multi-select path.
- **Edge markers** use hand-drawn SVG `<marker>` defs (`src/renderer/src/edges/edgeMarkers.tsx`/`markerIds.ts`) since React Flow's built-in `MarkerType` only covers plain/closed arrows. They use the `context-stroke`/`context-fill` CSS keywords (Chromium 121+; this project ships Electron 43) so one definition per shape serves any color. Shapes are deliberately approximate, not pixel-correct ERD/UML notation.
- **`builtinLineStylePresets.ts`** deliberately ships only generic, notation-free entries (plain/dashed/dotted line, a few arrow variants) per the explicit instruction not to invent a real UML/ERD/BPMN catalog here — see ADR 0010/0014's Notes.
- **`FontStyle.fontFamily` added after initial implementation** (user caught that ADR 0014's original schema pass omitted a font-family field entirely — Size/Color/Weight/Align existed, but nothing let you actually pick a typeface). Added as a plain `fontFamily?: string` — a raw CSS `font-family` value, same "store the render value directly" approach as `fill`/`stroke`, not an enum. The property panel's "Family" dropdown currently only offers generic CSS families (`sans-serif`/`serif`/`monospace`/`cursive`) since a specific named font isn't reliably available on both of this app's target platforms (Windows/Linux) — a font picked on one platform could silently fall back to something else (or nothing) on the other. Decided with the user: ship generic families now, revisit adding curated specific fonts later (no schema change needed when that happens, just more picker options).
- **Opacity added, then redesigned from whole-element to per-channel** — another gap in ADR 0014's original schema pass (user caught it: "opacity just does not exist"). A first pass added one `opacity` field per style bag with its own "Opacity" section; user feedback after trying it: opacity should live inside each color picker (fill/border/text independently), not as one value fading the whole element, and should be a slider+linked-number, not a bare number field. Final shape: `fillOpacity`/`strokeOpacity` on `NodeStyle`, `strokeOpacity` on `EdgeStyle`, and `fontOpacity` on the shared `FontStyle` (so both node and edge labels get it for free) — all `0-100`, absent meaning `100` (fully opaque). No standalone Opacity section; each `OpacityField` (new: linked `<input type=range>` + `NumberField`, `panels/fields.tsx`) sits directly under its `ColorField` in Fill/Border/Font (nodes) and Line/Font (edges), and in the Fill…/Border… context-menu popups too. Rendering uses CSS `color-mix(in srgb, <color> <pct>%, transparent)` (`styles/colorOpacity.ts`'s `withOpacity`) baked into each color value (`background`/`borderColor`/`color`) rather than the element-level `opacity` CSS property, which can't isolate one channel from another. For edges this still means applying it in two places (the path's `stroke` and the label's `color` separately), same underlying reason as before — `EdgeLabelRenderer` portals the label outside the SVG, so it never inherited from the path anyway.
- **`OpacityField`'s number input was clipping "100"** at its original 42px width — the native number-spinner buttons were eating into the visible text area inside that narrow a box. Fixed by widening it to 48px and hiding the spinner entirely (`appearance: textfield` + the WebKit spin-button pseudo-elements) — redundant anyway once there's a slider right next to it.
- **Containers now always render behind shapes/text**, regardless of creation order or which one was dragged where (a container is a background grouping box, not something that should ever cover a sibling shape it happens to overlap). Implemented as a per-render `zIndex` derived from `n.type` (`Canvas.tsx`'s `zIndexedNodes`, only touching the `<ReactFlow nodes>` prop — never persisted, since it's a pure rendering concern, not diagram content), not by reordering the `nodes` array. React Flow computes actual stacking as `zIndex + (selected ? 1000 : 0)` (`elevateNodesOnSelect`, on by default), so the two tiers (container `0`, shape/text `2000`) need more than 1000 apart, or a *selected* container would still jump above an unselected shape — verified this holds (selected container renders at `1000`, still under an unselected shape's `2000`).
- **New containers default to a faint visible fill** (`fill: 'var(--ev-c-gray-1)'`, `fillOpacity: 20`) instead of fully transparent — the same neutral tone as the dashed border, so a freshly-added container reads as "a container" at a glance without opening the property panel first. Set in `addContainerNode`; existing containers (created before this) still default to transparent, since absent `style` always means "current hardcoded look."

**Verification gap**: this session's browser-automation tooling couldn't drive React Flow's handle-drag-to-connect interaction (synthetic pointer events weren't recognized, and screenshot capture — the fallback for coordinate-based dragging — wasn't available in this environment). Everything reachable without creating an edge by hand was verified live (schema round-trip, layout resize, palette, property panel incl. mixed-value/multi-select, node style rendering, Fill…/Border… popup). **Not verified live: actually connecting two nodes, selecting the resulting edge in the property panel, and the "Line style…" picker** — the code mirrors already-verified patterns closely, but a manual pass in the real app is worth doing before merging.
