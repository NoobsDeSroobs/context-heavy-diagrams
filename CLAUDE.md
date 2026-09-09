# CLAUDE.md

Operating rules for Claude Code in this repository. Read this before doing anything else — it takes precedence over general habits/defaults.

## Persistence rule

Everything that needs to survive must be written to disk in this repo, in git-friendly plain text. Claude's private memory system is not the source of truth for this project — the user may delete and recreate the Claude Code project at any time and expects to resume purely from repo contents.

- `docs/project-brief.md` — original project brief. Source of truth for requirements.
- `docs/decisions/` — one markdown file per significant design decision (ADR-style): what was decided, alternatives considered, why. Numbered sequentially (`0001-...md`, `0002-...md`, ...).
- `docs/architecture/` — living high-level documentation: purpose, design principles, stack, component overview. Updated as the system evolves, unlike the frozen brief.
- `docs/file-format.md` — standalone spec of the `.chd` diagram file format, deliberately written so a third party could build a compatible importer/exporter without reading this codebase or its decision history (less lock-in). Update it whenever `src/shared/diagram.ts` changes — it must stay current, not just accurate at the moment it was written.
- `docs/planning/` — epics (`docs/planning/epics/NNNN-title.md`; `…/epics/completed/` once done and confirmed, `…/epics/later/` if parked far out — [ADR 0076](docs/decisions/0076-completed-epics-subfolder.md)) with task checklists inside them. See [docs/planning/README.md](docs/planning/README.md) and [docs/decisions/0002-planning-structure.md](docs/decisions/0002-planning-structure.md).
- `docs/known-issues.md` — a single-file, symptom-first log of real bugs/hard problems found during development, each marked Solved/Worked around/Open with root cause and resolution. Not a duplicate of ADRs or epics' own Notes — a lookup table for "does this look familiar?" across the whole project. See [docs/decisions/0037-known-issues-log.md](docs/decisions/0037-known-issues-log.md). Add an entry whenever a bug takes real investigation to track down, not for routine fixes.
- `PROGRESS.md` — short pointer: current epic/task, last updated. Not a duplicate backlog — the full backlog lives in `docs/planning/`.

Keep these updated as we go, not retroactively.

## Permission rule (human-in-the-loop)

The user is the sole barrier between Claude and anything permanent or running on their machine.

- Creating and editing files inside the project folder: allowed by default, no need to ask. If an operation seems problematic or potentially harmful (large-scale deletion, overwriting something that looks like unsaved user work, a drastic restructure), pause and ask first rather than proceeding.
- Running Bash/PowerShell/terminal commands (`npm install`, `npm run dev`, `git init`, etc.): ask for approval **every single time**. Never assume standing/blanket approval just because a similar command was approved before.
- Exception: creating git branches and making commits **on a feature branch** is pre-approved — no need to ask each time for those specifically.
- Exception: deleting a **local** branch that's already merged into `master` (verify with `git diff master <branch>` — expect no output) is also pre-approved, no need to ask each time. Do this either right after the epic it was for is merged, or batched at the end of a sequenced group of epics — whichever fits the moment. Never delete a branch that isn't confirmed merged, and never touch remote branches (see "Local git only" below).
- Merging a feature branch into `main`/`master` (including via PR) is never something Claude does, under any circumstance. That step always goes through the user.
- Local git only: never `fetch`/`pull`/`push`/create a PR/merge remotely — the user handles all remote git themselves. Claude only ever touches local repo state.

## Cross-platform rule

This tool must work on **Linux and Windows** equally — Linux is a first-class target, not a nice-to-have. The primary dev machine is Windows-only, so Linux-breaking code is easy to write and hard to notice here. When writing or reviewing code:

- Never hardcode path separators or assume `\`. Use `path.join`/`path.resolve`; when a path is *stored* in a file, normalize to `/` (see `resolveLinkPath` in `src/main/linkPaths.ts` and the `.split('\\').join('/')` calls in `src/main/links.ts`).
- No Windows-only APIs, shell built-ins, executable names, or `%APPDATA%`/registry assumptions — use Electron's `app.getPath(...)` for per-OS locations.
- Files are read/written as UTF-8; don't depend on CRLF vs LF.
- Keyboard shortcuts, fonts, and window-chrome behaviour differ per OS — consider both.
- Packaging targets both (`electron-builder.yml`); changes to build config, entitlements, or icons must not assume one OS.

Flag anything that can only be verified on Linux for the user to test there.

## Documentation conventions

Split between in-code and high-level docs:

- **In-code**: technical/functional detail needed to understand a specific piece of code lives next to that code — a one-line comment above a tricky line, or a short block above/below a function definition. Keep it lean: skip comments where the code is already self-explanatory. Never restate what the code obviously does.
- **High-level**: purpose, design principles, how to build/run, functional overview, component overview — these live in `docs/architecture/` (and `docs/` more broadly), as markdown with images/diagrams where useful, organized into a logical tree as it grows. Not duplicated into code comments.

## Collaboration style

- **Design decisions**: Claude acts as a sparring partner / devil's advocate — actively surfaces weaknesses, edge cases, and alternatives rather than agreeing with the first idea on the table.
- **Implementation**: once a design has landed, Claude writes most of the code, but deliberately leaves small, well-contained tasks for the user to implement themselves, for learning purposes. The user is an experienced backend/server developer with no prior GUI/desktop/frontend experience.

## Project summary

Offline, local, cross-platform (Linux + Windows) desktop diagramming tool for IT architecture work. Electron + React + TypeScript, React Flow (`@xyflow/react`) as the canvas engine, plain files on disk for persistence (no DB, no server). See [docs/project-brief.md](docs/project-brief.md) for full requirements and [PROGRESS.md](PROGRESS.md) for current status.
