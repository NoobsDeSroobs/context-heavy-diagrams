# 0105: Bundled AI material (`resources/ai`) and "Enable AI assistance in a folder"

## Status
Accepted (2026-10-15).

## Context
An agent that works in a folder (Claude Code, Cursor, Codex) reads `AGENTS.md`
/ `CLAUDE.md` and, for Claude Code, project skills under `.claude/skills`. A
non-technical user will never write those by hand. The `chd-diagrams` skill
already existed, tracked at `.claude/skills/chd-diagrams` in this repo, with a
Python validator — fine for the developer, unusable for an end user (no Python,
no repo).

## Decision
- **Source of truth: `resources/ai/`** — `AGENTS.md`, `CLAUDE.md` (templates)
  and `skills/chd-diagrams/`. `resources/` is already part of the packaged app
  (`asarUnpack: resources/**`), so it ships with no build-config change, and
  the app reads it from `app.getAppPath()/resources/ai` in dev and packaged.
  Once the repo is public it is also where people read the full skill.
- **The repo's own `.claude/skills/chd-diagrams` becomes a generated copy**
  (`npm run sync-ai`, `scripts/sync-ai.mjs`), so Claude Code keeps loading it
  when working on this repo. A unit test fails if the two diverge. Alternatives:
  keep the skill in `.claude` and copy it into the bundle at build time (needs
  special dev-mode path handling); a symlink (unreliable on Windows).
- **AI → "Enable AI assistance in a folder…"** opens the OS folder picker (the
  user's consent: nothing is written outside the chosen folder), then writes
  `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`) and `.claude/skills/chd-diagrams/`.
- **Never overwrite what we didn't write.** Every file we create carries a
  `chd-ai-managed` marker (a comment in the Markdown files, a stamp file inside
  the skill folder, both recording the app version). An existing file or folder
  *without* the marker is skipped and reported. One *with* the marker is
  replaced — the skill folder wholesale, so files removed in a newer version
  don't linger — which doubles as the "update after an app upgrade" path: run
  the menu item again.
- **The validator is now Node** (`scripts/validate_chd.mjs`, no dependencies;
  the Python script is deleted). The skill and `AGENTS.md` say to skip it and
  check by hand if `node` is missing. Group D's `chd validate` will make it
  runnable without a system Node.

## Consequences
- Editing the skill means editing `resources/ai/skills/chd-diagrams` then
  running `npm run sync-ai`.
- ESLint and Prettier ignore the skill (it ships as plain JS/Markdown) and its
  synced copy.
- Folders set up by an older app version keep the older skill until the user
  re-runs the menu item; there is no automatic refresh.
- Linux: only `path.join`/fs calls are used; picker behaviour is Electron's.
  Not verified on Linux (dev machine is Windows) — flagged for the user.
