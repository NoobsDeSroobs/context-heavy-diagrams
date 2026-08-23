# Architecture overview

See [docs/architecture/glossary.md](glossary.md) for this project's precise terms for Properties/Configuration/Settings/Views — worth reading before touching anything that sounds like "settings," since this app draws a real distinction between those.

## Purpose

A local, offline desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io. That includes enterprise-architecture-adjacent work (business capability maps, motivation/goals views, application portfolios), not just software/technical diagrams — the goal is to take an architect most of the way there before they need a dedicated EA suite, through flexible generic primitives rather than a formal enforced metamodel (see [ADR 0008](../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)). Local-only: no server, no hosting, no real-time collaboration. See [docs/project-brief.md](../project-brief.md) for the full requirements this was commissioned against.

## Design principles

- **A node is a single draggable entity.** Detail content and linked-diagram references are data fields on a node, never separate canvas objects that have to be moved together. This is the central principle the whole design serves — see the brief's "Interaction model" section for the failure modes in other tools it's specifically avoiding.
- **Edges are always logically bound to node connection points.** They re-route automatically on move/resize; never manually re-drawn.
- **Files on disk are the database.** Each diagram is a single file (plain JSON, custom extension), independently openable and freely renameable — nothing about opening or navigating it depends on its filename. Colocating a diagram's own assets/details in a same-named sibling folder is a recommended convention, not something the app detects by scanning. Linked diagrams are explicit relative paths that only ever point downward (parent → child) — see [docs/decisions/0005-diagram-identity-and-linking.md](../decisions/0005-diagram-identity-and-linking.md) for the full reasoning, including why this supersedes the brief's original always-a-folder framing (the brief itself stays frozen as the historical record; this is where the design actually evolved).
- **The file format is documented as a standalone spec, deliberately kept separate from this codebase.** Less lock-in: anyone should be able to write a compatible importer/exporter from [docs/file-format.md](../file-format.md) alone, without reading our TypeScript or decision history. Keep it current whenever `src/shared/diagram.ts` changes — it's living documentation, not a point-in-time snapshot.
- **User-authored text must work in any language, including right-to-left ones.** Every field where the user types diagram content (shape labels, edge labels, eventually detail Markdown) gets `dir="auto"` and CSS logical alignment (`start`/`end`, never hardcoded `left`/`right`). Cheap to get right from the start, easy to silently violate later if not written down — established in epic 0012.
- **Advanced features are opt-in — the base case never gets harder.** A brand-new diagram with none of this app's optional facets touched (Details, linked diagrams, tags/highlights, the threat/risk matrix, ...) must look and behave exactly like plain shapes-and-edges always did. See [ADR 0054](../decisions/0054-progressive-disclosure-for-advanced-features.md) for the full reasoning — written down explicitly once the feature list grew large and different-in-kind enough (epic 0060) that this stopped being something to just assume.

## Stack

- **Shell**: Electron, scaffolded with `electron-vite` — see [docs/decisions/0001-build-tooling.md](../decisions/0001-build-tooling.md).
- **UI**: React + TypeScript.
- **Canvas**: React Flow (`@xyflow/react`) — pan/zoom, node drag, edge routing, custom node/edge rendering, parent/child (sub-flow) relationships for containers.
- **Persistence**: Electron's native `fs` + file dialogs via IPC (main process owns disk access, renderer talks to it through a preload bridge). No database, no server.

## Process model

Electron runs two JS contexts:
- **Main process** (Node.js) — owns every OS window (one per open diagram, see Component overview below), has filesystem access. This is where diagram files actually get read/written.
- **Renderer process** (Chromium, sandboxed) — the React app. One renderer per window, no direct filesystem access. Every renderer shares the same `localStorage` (app-level preferences like theme) but each owns its own diagram's `nodes`/`edges`/undo history independently.
- **Preload script** — the only bridge between them, exposing a small explicit API (e.g. `window.api.saveDiagram(data)`) instead of giving the renderer raw Node access.

