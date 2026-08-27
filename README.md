# context-heavy-diagram-tool

An offline, local, cross-platform (Linux + Windows) desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io.

- **File format**: diagrams are plain JSON (`.chd`), documented independently of this codebase — see [docs/file-format.md](docs/file-format.md) if you want to read, write, or convert them from another tool.
- **Requirements & design**: [docs/project-brief.md](docs/project-brief.md) (original requirements), [docs/architecture/overview.md](docs/architecture/overview.md) (living high-level design), [docs/decisions/](docs/decisions/) (why things are built the way they are), [docs/planning/](docs/planning/) (current backlog/status), [PROGRESS.md](PROGRESS.md) (short pointer to what's happening right now).

## Features

### Local, offline, and yours

- **Works fully offline.** No server, no account, no sign-in — the app is local-only by design.
- **Cross-platform desktop app** (Linux + Windows; a macOS build is documented but not yet produced).
- **Open source**, licensed GPL-3.0-or-later.
- **Autosave and crash recovery** — an unsaved diagram that dies in a crash is offered back on next launch.
- **OS-native everything**: real file dialogs, OS-conventional settings location, light/dark mode that follows the system theme (with per-colour theme-adaptive flipping so hand-picked colours stay legible in both).

### Git-friendly and cooperative

- **Plain-text `.chd` files** — deterministic JSON with a fixed key order, no inline binaries, designed to diff cleanly.
- **One file per diagram**, freely renameable — nothing about opening or navigating a diagram depends on its filename.
- **Cooperate through git** rather than a live server: branch, review diffs, merge, resolve conflicts in the diagram file like any other source.
- **The format is a standalone spec** ([docs/file-format.md](docs/file-format.md)) — a third party can build a compatible importer/exporter without reading this codebase.
- **PNG export** (with an auto-generated legend), for embedding a snapshot in docs or slides.

### Diagram trees and hidden context

- **Linked diagrams / drill-down trees** — a node can link to another `.chd` file; Ctrl/Cmd-click to open it. Links only ever point downward, so any diagram in the tree is independently openable as its own root.
- **Per-node detail sub-layer** — free-form Markdown notes (purpose, integration type, inputs/outputs, …) attached to a node and shown in a side panel, never as another box cluttering the canvas.
- **Reference images** — pin screenshots, photos, or diagram fragments to a shape and view them in floating, zoomable/pannable windows while you work; they never appear on the canvas or in exports.
- **A node is a single draggable entity** — detail content, links, tags, and icons are fields on the node, not separate objects you have to keep aligned.

### Tags, highlights, and focus

- **Unified tag / metadata system** — arbitrary key/value tags on any element, plus diagram-defined *required* tags with allowed-value lists and propagation to child elements.
- **Add any number of highlights** — colour elements by tag value; group related highlights; multiple highlight sets coexist.
- **Legend** — auto-built from active highlights plus manual entries, placeable in any corner, included in PNG export.
- **Search (Ctrl/Cmd+F)** — free-text match over ids, labels, and tag keys/values, with an optional deep search into each node's detail file; cycle through matches and fit the view to each.
- **Isolate a sub-section based on smart searches** — dim everything outside the current search's working set (adjustable opacity) to concentrate on one slice of a busy diagram.
- **Layer panel** — see and reorder every element's stacking order; **select all elements of a type** in one action.
- **Minimap** overview for large diagrams.

### Elements and connections

- **Shapes, containers** (grouping boxes, nestable to any depth), **text annotations** (rotatable), and **freeform curved lines**.
- **Icons** — ~5,800 bundled [Tabler](https://tabler.io/icons) icons (MIT-licensed, no copyright entanglement) plus per-diagram custom icon upload, in up to four corner slots per shape.
- **Edges are always bound to connection points** and re-route automatically on move/resize — never manually redrawn.
- **Configurable connection points** — per-side counts and positions.
- **Edge routing styles** (straight, step, smoothstep, or a gravity-based curve), **manual bend points**, **reverse direction**, **multi-connection wiring**, and a label-position slider.

### Styling

- **Full style panel** — fill, border, font, opacity, and more, for one element or a whole selection.
- **Multiple named style palettes** — keep "Company", "GDPR", "Client" colour/font sets side by side and switch the active one; export a palette to share it with a team.
- **Per-type default styles** and a configurable **canvas background colour**.

### Editing

- Undo / redo, copy / paste (real OS clipboard), duplicate, drag-to-add from the item palette.
- Alignment guides and snapping; **align / distribute** a selection into an evenly-spaced row or column.
- Resize, rotate, lock; drag an edge into empty space to create a shape; drag a file onto the window to open it; reload a diagram from disk; remembers the last-used folder.
- A top menu bar (File / Edit / View) and a right-hand dock for the palette, property panel, and utility panels.

> Advanced features are opt-in: a brand-new diagram with none of the above touched behaves exactly like plain shapes and edges. See [docs/decisions/0054-progressive-disclosure-for-advanced-features.md](docs/decisions/0054-progressive-disclosure-for-advanced-features.md).

## Getting started

### Prerequisites

- **Node.js** — a recent LTS or current release. Developed against Node 24.x / npm 11.x; nothing in this project pins an older version, but if `npm install` misbehaves on an older Node, upgrading is the first thing to try.
- **git**.
- No database, no external services, no `.env` file to configure — the app is fully offline/local. There's also nothing here that needs native-module compilation (no `node-gyp` toolchain, no Visual Studio Build Tools) — `npm install` alone is enough on a fresh machine, including Windows.

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens the app with hot reload (renderer) and auto-restart (main process) via `electron-vite dev`.

Other useful scripts:

```bash
npm run typecheck   # tsc --noEmit for both main/preload and renderer configs
npm run lint        # eslint --cache .
npm run format      # prettier --write .
```

### Debugging in VS Code

`.vscode/launch.json` has a **Debug All** compound launch config that attaches to both the Electron main process and the renderer (Chrome DevTools) in one go — use it instead of `npm run dev` when you need breakpoints.

### Build (packaging)

```bash
# For windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

Packaging is not the focus of day-to-day development (see [docs/decisions/0001-build-tooling.md](docs/decisions/0001-build-tooling.md)) — for regular work, `npm run dev` is what you want.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (both listed in `.vscode/extensions.json` as workspace recommendations — VS Code will prompt to install them on open)
