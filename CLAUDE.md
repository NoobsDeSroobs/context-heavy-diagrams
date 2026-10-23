# CLAUDE.md

Conventions for AI assistants (and people) working in this repository. They apply to every change. See also [CONTRIBUTING.md](CONTRIBUTING.md): this is a personal project, the maintainer decides what goes in, and contributions are given under the terms stated there.

## Project summary

Offline, local, cross-platform (Linux + Windows) desktop diagramming tool. Electron + React + TypeScript, React Flow (`@xyflow/react`) as the canvas engine, plain files on disk for persistence (no DB, no server). See [docs/project-brief.md](docs/project-brief.md) for the original requirements and [PROGRESS.md](PROGRESS.md) for current status.

Before sending a change, `npm run typecheck`, `npm run lint` and `npm test` must pass.

## Persistence rule

Everything that needs to survive is written to disk in this repo, in git-friendly plain text. Do not rely on an assistant's private memory for project knowledge.

- `docs/project-brief.md` — original project brief. Source of truth for requirements.
- `docs/decisions/` — one markdown file per significant design decision (ADR-style): what was decided, alternatives considered, why. Numbered sequentially (`0001-...md`, `0002-...md`, ...).
- `docs/architecture/` — living high-level documentation: purpose, design principles, stack, component overview. Updated as the system evolves, unlike the frozen brief.
- `docs/file-format.md` — standalone spec of the `.chd` diagram file format, deliberately written so a third party could build a compatible importer/exporter without reading this codebase or its decision history (less lock-in). Update it whenever a `schema.ts` under `src/shared/` changes — it must stay current, not just accurate at the moment it was written.
- `docs/planning/` — epics (`docs/planning/epics/NNNN-title.md`; `…/epics/later/` if parked far out; once an epic is done and confirmed it becomes an entry in [`docs/planning/completed-epics.md`](docs/planning/completed-epics.md) and its file is deleted — [ADR 0120](docs/decisions/0120-completed-epics-collapse-into-an-index.md)) with task checklists inside them. See [docs/planning/README.md](docs/planning/README.md) and [docs/decisions/0002-planning-structure.md](docs/decisions/0002-planning-structure.md).
- `docs/known-issues.md` — a single-file, symptom-first log of real bugs/hard problems found during development, each marked Solved/Worked around/Open with root cause and resolution. Not a duplicate of ADRs or epics' own Notes — a lookup table for "does this look familiar?" across the whole project. See [docs/decisions/0037-known-issues-log.md](docs/decisions/0037-known-issues-log.md). Add an entry whenever a bug takes real investigation to track down, not for routine fixes.
- `PROGRESS.md` — short pointer: current epic/task, last updated. Not a duplicate backlog — the full backlog lives in `docs/planning/`. Keep it frugal: it is a work document for the current stretch, so delete items when they finish instead of logging them (the epic and `git log` hold the history).
- `THIRD-PARTY-NOTICES.md` — generated; after adding or updating a dependency run `npm run notices` ([ADR 0119](docs/decisions/0119-generated-third-party-notices.md)).

Keep these updated as the work happens, not retroactively.

## Decision records

A change that makes a real design choice gets an ADR (what was decided, what else was considered, why), not only the big ones. An ADR never refers to temporary working documentation in any way: no epics, no `PROGRESS.md`, no planning notes, no links, no numbers, no mention of a "parked" or "later" epic. Those are deleted or rewritten as the work moves on, and the ADR would be wrong the moment they are. It states the trigger and the scope directly ("not covered in the first version"). ADR-to-ADR links are fine, and an epic or planning note may link to an ADR. Do not run Prettier over `docs/**/*.md`: it reformats every table and buries a small edit in a huge diff; format code only.

## Code layout

Code is grouped by feature inside `src/main`, `src/renderer/src` and `src/shared` ([ADR 0125](docs/decisions/0125-code-packaged-by-feature-inside-the-process-folders.md)); a feature uses the same folder name in each tree.