## Component overview

**Main process** (`src/main/`), one small module per concern, each registering its own IPC handlers:
- `windows.ts` — one `BrowserWindow` per open diagram (ADR 0023), a path→window registry so opening an already-open file focuses it instead of duplicating, and the File→Open empty-window-reuse special case (ADR 0023's post-merge addendum).
- `diagram.ts` — save/open/pick-save-path for the `.chd` file itself.
- `links.ts` — creating and browsing to linked diagrams (epic 0009).
- `icons.ts` — custom icon upload/storage in a diagram's sibling `assets/` folder.
- `details.ts` — the detail-sublayer Markdown files in a diagram's sibling `details/` folder.
- `requiredTags.ts` — the directory-bounded link-tree walk behind "copy required tags to children" (epic 0035) — reused as-is by nothing else yet, but written generically enough to be (see epic 0026's Notes on a possible future highlights version).

**Renderer** (`src/renderer/src/`):
- `Canvas.tsx` — the one big stateful component per window: owns `nodes`/`edges` (via React Flow's own state hooks), undo/redo history, diagram-level `metadata`/`requiredTags`/`highlights`, and every save/load/link-navigation flow. Deliberately not split further — see ADR 0018 for why undo/redo in particular ended up as explicit `pushSnapshot()` calls at each mutation site rather than a reactive effect.
- `DiagramContext.tsx` — the callbacks `Canvas.tsx` exposes downward (open a picker, push an undo snapshot, look up current highlight matches, …) so node/edge components can trigger cross-cutting behavor without prop-drilling.
- Node components (`nodes/`): `ShapeNode`, `ContainerNode`, `TextNode`, `AnchorNode` (epic 0014's placeholder-until-resolved node for drag-to-empty-space), `LineNode` (epic 0064/ADR 0050's freeform curved line — deliberately its own node type, not a variant of edges). Edge: `edges/LabeledEdge.tsx`.
- `geometry/bendablePath.ts` — pure, dependency-free point-list-to-SVG-path math (per-point "gravity"/Catmull-Rom tension, converted to piecewise cubic bezier) behind `LineNode`'s curve — kept free of any "node"/"edge" concept specifically so a future bendable-edge type ([epic 0032](../planning/epics/0032-edge-routing-and-waypoints.md)) can reuse it unchanged.
- `panels/` + `components/` — the UI chrome: `DiagramDock` (item palette / property panel, mutually exclusive per ADR 0013), `UtilityDock` hosting `DetailsPanel`/`RequiredTagsPanel`/`DiagnosticsPanel`/`HighlightsPanel`/`LayerPanel`/`SettingsPanel`/`StylePalettePanel`/`GravityPresetsPanel` (also mutually exclusive, one at a time), plus anchored popups (`IconPicker`, `ColorPickerPopup`, `StylePicker`, `ContextMenu`).
- `theme.ts` — the light/dark theme hook (epic 0005/ADR 0027), paired with `assets/base.css`'s CSS-variable theme layer.
- `highlights.ts` — pure matching/grouping/reconcile logic for tag-based highlights (epics 0026/0036), imported by both `Canvas.tsx` and the node/edge components that render matches.

**Shared** (`src/shared/diagram.ts`) — the `.chd` file format's TypeScript types plus `serializeDiagram`/`parseDiagram`, imported by both main (to validate/write) and renderer (to build/read). See [docs/file-format.md](../file-format.md) for the format itself, kept as a standalone spec.

## Building a distributable

`npm run dev` for development. For a real installable Windows build (unsigned, Phase 1 placeholder branding — see [epic 0053](../planning/epics/0053-installable-distribution.md)), see [docs/architecture/packaging.md](packaging.md).

## Current status

See [PROGRESS.md](../../PROGRESS.md) and [docs/planning/](../planning/) for what's built and what's next.
