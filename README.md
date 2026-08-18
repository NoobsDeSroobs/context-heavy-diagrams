# context-heavy-diagram-tool

An offline, local, cross-platform (Linux + Windows) desktop diagramming tool for IT architecture work — filling the gap between restrictive commercial tools and generic box-and-arrow editors like Draw.io.

- **File format**: diagrams are plain JSON (`.chd`), documented independently of this codebase — see [docs/file-format.md](docs/file-format.md) if you want to read, write, or convert them from another tool.
- **Requirements & design**: [docs/project-brief.md](docs/project-brief.md) (original requirements), [docs/architecture/overview.md](docs/architecture/overview.md) (living high-level design), [docs/decisions/](docs/decisions/) (why things are built the way they are), [docs/planning/](docs/planning/) (current backlog/status), [PROGRESS.md](PROGRESS.md) (short pointer to what's happening right now).

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
