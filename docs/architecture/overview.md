# Architecture overview

## Purpose

A local, offline desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io. That includes enterprise-architecture-adjacent work (business capability maps, motivation/goals views, application portfolios), not just software/technical diagrams — the goal is to take an architect most of the way there before they need a dedicated EA suite, through flexible generic primitives rather than a formal enforced metamodel (see [ADR 0008](../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)). Local-only: no server, no hosting, no real-time collaboration. See [docs/project-brief.md](../project-brief.md) for the full requirements this was commissioned against.

## Design principles

- **A node is a single draggable entity.** Detail content and linked-diagram references are data fields on a node, never separate canvas objects that have to be moved together. This is the central principle the whole design serves — see the brief's "Interaction model" section for the failure modes in other tools it's specifically avoiding.
- **Edges are always logically bound to node connection points.** They re-route automatically on move/resize; never manually re-drawn.
- **Files on disk are the database.** Each diagram is a single file (plain JSON, custom extension), independently openable and freely renameable — nothing about opening or navigating it depends on its filename. Colocating a diagram's own assets/details in a same-named sibling folder is a recommended convention, not something the app detects by scanning. Linked diagrams are explicit relative paths that only ever point downward (parent → child) — see [docs/decisions/0005-diagram-identity-and-linking.md](../decisions/0005-diagram-identity-and-linking.md) for the full reasoning, including why this supersedes the brief's original always-a-folder framing (the brief itself stays frozen as the historical record; this is where the design actually evolved).
- **The file format is documented as a standalone spec, deliberately kept separate from this codebase.** Less lock-in: anyone should be able to write a compatible importer/exporter from [docs/file-format.md](../file-format.md) alone, without reading our TypeScript or decision history. Keep it current whenever `src/shared/diagram.ts` changes — it's living documentation, not a point-in-time snapshot.
- **User-authored text must work in any language, including right-to-left ones.** Every field where the user types diagram content (shape labels, edge labels, eventually detail Markdown) gets `dir="auto"` and CSS logical alignment (`start`/`end`, never hardcoded `left`/`right`). Cheap to get right from the start, easy to silently violate later if not written down — established in epic 0012.

## Stack

- **Shell**: Electron, scaffolded with `electron-vite` — see [docs/decisions/0001-build-tooling.md](../decisions/0001-build-tooling.md).
- **UI**: React + TypeScript.
- **Canvas**: React Flow (`@xyflow/react`) — pan/zoom, node drag, edge routing, custom node/edge rendering, parent/child (sub-flow) relationships for containers.
- **Persistence**: Electron's native `fs` + file dialogs via IPC (main process owns disk access, renderer talks to it through a preload bridge). No database, no server.

## Process model

Electron runs two JS contexts:
- **Main process** (Node.js) — owns the OS window, has filesystem access. This is where diagram files actually get read/written.
- **Renderer process** (Chromium, sandboxed) — the React app. No direct filesystem access.
- **Preload script** — the only bridge between them, exposing a small explicit API (e.g. `window.api.saveDiagram(data)`) instead of giving the renderer raw Node access.

## Component overview

Not written yet — there's nothing built to describe. Will be added once the shell and first custom nodes exist (epic [0001](../planning/epics/0001-bare-electron-react-shell.md) onward).

## Current status

See [PROGRESS.md](../../PROGRESS.md) and [docs/planning/](../planning/) for what's built and what's next.
