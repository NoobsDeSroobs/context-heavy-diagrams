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
- **The file format is documented as a standalone spec, deliberately kept separate from this codebase.** Less lock-in: anyone should be able to write a compatible importer/exporter from [docs/file-format.md](../file-format.md) alone, without reading our TypeScript or decision history. Keep it current whenever `src/shared/diagram/` changes — it's living documentation, not a point-in-time snapshot.
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

Code is grouped by feature inside electron-vite's process folders ([ADR 0125](../decisions/0125-code-packaged-by-feature-inside-the-process-folders.md)). A feature uses the same folder name in each tree where it has code:

- `src/main/<feature>/`: the Node side (disk, dialogs, windows), registering its own IPC handlers from `main/index.ts`.
- `src/renderer/src/<feature>/`: the React UI.
- `src/shared/<feature>/`: pure code with no Node or DOM, used by both and by the CLI and extension. A feature's file-format types are in its `schema.ts`; `shared/diagram/` composes them into `DiagramFile` and holds `serializeDiagram` / `parseDiagram` (see [docs/file-format.md](../file-format.md)).
- `src/preload/` is the bridge, `src/cli/` is `chd export`, `chd check` and `chd diff`, and `extension/` is the Claude Desktop (MCPB) extension, a standalone local MCP server built into `resources/extension/` ([ADR 0110](../decisions/0110-claude-desktop-extension.md)), not part of the Electron bundle.

App-frame files stay at the tree root (`main/index.ts`, `windows.ts`, `App.tsx`, `MenuBar.tsx`, `DiagramDock.tsx`, `UtilityDock.tsx`, `CommandPalette.tsx`, `commands.ts`). Generic widgets (dialogs, context menu, editable label, form fields) are in `renderer/src/ui/`. Styles live beside their feature (`<feature>/<feature>.css`) and `assets/main.css` imports them in an order that keeps every pair of rules that could conflict in its original order; when you add a rule, put it in its feature's file and check it does not depend on coming after a rule from another file. Windows: one `BrowserWindow` per open diagram, with a path→window registry so opening an open file focuses it ([ADR 0023](../decisions/0023-multi-window-diagram-model.md)). The AI side is its own page: [ai-integration.md](ai-integration.md).