- `src/shared/` is pure: no Node, no DOM, no `electron`. The renderer never imports `main/`. Both are lint rules.
- A feature's persisted types live in `src/shared/<feature>/schema.ts`; `src/shared/diagram/` composes them into `DiagramFile`. Changing one means updating `docs/file-format.md`.
- App-frame files stay at the tree root, generic widgets go in `renderer/src/ui/`.
- Never two files in one folder whose names differ only by case (`Foo.tsx` and `foo.ts`): TypeScript on Windows cannot tell them apart.
- Tests sit beside the code: `*.test.mjs` run on `node --test` (pure code with no aliases), `*.test.ts` / `*.test.tsx` on Vitest ([ADR 0127](docs/decisions/0127-vitest-for-renderer-tests.md)); `npm test` runs both.

## Cross-platform rule

This tool must work on **Linux and Windows** equally — Linux is a first-class target, not a nice-to-have. The maintainer's main machine is Windows, so Linux-breaking code is easy to write and hard to notice. When writing or reviewing code:

- Never hardcode path separators or assume `\`. Use `path.join`/`path.resolve`; when a path is *stored* in a file, normalize to `/` (see `resolveLinkPath` in `src/main/links/linkPaths.ts` and the `.split('\\').join('/')` calls in `src/main/links/links.ts`).
- No Windows-only APIs, shell built-ins, executable names, or `%APPDATA%`/registry assumptions — use Electron's `app.getPath(...)` for per-OS locations.
- Files are read/written as UTF-8; don't depend on CRLF vs LF.
- Keyboard shortcuts, fonts, and window-chrome behaviour differ per OS — consider both.
- Packaging targets both (`electron-builder.yml`); changes to build config, entitlements, or icons must not assume one OS.

Flag anything that can only be verified on one OS so someone can test it there.

## Security rules

- **The app stays offline.** Nothing may make a network request; a test fails if a network API appears in `src/`, `extension/` or the CLI ([ADR 0113](docs/decisions/0113-enforced-offline-behaviour.md)).
- **Paths stored inside a `.chd` file are untrusted.** Resolve them against the diagram's folder and keep them inside it ([ADR 0115](docs/decisions/0115-paths-stored-in-diagrams-are-untrusted.md)).
- The renderer is sandboxed with a narrow bridge to the main process ([ADR 0112](docs/decisions/0112-electron-hardening-sandbox-and-navigation.md)); don't widen it without a design pass.

## Documentation conventions

Split between in-code and high-level docs:

- **In-code**: technical/functional detail needed to understand a specific piece of code lives next to that code — a one-line comment above a tricky line, or a short block above/below a function definition. Keep it lean: skip comments where the code is already self-explanatory. Never restate what the code obviously does.
- **Comments cite ADRs, never epics.** Epics are work documents that get collapsed into an index and deleted, so a citation in code goes dead. A comment states the rule or the reason; who asked for something, or when, belongs in the ADR, not above the code. If a comment needs more than a few lines of rationale, the rationale belongs in an ADR and the comment links to it.
- **High-level**: purpose, design principles, how to build/run, functional overview, component overview — these live in `docs/architecture/` (and `docs/` more broadly), as markdown with images/diagrams where useful, organized into a logical tree as it grows. Not duplicated into code comments.

## Standing design rule: AI write paths

Any feature (existing or new) that lets an AI assistant write a `.chd` diagram — the bundled skill, `AGENTS.md` / copy-paste instructions, the `chd` CLI, the Claude Desktop (MCPB) extension, an in-app AI action — must include the stale-edit check: a write to an existing file is conditional on it being unchanged since the version the edit was based on (SHA-256 of the raw bytes), and a create fails if the file exists. See [docs/decisions/0109-stale-edit-check-for-every-ai-write-path.md](docs/decisions/0109-stale-edit-check-for-every-ai-write-path.md). Raise it in the design of any new writer rather than adding it afterwards.
