# Completed epics

A one-paragraph record of every epic that is finished (or was retired, superseded or cancelled). The decisions behind them are in [`docs/decisions/`](../decisions/); each entry links the ADRs it produced. The full text of each epic, with its task list and notes, is in git history (it was removed from the tree when this index replaced the `epics/completed/` folder, [ADR 0120](../decisions/0120-completed-epics-collapse-into-an-index.md)).

When an epic is done and confirmed, add an entry here (newest at the bottom) and delete its file; the number is never reused.

### 0001: Bare Electron + React shell

*Done.* A running Electron app with a React + TypeScript renderer, an embedded React Flow canvas (pan/zoom, basic node/edge creation and dragging), and save/load of a single diagram.json to/from disk via IPC. ADR: [0003](../decisions/0003-diagram-persistence-v1.md).

### 0002: Resize and rotate

*Done.* Two custom node types replace the React Flow default: ShapeNode (resizable, multiple connection points, never rotatable) and TextNode (resizable, rotatable, no connection points). ADR: [0004](../decisions/0004-shape-text-node-split.md).

### 0003: Styling panel

*Done.* A right-side "diagram dock" that shows an item palette when nothing is selected (add a shape/container/text) and switches to a context-sensitive property panel when something is — driving fill, border, font, exact transform, and (for edges) line/marker… ADRs: [0010](../decisions/0010-named-searchable-style-presets.md), [0013](../decisions/0013-dock-layout-architecture.md), [0014](../decisions/0014-node-and-edge-style-schema.md).

### 0004: Containers

*Done.* Container shapes that group nodes using React Flow's parent/child relationships, so child nodes move together with their container automatically — without becoming a separate "grouping" mechanism that's hard to edit individual elements within. ADR: [0012](../decisions/0012-container-node-design.md).

### 0005: Dark / light mode

*Done.* App-wide dark and light themes. ADR: [0027](../decisions/0027-theme-default-follows-system.md).

### 0006: Undo / redo

*Done.* Undo/redo over a reasonable number of steps (not unlimited/branching for v1). ADR: [0018](../decisions/0018-undo-redo-explicit-snapshots.md).

### 0007: Icon slots

*Done.* Per-ShapeNode corner icon slots (top-left/top-right/bottom-left/bottom-right), supporting both a built-in icon set and user-uploaded custom icons. ADR: [0006](../decisions/0006-icon-storage-model.md).

### 0008: Detail sublayer

*Done.* Right-click → "See details" opens a fixed right-side panel with a Markdown editor/preview, backed by a per-node .md file — data on the node, never a second draggable canvas object.

### 0009: Linked-diagram navigation

*Done.* Ctrl/Cmd+click on a node navigates into a linked diagram (a drill-down view), resolved via an explicit relative path stored on the node — see docs/decisions/0005-diagram-identity-and-linking.md for the identity/linking model this builds on. ADRs: [0005](../decisions/0005-diagram-identity-and-linking.md), [0023](../decisions/0023-multi-window-diagram-model.md).

### 0010: SVG/PNG export

*Done.* Export the current diagram to SVG/PNG with a configurable margin, for sharing a view outside this app (e.g. embedding it in Confluence). ADR: [0051](../decisions/0051-png-export.md).

### 0011: Alignment and snapping

*Done.* Accurately align shapes vertically/horizontally while dragging, with snapping — requested during epic 0002 design discussion, not part of the original brief. ADR: [0019](../decisions/0019-snap-to-shape-not-grid.md).

### 0012: Editable labels on shapes and edges

*Done.* Double-click a shape, text node, or edge to write/edit a text label directly on it. Raised during epic 0002 design discussion, deliberately kept out of that epic's scope. ADR: [0020](../decisions/0020-labels-always-centered.md).

### 0013: Configurable connection points

*Done.* Beyond the default 4 fixed connection points per ShapeNode (one per side, centered — built in epic 0002), let users add more. ADRs: [0021](../decisions/0021-connection-point-removal-blocked.md), [0010](../decisions/0010-named-searchable-style-presets.md).

### 0014: Dragging an edge into empty space creates a shape

*Done.* Dragging a connection from a shape's handle and releasing it over empty canvas (instead of onto another node) offers to create a new shape at the drop point and connects the edge to it. ADR: [0015](../decisions/0015-anchor-placeholder-node.md).

### 0015: Migrate to single-file diagram format

