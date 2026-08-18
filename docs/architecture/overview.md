# Architecture overview

## Purpose

A local, offline desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io. Local-only: no server, no hosting, no real-time collaboration. See [docs/project-brief.md](../project-brief.md) for the full requirements this was commissioned against.

## Design principles

- **A node is a single draggable entity.** Detail content and linked-diagram references are data fields on a node, never separate canvas objects that have to be moved together. This is the central principle the whole design serves — see the brief's "Interaction model" section for the failure modes in other tools it's specifically avoiding.
- **Edges are always logically bound to node connection points.** They re-route automatically on move/resize; never manually re-drawn.
- **Files on disk are the database.** One self-contained folder per diagram (`diagram.json` + `assets/` + `details/*.md`), git-friendly, human-debuggable, no binary blobs inline in JSON. See the brief's "File format & storage design" section for the full rationale.

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
