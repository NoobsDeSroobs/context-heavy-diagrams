# Architecture overview

See [docs/architecture/glossary.md](glossary.md) for this project's precise terms for Properties / Diagram settings / Preferences / Views — worth reading before touching anything that sounds like "settings," since this app draws a real distinction between those.

## Purpose

A local, offline, general-purpose desktop diagramming tool, filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io. Its main use so far is IT architecture, including enterprise-architecture-adjacent work (business capability maps, motivation/goals views, application portfolios) and process / workflow modelling, not just software/technical diagrams — the goal is to take an architect most of the way there before they need a dedicated EA or process suite, through flexible generic primitives rather than a formal enforced metamodel (see [ADR 0008](../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md) and [ADR 0080](../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md) — BPMN's vocabulary is adopted for recognisability, not its grammar). Local-only: no server, no hosting, no real-time collaboration. See [docs/project-brief.md](../project-brief.md) for the full requirements this was commissioned against.

### What existing tools get wrong (guiding pet peeves)

A vague, non-exhaustive list of complaints against tools already on the market, kept as a reframing of the brief's motivation rather than a spec — not every item maps to a shipped or even planned feature, and it isn't meant to be re-litigated item by item against every competitor that comes up. No single existing tool clears the whole list; each trades away two or three items to be good at the others (Visio: rich linked context, but proprietary and not git-friendly; Ardoq: flexible and powerful, but expensive and not git-friendly; D2 (d2lang.com): git-friendly, free/open, custom styling, but no persistent interactive session state — no per-node hidden context, no drill-down linking, no smart interactive features, since it's a text-to-diagram compiler, not an editor; draw.io-style tools: free-ish and flexible, but exactly the "overly constrained / low context / no smart features" complaints below). This combination — not any single feature — is the actual thesis for building a dedicated tool instead of adopting one of these.

- Low context (no room for rich per-element notes/purpose without cluttering the diagram itself)
- No legend
- Overly constrained (rigid grammar/metamodel fights the user more than it helps)
- No flexible smart features baked in
- Multiple files needed to show the same system from multiple views, with no real linking between them
- Bloated
- No smart support for icons
- Git-unfriendly / can't be diffed or version-controlled easily
- No way to handle light vs dark mode preferences
- Autosave and crash recovery missing
- No minimap
- No metadata
- No selective highlighting
- Requires an online connection
- Proprietary formats
- Closed source
- Copyright/licensing entanglements (e.g. bundled icon sets)
- Not free
- No custom styles (colours and fonts)

## Design principles

- **A node is a single draggable entity.** Detail content and linked-diagram references are data fields on a node, never separate canvas objects that have to be moved together. This is the central principle the whole design serves — see the brief's "Interaction model" section for the failure modes in other tools it's specifically avoiding.
- **Edges are always logically bound to node connection points.** They re-route automatically on move/resize; never manually re-drawn.
- **Files on disk are the database.** Each diagram is a single file (plain JSON, custom extension), independently openable and freely renameable — nothing about opening or navigating it depends on its filename. Colocating a diagram's own assets/details in a same-named sibling folder is a recommended convention, not something the app detects by scanning. Linked diagrams are explicit relative paths that only ever point downward (parent → child) — see [docs/decisions/0005-diagram-identity-and-linking.md](../decisions/0005-diagram-identity-and-linking.md) for the full reasoning, including why this supersedes the brief's original always-a-folder framing (the brief itself stays frozen as the historical record; this is where the design actually evolved).
- **The file format is documented as a standalone spec, deliberately kept separate from this codebase.** Less lock-in: anyone should be able to write a compatible importer/exporter from [docs/file-format.md](../file-format.md) alone, without reading our TypeScript or decision history. Keep it current whenever `src/shared/diagram.ts` changes — it's living documentation, not a point-in-time snapshot.
- **User-authored text must work in any language, including right-to-left ones.** Every field where the user types diagram content (shape labels, edge labels, eventually detail Markdown) gets `dir="auto"` and CSS logical alignment (`start`/`end`, never hardcoded `left`/`right`). Cheap to get right from the start, easy to silently violate later if not written down — a standing rule since the editable-labels work.
- **Advanced features are opt-in — the base case never gets harder.** A brand-new diagram with none of this app's optional facets touched (Details, linked diagrams, tags/highlights, the threat/risk matrix, ...) must look and behave exactly like plain shapes-and-edges always did. See [ADR 0054](../decisions/0054-progressive-disclosure-for-advanced-features.md) for the full reasoning — written down explicitly once the feature list grew large and different-in-kind enough (the threat/risk matrix) that this stopped being something to just assume.
- **Every AI write path checks for a stale edit.** Any feature that lets an assistant write a diagram — the skill, the `chd` CLI, the Claude Desktop extension, anything added later — must refuse (or instruct the writer to redo its edit) when the file changed since the version the edit was based on, using one shared fingerprint (SHA-256 of the file bytes). A standing rule: see [ADR 0109](../decisions/0109-stale-edit-check-for-every-ai-write-path.md).
- **A missing or unrecognized field resolves to this app's own full default behavior, never a degraded fallback.** Given the format's own backward/forward-compatibility promise and third-party-writable goal, "the file doesn't look quite like what this build expects" is routine, not exceptional — and the one acceptable way to handle it is to behave *exactly* as if the documented default had been written explicitly, not to silently fall through to some other, lesser code path. See [ADR 0086](../decisions/0086-fail-safe-default-resolution.md), written after exactly that happened (a hand-authored edge with no `type` field silently lost styling/highlighting/routing, no error, no visible sign anything was wrong).

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

How an assistant gets the format knowledge and a way to check its edits (the AI menu, the skill, the `chd` command line and the Claude Desktop extension) is its own page: [docs/architecture/ai-integration.md](ai-integration.md).

**Main process** (`src/main/`), one small module per concern, each registering its own IPC handlers:
- `windows.ts` — one `BrowserWindow` per open diagram (ADR 0023), a path→window registry so opening an already-open file focuses it instead of duplicating, and the File→Open empty-window-reuse special case (ADR 0023's post-merge addendum).
- `diagram.ts` — open/pick-save-path for the `.chd` file, plus `document:save` (saving the diagram *and* the detail notes it owns as one plan), `files:check` (the one "did it change on disk" detector) and the interim save-conflict popup ([ADR 0092](../decisions/0092-unified-multi-file-save-and-change-detection.md), which superseded ADR 0091's structure). `documentSaveExec.ts` executes a plan in the crash-safe order (Electron-free, unit-tested); `fileStamp.ts` is the tiny `mtime:size` fingerprint. `details.ts` only *reads* notes now. Shared, pure and unit-tested: `src/shared/documentSave.ts` (per-note shadows + `planSave`) and `detailPaths.ts`. Run the tests with `npm test`. The per-file save-conflict dialog is `components/ConflictDialog.tsx` (opened via `conflictDialog.ts`); the choice logic is the pure `resolveConflicts` in `documentSave.ts`.
- `links.ts` — creating and browsing to linked diagrams.
- `icons.ts` — custom icon upload/storage in a diagram's sibling `assets/` folder.
- `details.ts` — the detail-sublayer Markdown files in a diagram's sibling `details/` folder.
- `requiredTags.ts` — the directory-bounded link-tree walk behind "copy required tags to children" ([ADR 0024](../decisions/0024-propagate-required-tags-to-children.md)) — reused as-is by nothing else yet, but written generically enough to be (a future highlights version is plausible).

**Renderer** (`src/renderer/src/`):
- `Canvas.tsx` — the one big stateful component per window: owns `nodes`/`edges` (via React Flow's own state hooks), undo/redo history, diagram-level `metadata`/`requiredTags`/`highlights`, and every save/load/link-navigation flow. Deliberately not split further — see ADR 0018 for why undo/redo in particular ended up as explicit `pushSnapshot()` calls at each mutation site rather than a reactive effect.
- `DiagramContext.tsx` — the callbacks `Canvas.tsx` exposes downward (open a picker, push an undo snapshot, look up current highlight matches, …) so node/edge components can trigger cross-cutting behavor without prop-drilling. Its accessor hook lives separately in `useDiagramContext.ts` — a Context object and a hook that reads it can't share one file without tripping `react-refresh/only-export-components`, even though that pairing is otherwise idiomatic React.
- Node components (`nodes/`): `EntityNode`, `ContainerNode`, `TextNode`, `LineNode` ([ADR 0050](../decisions/0050-freeform-line-as-node-type.md)'s freeform curved line — deliberately its own node type, not a variant of edges). Edge: `edges/LabeledEdge.tsx`.
- `geometry/bendablePath.ts` — pure, dependency-free point-list-to-SVG-path math (per-point "gravity"/Catmull-Rom tension, converted to piecewise cubic bezier) behind `LineNode`'s curve — kept free of any "node"/"edge" concept specifically so the bendable-edge routing style ([ADR 0057](../decisions/0057-edge-routing-style.md)) can reuse it unchanged.
- `geometry/orthogonalPath.ts` — the `step` / `smoothstep` edge router: right-angled path through optional manual waypoints, plus the segment-drag math (move a segment along its normal, keep 90° corners). Deliberately shares no code with `bendablePath.ts` so an orthogonal-routing change can't regress catmull-rom-routed edges ([ADR 0077](../decisions/0077-orthogonal-edge-segment-dragging.md)).
- `extension/` — the Claude Desktop (MCPB) extension, a standalone local MCP server built into `resources/extension/` ([ADR 0110](../decisions/0110-claude-desktop-extension.md)); plain ESM, reuses the skill's validator and spec text, not part of the Electron bundle.
- `panels/` + `components/` — the UI chrome: `DiagramDock` (item palette / property panel, mutually exclusive per ADR 0013), `UtilityDock` hosting `DetailsPanel`/`DiagnosticsPanel`/`LayerPanel`/`ReferencesPanel`/`PreferencesPanel`/`StylePalettePanel`/`AlignDistributePanel`/`DiagramSettingsPanel` (also mutually exclusive, one at a time — `DiagramSettingsPanel` folds the former `RequiredTagsPanel` and `GravityPresetsPanel` in as collapsible sections, see [ADR 0071](../decisions/0071-consolidate-diagram-configuration-panel.md)), plus anchored/floating popups (`IconPicker`, `IconBrowser` (the shared icon search-box + built-in/custom grids, wrapped by both `IconPicker` and `SearchOverlay`'s "search by icon" popup, see [ADR 0072](../decisions/0072-search-by-icon.md)), `ColorPickerPopup`, `StylePicker`, `ContextMenu`, `styleBrush.ts` (pure capture/apply core of the copy-style "format painter" mode, see [ADR 0095](../decisions/0095-copy-style-apply-mode.md)), `ShortcutsDialog` (Help → Keyboard shortcuts…, rendered from the command registry `commands.ts` that Canvas's keydown handler and the menu bar accelerators also read, see [ADR 0094](../decisions/0094-command-registry-and-shortcuts-help.md)), `PeekCard` (read-only label/tags/details/link card shown while Ctrl/Cmd is held over a node, driven by the `useDetailsPeek` hook, see [ADR 0093](../decisions/0093-details-peek-card-on-modifier-hold.md)), `LegendPanel`, `HighlightsPanel`, `SearchOverlay` — Ctrl+F-triggered, fixed top-right rather than anchored to a button, see [ADR 0062](../decisions/0062-search-scope-and-matching.md)).
- `alerts.ts` + `components/AlertDialog.tsx` — `showAlert(message)` replaces the native `window.alert` everywhere in the renderer: an in-app dialog with selectable text and a Copy button (native alert text can't be selected). Non-blocking; `confirm()` questions are still native.
- `theme.ts` — the light/dark theme hook ([ADR 0027](../decisions/0027-theme-default-follows-system.md)), paired with `assets/base.css`'s CSS-variable theme layer.
- `highlights.ts` — pure matching/grouping/reconcile logic for tag-based highlights ([ADR 0025](../decisions/0025-tagging-and-overlay-visualization.md)/[ADR 0026](../decisions/0026-grouped-highlights.md)), imported by both `Canvas.tsx` and the node/edge components that render matches.
- `search.ts` — re-exports the pure search model, now in `src/shared/search.ts` so the main process can run the same predicate over linked diagrams ([ADR 0097](../decisions/0097-deep-search-across-linked-diagrams.md); the walk itself is `src/shared/linkedSearch.ts`, wired to the filesystem by `src/main/linkedSearch.ts`), and holds the React-only `isolateStyle`. The shared model: `matchesSearchQuery` (id/label/tag substring, [ADR 0062](../decisions/0062-search-scope-and-matching.md)) and `iconRefKey`/`nodeHasIcon` (exact icon-identity match, [ADR 0072](../decisions/0072-search-by-icon.md)); same "pure logic, imported by Canvas.tsx and the render layer" shape as `highlights.ts`, deliberately kept separate since the two systems are independent (a search result and a highlight can both be true of the same element at once). Also holds `isolateStyle()` ([ADR 0063](../decisions/0063-isolate-mode.md)), the one shared per-element opacity computation behind "Isolate" — every node/edge component folds its result into its own inline style.

**Shared** (`src/shared/diagram.ts`) — the `.chd` file format's TypeScript types plus `serializeDiagram`/`parseDiagram`, imported by both main (to validate/write) and renderer (to build/read). See [docs/file-format.md](../file-format.md) for the format itself, kept as a standalone spec.

**Rendering rules shared with the SVG export** — `src/shared/geometry/` (edge routing, connection points, curve and right-angle paths), `styleDefaults.ts`, `highlights.ts`, `zIndexOrdering.ts` and `src/shared/svg/` (colour and theme flip, marker shapes, resolved appearance, text estimate, the pure `renderDiagramSvg`). The canvas and the export both import these, so a diagram is routed and coloured the same on screen and in the file. `src/cli/exportCommand.ts` is `chd export`. Which parts are shared and which are mirrored by hand: [ADR 0124](../decisions/0124-svg-export-from-a-shared-pure-renderer.md).

## Building a distributable

`npm run dev` for development. For a real installable Windows build (unsigned, Phase 1), see [docs/architecture/packaging.md](packaging.md).

## Current status

See [PROGRESS.md](../../PROGRESS.md) and [docs/planning/](../planning/) for what's built and what's next.