*Done.* Rework the already-shipped folder-based persistence (epics 0001/0002/0012, iterated on twice already — see ADR 0003's two corrections) to match the identity/linking model decided in docs/decisions/0005-diagram-identity-and-linking.md: a diagram is a single… ADR: [0005](../decisions/0005-diagram-identity-and-linking.md).

### 0018: Selection and keyboard shortcuts

*Done.* Standard editor selection/deletion/navigation shortcuts.

### 0020: Autosave / crash recovery and unsaved-changes protection

*Done.* Periodic recovery snapshots so unsaved work survives a crash, plus a proper "save before closing?" prompt. Raised during epic 0008 design discussion, explicitly deferred by the user ("for a later epic though, I feel"). ADR: [0040](../decisions/0040-dirty-tracking-and-autosave-design.md).

### 0021: YAML frontmatter for detail files

*Retired.* Parse optional YAML frontmatter in detail .md files for semi-structured fields (integration type, inputs/outputs, technical vs. functional, or whatever ends up useful) — the brief explicitly anticipated this as a deliberately-deferred, zero-migration-cost… ADR: [0022](../decisions/0022-unified-tag-and-metadata-system.md).

### 0023: Custom metadata bucket

*Superseded.* A free-form, arbitrary-JSON metadata dict on nodes, edges, and the diagram itself — separate from the fields the tool already understands and manages (data.label/icons/details/linkedDiagram) — viewable and editable both through the raw .chd file and from the… ADRs: [0022](../decisions/0022-unified-tag-and-metadata-system.md), [0009](../decisions/0009-custom-metadata-bucket.md).

### 0024: Multi-diagram tabs or windows

*Done.* A way to have more than one diagram open and visible at once — most concretely, a parent and a linked child, without round-tripping through breadcrumb back-navigation to see both. ADR: [0023](../decisions/0023-multi-window-diagram-model.md).

### 0025: Copy / paste

*Done.* Real clipboard copy/paste for nodes (and edges between copied nodes) — Ctrl+C/Ctrl+V/Ctrl+X. ADR: [0049](../decisions/0049-clipboard-copy-paste.md).

### 0026: Tagging and overlay visualization

*Done.* Tag nodes and edges with freeform labels, then visualize the diagram by tag via a set of user-defined, individually-toggleable highlights — each one a tag + a color. ADRs: [0025](../decisions/0025-tagging-and-overlay-visualization.md), [0008](../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md), [0024](../decisions/0024-propagate-required-tags-to-children.md).

### 0027: App branding and licensing

*Superseded.* Replace the default electron-vite scaffold identity (window title, taskbar/dock icon, app name, package.json metadata) with the tool's own, and put real licensing terms in place — right now the project has no LICENSE file and every branding field is still the… ADR: [0011](../decisions/0011-software-license-choice.md).

### 0028: Remaining lint cleanup

*Done.* Fix the last 4 pre-existing ESLint errors left after the easy ones were cleaned up alongside epic 0004 (an unescaped apostrophe, and a genuinely-unnecessary useState+useEffect in IconPicker that's now a plain derived value).

### 0029: Drag-to-add from the item panel

*Done.* Let the item panel (epic 0003's in-diagram dock, default/no-selection content) support dragging a shape/container/text icon directly onto the canvas and dropping it at that exact position — the standard "stencil palette" interaction from tools like… ADR: [0064](../decisions/0064-drag-to-add-container-detection.md).

### 0030: Custom style palettes & default element styles

*Done.* Two related, naturally-sequenced features on top of epic 0003's property panel and pickers: ADR: [0048](../decisions/0048-style-palette-and-defaults.md).

### 0032: Edge routing style and manual bend points

*Done.* Let an edge be routed differently than today's one hardcoded bezier curve: React Flow's own built-in straight/step/smoothstep path shapes, or a catmull-rom curve (reusing epic 0064's freeform-line math) with manually-placed bend points — a way to steer an… ADRs: [0057](../decisions/0057-edge-routing-style.md), [0050](../decisions/0050-freeform-line-as-node-type.md).

### 0033: Edge reconnection

*Done.* Grab either end of an existing edge and drag it to a different attachment point, while the other end stays put — so a connection that made sense on one side of a shape (e.g. "left") can be moved to a better-fitting side (e.g. "top") after the diagram gets… ADR: [0015](../decisions/0015-anchor-placeholder-node.md).

### 0034: Unified tag and metadata system

*Done.* A single metadata mechanism per Shape/Container/Edge — key-value entries that can be freely added by a human, or required by the diagram itself (a curated, always-present, optionally-validated field template), with every entry visible and interpretable both… ADRs: [0022](../decisions/0022-unified-tag-and-metadata-system.md), [0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md).

### 0035: Propagate required tags to linked children

*Done.* A "Copy to children" button on the Required Tags panel that pushes the current diagram's requiredTags template down its entire link subtree, so a complex view built from many linked sub-diagrams doesn't need the same required tags redefined by hand in every… ADR: [0024](../decisions/0024-propagate-required-tags-to-children.md).

### 0036: Grouped highlights

*Done.* An "Add group" action in the Highlights panel: pick a tag key (e.g. ADR: [0026](../decisions/0026-grouped-highlights.md).

### 0037: Diagram legend

*Done.* A legend capability: a way to explain what a diagram's colors, edge styles (line style, markers), and icons mean, without relying on the reader already knowing the convention or the diagram author explaining it out of band. ADR: [0033](../decisions/0033-diagram-legend-design.md).

### 0038: Drag file into window to open

*Done.* Drop a .chd file onto an open app window to open it, as an alternative to the existing File → Open dialog. ADRs: [0040](../decisions/0040-dirty-tracking-and-autosave-design.md), [0023](../decisions/0023-multi-window-diagram-model.md).

### 0039: Per-side connection point counts

*Done.* Alongside the existing right-click "Add connection point here" (which places one point near the click position), let the user configure a count of connection points per side — e.g. 4 on the right, 2 on the bottom, 1 on the top, 0 on the left — evenly spread… ADR: [0036](../decisions/0036-connection-point-count-and-transfer.md).

### 0040: Theme-adaptive color value flip

*Done.* When the app's theme changes, an explicitly-set color (fill, stroke, fontColor on a Node or Edge) should stay recognizably "the same color" but adapt its lightness so it stays legible against the new background — not stay bit-for-bit identical (today's… ADR: [0034](../decisions/0034-theme-adaptive-color-value-flip.md).

### 0041: Reload diagram from disk

*Done.* A "Reload" action for a window's own currently-open diagram — re-read the file from disk and load it into the canvas in place, without closing the window or relaunching the app.

### 0042: Edge label renders behind its own edge line

*Done.* An edge's label should always render visually in front of its own line (and ideally anything else it overlaps), so it stays legible regardless of how the edge is routed or what crosses it.

### 0043: Layer order (z-height) control

*Done.* A way to control the stacking order of canvas objects (which one renders on top when two overlap) — not just a blind "bring to front" action, but real visibility into what's currently stacked where. ADRs: [0035](../decisions/0035-layer-order-control.md), [0030](../decisions/0030-edge-label-z-index-override.md).

### 0044: Larger, more forgiving resize-handle hit targets

*Done.* Make grabbing a shape or container's resize handle easier — without necessarily changing how small/unobtrusive the handle looks, just how forgiving it is to actually click. ADR: [0038](../decisions/0038-resize-handle-hit-target-size.md).

### 0045: Edge label position slider

*Done.* A control (the user's own suggestion: a slider) to move an edge's label along the edge's path — default at 0.5 (the midpoint, today's only option), adjustable toward either end when the midpoint placement makes the label hard to read (overlapping another…

### 0046: Edge selection highlight and grab priority

*Done.* Two related asks, both about making it easier to work with edges that converge or overlap at one point: 1.

### 0047: Forced straight segment near edge endpoints

*Done.* Force every edge to travel straight outward from each endpoint for a configurable number of pixels (the user's own suggestion: 5-10px, adjustable in an options/settings menu) before curving toward the other end — rather than curving immediately from the… ADR: [0032](../decisions/0032-global-settings-panel.md).

### 0048: Left-side tool sidebar

*Cancelled.* A dedicated left-side sidebar for canvas-level tools — extending what's already there (zoom, fit-to-screen, lock-edits) with more, e.g. a toggle for the legend view (epic 0037) once that exists, "and things." ADRs: [0041](../decisions/0041-cancel-left-sidebar-reuse-popup-pattern.md), [0039](../decisions/0039-top-menu-bar.md).

### 0049: Top menu bar (File / Edit / View / Help)

*Done.* Move Open / Save / Save As / Reload and similar actions out of the current single-row toolbar into a conventional desktop-app top menu bar with classic categories — File, Edit, View, Help, etc. ADR: [0039](../decisions/0039-top-menu-bar.md).

### 0050: Details panel defaults to preview, not edit

*Done.* Opening a node's details panel (epic 0008) should show the rendered Markdown preview first, not the raw editable textarea — matching how the panel is actually used most of the time (reading an existing note), not how it's used the first time it's written.

### 0053: Installable distribution for non-technical users

*Superseded.* Right now, running this app requires installing Node/npm, cloning the repo, and launching it from a terminal (npm install, npm run dev/npm start) — fine for the user as the developer, a hard blocker for anyone non-technical. ADR: [0044](../decisions/0044-app-versioning-scheme.md).

### 0054: Move app settings into a real per-OS config location

*Done.* Epic 0047 just added this app's first global setting (edgeStraightSegmentLength), stored via settings.ts in the renderer's localStorage — a reasonable starting point (mirrors theme.ts's existing pattern), but not where a properly installed desktop app… ADRs: [0053](../decisions/0053-os-conventional-settings-storage.md), [0052](../decisions/0052-settings-ownership-tiers.md).

### 0055: Required tags

*Done.* Two coupled improvements to the required-tags panel's per-tag editing: 1. Replace the current allowed-values field — a single comma-separated text input (RequiredTagsPanel.tsx, tag.allowedValues?.join(', ') in, split-on-comma out) — with a real list editor. ADR: [0047](../decisions/0047-allowed-values-list-editor.md).

### 0057: About/Help menu and app versioning scheme

*Done.* Two coupled pieces: 1. A real versioning scheme for the app itself (not to be confused with the .chd file format's own version field, currently always 1 — see docs/file-format.md. ADR: [0044](../decisions/0044-app-versioning-scheme.md).

### 0058: An implicit "None" value for required tags

*Done.* Every required tag should have an implicit "not applicable" value available — the user's own framing: "None should not have to be added to the list of options for it to be there, but it should be there such that the highlights and dropdowns can select and… ADR: [0046](../decisions/0046-implicit-none-for-required-tags.md).

### 0060: Threat/risk matrix (security view) — mode-switch, prototype phase done

*Done.* A threat/risk matrix: services or components (whichever granularity, hierarchical the way this app's own diagrams already are) listed along one axis, relevant threats listed along the other. ADRs: [0055](../decisions/0055-security-data-lives-on-diagram-elements.md), [0054](../decisions/0054-progressive-disclosure-for-advanced-features.md).

### 0061: Toolbar polish

*Done.* Two small, related toolbar tweaks, both in the same top-toolbar strip (Canvas.tsx's .toolbar — MenuBar, saved-flash indicator, current-file display, theme toggle, in that order today): ADR: [0045](../decisions/0045-default-edge-style-setting.md).

### 0062: Search — find and highlight matching elements

*Done.* A search feature: type a query, and any element that matches "in some way" gets highlighted (the user's own framing — deliberately broad, not scoped to one field). ADR: [0062](../decisions/0062-search-scope-and-matching.md).

### 0063: "Isolate" — de-emphasize elements outside a working set

*Done.* Originally framed as a "dim mode" tied to the highlight system. ADR: [0063](../decisions/0063-isolate-mode.md).

### 0064: Simple curved freeform line (bezier)

*Done.* A simple curved freeform line as a new top-level item category, distinct from edges (which always connect two node endpoints). ADR: [0050](../decisions/0050-freeform-line-as-node-type.md).

### 0066: Decouple code documentation and ADRs from epic numbering

*Done.* Remove references to epic numbers from in-code documentation (comments) and from ADRs — both should be able to stand on their own, understandable without needing to cross-reference docs/planning/epics/NNNN-.md for context. ADR: [0070](../decisions/0070-decouple-docs-from-epic-numbering.md).

### 0067: DiagramContext re-renders the whole diagram on every rapid setting change

*Done.* Make rapid, high-frequency state changes (a native <input type="color"> drag firing many onChange events per second is the reported trigger, but likely any similarly frequent update) not tank frame rate on a large diagram. ADR: [0056](../decisions/0056-diagram-context-rerender-performance.md).

### 0068: Privacy/security pass before public release

*Superseded.* A deliberate review of the app's actual privacy/security posture — permissions requested, Electron hardening defaults, network behavior — before the repo (and real installers built from it) go out to people who aren't the author.

### 0070: Public release under a new GitHub identity, as a curated fresh repo

*Superseded.* Publish this project publicly under a new GitHub account, kept separate from the author's existing one. Superseded: the release stays on the existing account and repository. ADR: [0111](../decisions/0111-open-source-release-approach.md).

### 0072: Gravity presets — add a User default tier

*Done.* Gravity presets (epic 0064/ADR 0050) already resolve Diagram override (DiagramFile.gravityPresets) → Built-in default (DEFAULT_GRAVITY_PRESETS in lineGravityPresets.ts), but there's no User default in between — no way to set your own preferred preset list… ADRs: [0066](../decisions/0066-gravity-presets-user-default.md), [0050](../decisions/0050-freeform-line-as-node-type.md), [0052](../decisions/0052-settings-ownership-tiers.md).

### 0073: Max connection points per side

*Done.* maxConnectionPointsPerSide (epic 0039) is currently Settings-only — one value, per person, applied everywhere. ADRs: [0067](../decisions/0067-max-connection-points-diagram-override.md), [0052](../decisions/0052-settings-ownership-tiers.md).

### 0074: Multiple named style palettes, with an active-palette selector

*Done.* The style palette (epic 0030/ADR 0048) stays Settings-only per ADR 0052 — no diagram-local copy, since a shape's actual color is already captured at the Properties level. ADRs: [0068](../decisions/0068-multiple-named-style-palettes.md), [0052](../decisions/0052-settings-ownership-tiers.md), [0066](../decisions/0066-gravity-presets-user-default.md).

### 0075: Warn when a diagram has edges but no legend entries

*Done.* At minimum, a diagram with any edges should explain what its arrows mean — an empty Legend on a diagram that has connections is easy to forget.

### 0076: Rename "Shape" to "Entity"

*Done.* The user's own framing: a Shape and a Container remain conceptually different things even if every style property is set identically between them — a Container represents grouping/boundary, a Shape represents a standalone entity. "Shape" undersells that… ADRs: [0101](../decisions/0101-shape-to-entity-rename.md), [0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md), [0082](../decisions/0082-security-data-schema.md), [0054](../decisions/0054-progressive-disclosure-for-advanced-features.md), [0055](../decisions/0055-security-data-lives-on-diagram-elements.md).

### 0078: BPMN as a basis for this app's visual language

*Done.* BPMN as an adopted visual _vocabulary_, for recognisability and pickup — not a grammar, metamodel, or execution model. Full reasoning in ADR 0080. ADRs: [0080](../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md), [0008](../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md), [0031](../decisions/0031-icon-annotation-is-a-standing-requirement.md).

### 0079: Security data as a diagram-element property (real persistence)

*Done.* Replace the epic 0060 threat-matrix prototype's hardcoded, in-memory-only data (threatMatrixTestData.ts, threatMatrixScale.ts, component-state calc modes) with real data that lives on the diagram's own Shape nodes and persists through .chd save/reload, so the… ADRs: [0082](../decisions/0082-security-data-schema.md), [0055](../decisions/0055-security-data-lives-on-diagram-elements.md).

### 0080: Mode-aware top menu bar

*Done.* The top menu bar (MenuBar/Canvas.tsx's menus array, epic 0049) currently shows the same File/Edit/View/Help regardless of which persona (Diagram / Security Matrix) is active. ADR: [0079](../decisions/0079-mode-aware-menu-bar.md).

### 0081: Recursive matrix population and automation

*Done.* Stop requiring every service/column in the matrix to be manually typed, and every level of a diagram hierarchy to be manually re-assessed. ADRs: [0088](../decisions/0088-recursive-security-matrix-rollup.md), [0082](../decisions/0082-security-data-schema.md).

### 0082: Select all elements of a type

*Done.* Let the user select every element of a given type (e.g. "all edges") in one action, so a bulk style/property change can be applied to all of them at once via the existing property panel — instead of shift-clicking each one individually. ADR: [0065](../decisions/0065-select-all-of-type.md).

### 0083: Align/distribute selected elements

*Done.* An Edit-menu action to arrange every selected element into an evenly-spaced column or row in one click, instead of manually dragging each one into position. ADR: [0058](../decisions/0058-align-and-distribute-selected.md).

### 0084: Multi-connection-line + reverse edge direction

*Done.* Two separate, small edge-drawing conveniences the user asked for back to back in the same session: 1. ADR: [0059](../decisions/0059-multi-connection-line.md).

### 0085: Drag-select mode as a Setting

*Done.* Let the user choose between React Flow's two built-in drag-to-select behaviors — an element must be entirely inside the drag box (today's only prior behavior), or merely touching it is enough — instead of only ever getting the former.

### 0086: Minor UI improvements

*Done.* Grab-bag epic for small, low-effort UI/UX improvements that come up during regular use — each individually too small to justify its own epic, collected here and picked off as convenient. ADR: [0077](../decisions/0077-orthogonal-edge-segment-dragging.md).

### 0087: Detail file naming reflects label, not type

*Done.* Detail files (epic 0008) were named <node-id>.md — effectively <type>-<uuid>.md (e.g. shape-3f9a1b2c-....md) — which made it very hard to tell which file on disk belonged to which element in the diagram. ADR: [0060](../decisions/0060-detail-file-naming-convention.md).

### 0089: Flippable edge direction — data flow vs. invoker/trigger direction

*Done.* Sometimes an edge's arrow should show the direction data actually flows; sometimes it should show who authenticates/triggers the interaction (often the opposite direction — a client polling a server is data flowing server→client but triggered client→server). ADRs: [0081](../decisions/0081-flippable-edge-direction-sets.md), [0071](../decisions/0071-consolidate-diagram-configuration-panel.md).

### 0090: Reference images attached to shapes

*Done.* Let the user attach one or more images to a shape as reference material — a screenshot, a logo, a diagram fragment, a photo of a whiteboard — viewable in a floating, closable panel while working, never rendered on the canvas or included in exports. ADRs: [0069](../decisions/0069-reference-images.md), [0052](../decisions/0052-settings-ownership-tiers.md), [0006](../decisions/0006-icon-storage-model.md).

### 0091: Remember last opened path, recent diagrams under File

*Done.* Two related file-opening conveniences, requested together: 1. ADR: [0052](../decisions/0052-settings-ownership-tiers.md).

### 0092: Epic subfolders

*Done.* ADR 0061 established an x-prefix filename convention for completed epics but it was never rolled out. The user decided (2026-08-30) to use a docs/planning/epics/completed/ subfolder instead. ADRs: [0061](../decisions/0061-completed-epic-filename-marker.md), [0076](../decisions/0076-completed-epics-subfolder.md), [0002](../decisions/0002-planning-structure.md).

### 0093: Drill-down search across linked diagrams

*Done.* Extend epic 0062's search to reach into linked child diagrams (epic 0009's linked-diagram navigation), not just the currently-open one — useful when a diagram tree is large or not well-maintained enough for the user to already know where something lives. ADR: [0097](../decisions/0097-deep-search-across-linked-diagrams.md).

### 0094: Search by icon

*Done.* Extend epic 0062's search to match on icon identity, not just label/id/tag/details. ADR: [0072](../decisions/0072-search-by-icon.md).

### 0095: Recent diagrams under File

*Done.* A submenu (or flyout list) of recently opened diagrams under File, letting the user reopen one without a picker round-trip — standard desktop-app convention. ADR: [0078](../decisions/0078-recent-diagrams-menu.md).

### 0096: Consolidate diagram-level Configuration panels into DiagramConfigPanel

*Done.* Epic 0073 built a new DiagramConfigPanel (src/renderer/src/components/DiagramConfigPanel.tsx) as the first home for a pure diagram-level Configuration value with no existing panel to live in. ADRs: [0071](../decisions/0071-consolidate-diagram-configuration-panel.md), [0052](../decisions/0052-settings-ownership-tiers.md), [0067](../decisions/0067-max-connection-points-diagram-override.md).

### 0099: Search / isolate by reference presence

*Done.* Make "has one or more reference images" (epic 0090) a matchable facet in the search overlay (epic 0062/ADR 0062), combinable with the existing free-text / tag matching — the user's illustrative example: hasPicture = true & tag=GDPR.PII. ADRs: [0096](../decisions/0096-search-facets-and-shared-match-predicate.md), [0069](../decisions/0069-reference-images.md).

### 0100: Rename "Configuration" → "Diagram settings" and "Settings" → "Preferences"

*Done.* The three ownership tiers (ADR 0052, glossary) are Properties (per-element) / Configuration (per-diagram) / Settings (per-app). ADR: [0052](../decisions/0052-settings-ownership-tiers.md).

### 0101: React Flow render performance, round 2

*Done.* Make ordinary interactions on a large diagram (the 82-node/84-edge Meridian Rail landscape) stop being laggy — picking a colour, selecting shapes, marquee-select, hovering edges. ADRs: [0056](../decisions/0056-diagram-context-rerender-performance.md), [0073](../decisions/0073-react-flow-render-performance-round-2.md).

### 0102: Multi-line element labels

*Done.* Let a shape / container / text-node / edge label hold more than one line — Shift+Enter inserts a newline, Enter still commits. ADR: [0074](../decisions/0074-multi-line-labels.md).

### 0103: Container hierarchy integrity and visibility

*Done.* Fix the class of bugs where a container's parent/child (parentId) data drifts out of sync with what the user sees, and make those relationships visible in the Layers panel so they can be spotted and understood instead of only surfacing as mystery misbehaviour. ADR: [0075](../decisions/0075-container-hierarchy-integrity.md).

### 0106: Per-set edge style (e.g. "Trigger direction" always dashed)

*Done.* Let each edge direction set carry its own default line/marker style, not just its own direction — so a diagram can draw its "Data flow" edges solid black and its "Trigger direction" edges dashed blue without hand-styling every edge. ADRs: [0081](../decisions/0081-flippable-edge-direction-sets.md), [0083](../decisions/0083-per-set-edge-style-as-creation-template.md).

### 0108: Diagnostics — list missing referenced files

*Done.* A "Missing files" section in the Diagnostics panel listing every diagram element that references a file on disk which no longer resolves — a linked diagram, a custom icon, a reference image, a details .md, or a legend entry's custom icon. ADRs: [0084](../decisions/0084-diagnostics-missing-files.md), [0085](../decisions/0085-paste-resource-path-retargeting.md).

### 0113: Reverse direction on an edge selection

*Done.* Let the user flip the direction of several edges at once: select a group of edges (by any existing means), then reverse all of them in one action — instead of right-clicking "Reverse direction" on each edge in turn. ADR: [0087](../decisions/0087-reverse-edge-direction-on-selection.md).

### 0115: File/app version compatibility and data-loss safety

*Superseded.* When a .chd file and the app opening it are version-mismatched badly enough that a correct round-trip can't be guaranteed, the user must: 1. be told clearly and specifically (not a generic parse error), 2. be told which app version to download, and 3. never… ADRs: [0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md), [0086](../decisions/0086-fail-safe-default-resolution.md), [0044](../decisions/0044-app-versioning-scheme.md).

### 0118: Create multiple shapes/containers from a pasted text list

*Done.* Right-click the Shape or Container button in the "Add to diagram" dock palette to open a small text window; paste or type a list of lines, and each non-blank line becomes the label of one new shape (or container) — a fast path for adding several named… ADR: [0089](../decisions/0089-bulk-create-from-text-list.md).

### 0119: Details peek card while holding Ctrl/Cmd over an element

*Done.* Let the canvas act as a browsing surface for the context already captured in Details/tags/links: hold Ctrl (Cmd on Mac) while hovering an element and a small read-only card appears next to it showing what's behind it — without right-click → "See details", and… ADR: [0093](../decisions/0093-details-peek-card-on-modifier-hold.md).

### 0120: Help → Keyboard shortcuts & gestures page

*Done.* A page under the Help menu listing every hotkey and mouse gesture the app supports, with a one-line description each, shown with the right modifier for the OS (Ctrl on Windows/Linux, Cmd on Mac). ADR: [0094](../decisions/0094-command-registry-and-shortcuts-help.md).

### 0121: Copy style / "format painter" apply mode

*Done.* Style one shape, edge, or container the way you want, then apply that style by clicking other elements of the same type, instead of re-setting fill / stroke / thickness / font on each one through the property panel. ADRs: [0095](../decisions/0095-copy-style-apply-mode.md), [0034](../decisions/0034-theme-adaptive-color-value-flip.md).

### 0127: Command palette

*Done.* A keyboard-invoked, searchable launcher for app actions (type "export png", "open diagnostics" → Enter). It is a different thing from the Help → shortcuts page (a static reference), but both read the same command registry. ADR: [0100](../decisions/0100-command-palette-reuses-the-menu-bar.md).

### 0128: External change detection and save-conflict warning

*Done.* Never silently clobber, or silently miss, a change made outside the app — without the app trying to be a merge tool. ADRs: [0091](../decisions/0091-external-change-detection.md), [0040](../decisions/0040-dirty-tracking-and-autosave-design.md).

### 0129: Unified multi-file save and change tracking

*Done.* The user's hunch: saving is a set of parallel, type-specific functions (save_diagram(), save_details(), …) each with its own change-checking, when it should be one flow — find every file with unsaved changes, check each against disk in one place, save each —… ADRs: [0092](../decisions/0092-unified-multi-file-save-and-change-detection.md), [0084](../decisions/0084-diagnostics-missing-files.md), [0040](../decisions/0040-dirty-tracking-and-autosave-design.md), [0091](../decisions/0091-external-change-detection.md).

### 0131: Multi-select resize scales every selected node

*Done.* With several nodes selected, dragging any one node's resize handle resizes all of them by the same percentage, each in place — no reflow of the layout. ADR: [0098](../decisions/0098-multi-select-resize-percentage-scaling.md).

### 0132: Modifier+drag duplicates the dragged selection

*Done.* Holding a modifier while dragging a node (or the selection) leaves the original untouched and drags a fresh copy, like Figma/draw.io. ADR: [0099](../decisions/0099-modifier-drag-duplicate.md).

### 0135: Remove the placeholder anchor node

*Done.* Remove the anchor placeholder node as a user-facing feature. ADRs: [0107](../decisions/0107-remove-anchor-placeholder-node.md), [0015](../decisions/0015-anchor-placeholder-node.md), [0021](../decisions/0021-connection-point-removal-blocked.md), [0059](../decisions/0059-multi-connection-line.md), [0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md), [0101](../decisions/0101-shape-to-entity-rename.md).

### 0136: Associate .chd files with the app (double-click to open)

*Done.* After installing, double-clicking a .chd file in the file manager opens it in this app — in a new window if the app is already running — and .chd files show a recognisable icon. ADR: [0108](../decisions/0108-chd-file-association-and-single-instance.md).

### 0140: Pick a legend line from an edge

*Done.* In the Legend panel, "Line" waits for a click on an edge and copies its line style, markers and colour into the new entry (Esc cancels; the preset picker remains as a fallback). ADR: [0123](../decisions/0123-legend-line-picked-from-an-edge.md).

### 0142: Clear the open Dependabot alerts in the build tooling

*Done.* The open alerts (`node-forge`, `tmp`, `sprintf-js`, and a `vite` advisory) were all in development tooling and none of those packages ships in the app or the extension bundle; the only change made was `vite` 7.3.6 to 7.3.7 within its existing range. The remaining alerts later disappeared from the repository, which the maintainer confirmed on 2026-10-21. No ADR: nothing was decided beyond the lockfile bump.

### 0133: AI onboarding

*Done.* A person who has just installed the app can work with an AI assistant on their diagrams without hand-feeding it a spec, a skill or an MCP server: a top-level AI menu, copy-paste instructions, "Enable AI assistance in a folder…" (the bundled skill plus `AGENTS.md`), the `chd` command line (`spec`, `validate`, `hash`), and a Claude Desktop extension, all behind one stale-edit rule. ADRs: [0103](../decisions/0103-ai-menu-and-feature-preference.md), [0104](../decisions/0104-copy-ai-instructions.md), [0105](../decisions/0105-bundled-ai-material-and-folder-setup.md), [0106](../decisions/0106-chd-command-line-tool.md), [0109](../decisions/0109-stale-edit-check-for-every-ai-write-path.md), [0110](../decisions/0110-claude-desktop-extension.md). Closed with these left open: the folder setup run from a packaged build, the extension on macOS, `chd` on the PATH (and Linux launcher checks: `readlink -f`, the exec bit, deb/AppImage/snap layouts), a real-console check of `chd` output on Windows, and refreshing a folder's copy of the skill after an app upgrade (today: re-run the menu item).

### 0137: Open-source release

*Done.* v0.2.1 (2026-10-19) is the first open-source release: the repository is public with its history and docs, no installers are published, and early adopters build from source. It brought the licence and notices, the CLA and AI-use disclosure, the offline and sandbox hardening, the file/app version warning, CI and Dependabot, the product name and the icon, and folded in five earlier epics (0027, 0053, 0068, 0070, 0115). ADRs: [0111](../decisions/0111-open-source-release-approach.md), [0112](../decisions/0112-electron-hardening-sandbox-and-navigation.md), [0113](../decisions/0113-enforced-offline-behaviour.md), [0114](../decisions/0114-product-name-context-heavy-diagrams.md), [0115](../decisions/0115-paths-stored-in-diagrams-are-untrusted.md), [0117](../decisions/0117-built-in-style-defaults-are-data.md), [0118](../decisions/0118-saved-with-version-marker.md), [0119](../decisions/0119-generated-third-party-notices.md), [0120](../decisions/0120-completed-epics-collapse-into-an-index.md), [0121](../decisions/0121-history-rewritten-before-first-release.md), [0122](../decisions/0122-app-icon-generated-from-one-svg.md). Closed with these left open: SPDX headers in the source files (optional), a social preview image, the Linux build and smoke test (file association, `chd`, Alt+drag duplicate, AppImage/deb; open to contributors, and the README states the status), and macOS, which stays unverified.