| Feature | What it holds |
|---|---|
| `canvas` | `Canvas.tsx`, the one stateful component per window: it holds the nodes and edges, the gestures that edit them (connect, drag, create, paste), the diagram load and the JSX, and calls one hook per feature, each of which owns its own state ([ADR 0126](../decisions/0126-canvas-features-are-hooks-that-own-their-state.md)). `CanvasApi` is what a hook gets from the canvas, `useHistory` is undo/redo as explicit `pushSnapshot()` calls ([ADR 0018](../decisions/0018-undo-redo-explicit-snapshots.md)), `usePanels` is which dock panel is open; `DiagramContext` (callbacks exposed downward; its hook is in `useDiagramContext.ts` because a Context and its hook cannot share a file under `react-refresh/only-export-components`); clipboard; group resize; container removal. Main: the clipboard handlers, since the sandboxed preload cannot use Electron's `clipboard` ([ADR 0112](../decisions/0112-electron-hardening-sandbox-and-navigation.md)). |
| `nodes` | `EntityNode`, `ContainerNode`, `TextNode`, `LineNode` (a freeform curved line, its own node type, [ADR 0050](../decisions/0050-freeform-line-as-node-type.md)), connection points, line gravity presets. |
| `edges` | `LabeledEdge`, markers, flippable direction sets ([ADR 0081](../decisions/0081-flippable-edge-direction-sets.md)), edge style options. |
| `geometry` (shared) | Pure path maths: `bendablePath` (gravity / Catmull-Rom, [ADR 0057](../decisions/0057-edge-routing-style.md)) and `orthogonalPath` (step / smoothstep with segment dragging, [ADR 0077](../decisions/0077-orthogonal-edge-segment-dragging.md)), which deliberately share no code so one cannot regress the other. |
| `styling` | Style palette, pickers, theme hook ([ADR 0027](../decisions/0027-theme-default-follows-system.md)), style defaults as data (shared, [ADR 0117](../decisions/0117-built-in-style-defaults-are-data.md)), the copy-style brush ([ADR 0095](../decisions/0095-copy-style-apply-mode.md)). Main: palette import and export. |
| `icons` | Pickers, built-in icon loading. Main: custom icons in a diagram's sibling `assets/` folder. |
| `tagging` | Metadata, required tags, highlights ([ADR 0022](../decisions/0022-unified-tag-and-metadata-system.md), [0025](../decisions/0025-tagging-and-overlay-visualization.md), [0026](../decisions/0026-grouped-highlights.md)); the shared matching logic is used by the canvas and the export. Main: the link-tree walk behind copying required tags to children ([ADR 0024](../decisions/0024-propagate-required-tags-to-children.md)). |
| `legend` | The legend panel and the legend items and placement shared with the export ([ADR 0033](../decisions/0033-diagram-legend-design.md)). |
| `threat-matrix` | The threat/risk matrix ([ADR 0082](../decisions/0082-security-data-schema.md)). Main: the matrix crawl across linked diagrams. |
| `references` | Reference images in floating viewers ([ADR 0069](../decisions/0069-reference-images.md)). |
| `details` | Detail notes (Markdown files in a diagram's sibling `details/` folder), the details panel and the peek card ([ADR 0093](../decisions/0093-details-peek-card-on-modifier-hold.md)). |
| `links` | Renderer: `useLinks`, Ctrl+click navigation and creating or choosing a link. Main: creating and browsing to linked diagrams, and resolving link paths ([ADR 0115](../decisions/0115-paths-stored-in-diagrams-are-untrusted.md)). |
| `search` | Search overlay ([ADR 0062](../decisions/0062-search-scope-and-matching.md)); the shared model and linked-diagram walk ([ADR 0097](../decisions/0097-deep-search-across-linked-diagrams.md)) run in main too. |
| `document` | Hooks for saving, the window lifecycle (initial load, crash recovery, autosave, the close prompt, file drop), the File commands, dirty state and external-change detection; the conflict dialog and changes since save ([ADR 0092](../decisions/0092-unified-multi-file-save-and-change-detection.md)); the shared `documentSave` plan is executed in main by `documentSaveExec.ts`. |
| `export` | PNG and SVG export, the export dialog, and the pure SVG renderer in `shared/export/` that the canvas export and `chd export` both use ([ADR 0124](../decisions/0124-svg-export-from-a-shared-pure-renderer.md)). |
| `compare` | Reviewing two versions of a diagram. `shared/compare/` is pure: it classifies every element and connection (added, removed, link or note changed, modified), says what changed in words, lists diagram-level changes, builds the drawable copy, groups connections under the element that took them along, and matches elements whose ids were replaced. `main/compare/` holds the compare window (read-only, never a document window), the git reader (`git show` only) and the revert hand-off to the editor window; `renderer/compare/` draws it on the real node and edge components. Used by the app and by `chd diff`. |
| `conformance` (shared) | Checking a diagram against the rules of an architectural style: the profile format and its validator, and the pure checker that `chd check` uses ([ADR 0131](../decisions/0131-conformance-profiles.md), [format](../conformance-profile-format.md)). Built-in profiles are in `resources/profiles/`. |
| `preferences`, `diagram-settings` | The Preferences panel and the Diagram settings panel, kept apart (see the [glossary](glossary.md)). |
| `ai` | The AI menu's install and copy actions ([ai-integration.md](ai-integration.md)). |
| `alignment`, `layers`, `diagnostics`, `bulk-create`, `palette`, `properties` | One panel or dialog each. |

`ui/alerts.ts` and `ui/AlertDialog.tsx` replace the native `window.alert` with an in-app dialog with selectable text and a Copy button.


## Building a distributable

`npm run dev` for development. For a real installable Windows build (unsigned, Phase 1), see [docs/architecture/packaging.md](packaging.md).

## Current status

See [PROGRESS.md](../../PROGRESS.md) and [docs/planning/](../planning/) for what's built and what's next.
