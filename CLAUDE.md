# CLAUDE.md

Operating rules for Claude Code in this repository. Read this before doing anything else — it takes precedence over general habits/defaults.

## Persistence rule

Everything that needs to survive must be written to disk in this repo, in git-friendly plain text. Claude's private memory system is not the source of truth for this project — the user may delete and recreate the Claude Code project at any time and expects to resume purely from repo contents.

- `docs/project-brief.md` — original project brief. Source of truth for requirements.
- `docs/decisions/` — one markdown file per significant design decision (ADR-style): what was decided, alternatives considered, why. Numbered sequentially (`0001-...md`, `0002-...md`, ...).
- `docs/architecture/` — living high-level documentation: purpose, design principles, stack, component overview. Updated as the system evolves, unlike the frozen brief.
- `docs/planning/` — epics (`docs/planning/epics/NNNN-title.md`) with task checklists inside them. See [docs/planning/README.md](docs/planning/README.md) and [docs/decisions/0002-planning-structure.md](docs/decisions/0002-planning-structure.md).
- `PROGRESS.md` — short pointer: current epic/task, last updated. Not a duplicate backlog — the full backlog lives in `docs/planning/`.

Keep these updated as we go, not retroactively.

## Permission rule (human-in-the-loop)

The user is the sole barrier between Claude and anything permanent or running on their machine.

- Creating and editing files inside the project folder: allowed by default, no need to ask. If an operation seems problematic or potentially harmful (large-scale deletion, overwriting something that looks like unsaved user work, a drastic restructure), pause and ask first rather than proceeding.
- Running Bash/PowerShell/terminal commands (`npm install`, `npm run dev`, `git init`, etc.): ask for approval **every single time**. Never assume standing/blanket approval just because a similar command was approved before.
- Exception: creating git branches and making commits **on a feature branch** is pre-approved — no need to ask each time for those specifically.
- Merging a feature branch into `main`/`master` (including via PR) is never something Claude does, under any circumstance. That step always goes through the user.

## Documentation conventions

Split between in-code and high-level docs:

- **In-code**: technical/functional detail needed to understand a specific piece of code lives next to that code — a one-line comment above a tricky line, or a short block above/below a function definition. Keep it lean: skip comments where the code is already self-explanatory. Never restate what the code obviously does.
- **High-level**: purpose, design principles, how to build/run, functional overview, component overview — these live in `docs/architecture/` (and `docs/` more broadly), as markdown with images/diagrams where useful, organized into a logical tree as it grows. Not duplicated into code comments.

## Collaboration style

- **Design decisions**: Claude acts as a sparring partner / devil's advocate — actively surfaces weaknesses, edge cases, and alternatives rather than agreeing with the first idea on the table.
- **Implementation**: once a design has landed, Claude writes most of the code, but deliberately leaves small, well-contained tasks for the user to implement themselves, for learning purposes. The user is an experienced backend/server developer with no prior GUI/desktop/frontend experience.

## Project summary

Offline, local, cross-platform (Linux + Windows) desktop diagramming tool for IT architecture work. Electron + React + TypeScript, React Flow (`@xyflow/react`) as the canvas engine, plain files on disk for persistence (no DB, no server). See [docs/project-brief.md](docs/project-brief.md) for full requirements and [PROGRESS.md](PROGRESS.md) for current status.
