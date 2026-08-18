# context-heavy-diagram-tool

An offline, local, cross-platform (Linux + Windows) desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io.

- **File format**: diagrams are plain JSON (`.chd`), documented independently of this codebase — see [docs/file-format.md](docs/file-format.md) if you want to read, write, or convert them from another tool.
- **Requirements & design**: [docs/project-brief.md](docs/project-brief.md) (original requirements), [docs/architecture/overview.md](docs/architecture/overview.md) (living high-level design), [docs/decisions/](docs/decisions/) (why things are built the way they are), [docs/planning/](docs/planning/) (current backlog/status), [PROGRESS.md](PROGRESS.md) (short pointer to what's happening right now).

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
