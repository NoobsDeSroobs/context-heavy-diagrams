# 0133: AI onboarding — let a non-technical user work with Claude (or similar) on their diagrams

## Status
In Progress — started 2026-10-15 on `epic/0133-ai-onboarding`. Design for the
pieces below was discussed 2026-10-14/15; each task group gets its own ADR
when it is built (the group list is the decided shape, not a frozen spec).

## Goal
A person who just installed the app can start using Claude (Claude Code,
Cursor, Codex, Claude Desktop, or a plain chat window) on their `.chd`
diagrams **without hand-feeding it an MCP server, spec files, or a skill**.
The AI needs the file-format knowledge (coordinate systems, relative-path
rule, layout conventions — today only in the `chd-diagrams` skill and
[docs/file-format.md](../../file-format.md)) and the tools to validate its own
edits; the app's job is to deliver both with one click, in whatever shape the
user's AI tool can actually consume.

## Why not just a `--help` hint
The originating idea was a "If you are an AI, run X" section in `--help`. It's
kept (task group D) but demoted: it presupposes the AI is already running our
binary, which is exactly the unsolved step, and the target user isn't in a
terminal (and an Electron GUI exe has no useful console `--help` on Windows).
Delivery has to work for two different setups — an *agent in a folder* and a
*chat/Desktop session with no shell*.

## Decided
- **A top-level "AI" menu** between View and Help (File · Edit · View · **AI** ·
  Help). Discoverability is the goal; Help would bury it. Items are flattened
  into the command palette for free ([ADR 0100](../../decisions/0100-command-palette-reuses-the-menu-bar.md)).
  Shown in both the diagram and matrix personas for the items that don't act
  on diagram content.
- **`aiFeaturesEnabled` app preference (default on)** controls whether the menu
  shows. Toggleable in Preferences; a future installer ([epic 0053](later/0053-installable-distribution.md))
  can seed it from a "Do you want to enable AI features?" question. Must merge
  over defaults at every point it's read.
- **Auto-arrange lives under Edit** (next to Align / Distribute), not in the AI
  menu — it's a real app feature useful without AI ([epic 0126](later/0126-auto-layout.md),
  [epic 0110](later/0110-ai-assisted-diagram-reformat.md)); out of scope here.
- **Self-describing `.chd` files (`$comment` pointer line) are parked**, not
  part of this epic — see [epic 0134](later/0134-self-describing-chd-files.md).

## Tasks

### A. AI menu + preference (first slice)
- [x] `aiFeaturesEnabled` in `AppPreferences` (default `true`), normalized on load
- [x] Preferences panel toggle ("Show AI menu")
- [x] "AI" top-level menu between View and Help, hidden when the preference is off — and omitted while it has no items (appears with group B's first item)
- [x] ADR: menu placement + preference gating ([ADR 0103](../../decisions/0103-ai-menu-and-feature-preference.md))

### B. "Copy AI instructions"
- [x] Payload: small hand-written summary + pointer to `docs/file-format.md` (repo URL to be added once public)
- [x] Drift guard: not generated (the full spec is too long to excerpt); instead a unit test pins the key rules + a size ceiling
- [x] Menu item + clipboard write + confirmation alert
- [x] ADR ([ADR 0104](../../decisions/0104-copy-ai-instructions.md))

### C. "Enable AI assistance in this folder…"
- [x] Writes `AGENTS.md` (+ `CLAUDE.md` pointer) and the `chd-diagrams` skill into a user-chosen folder
- [x] Never overwrites a file we didn't write (marker-based; skipped + reported); stamped with the app version, re-running refreshes
- [x] Skill ownership decided: source in `resources/ai/` (already shipped — no `extraResources` needed), `.claude/skills` a synced copy (`npm run sync-ai` + drift test)
- [x] Validator ported Python → Node (`validate_chd.mjs`); Python script removed
- [x] ADR ([ADR 0105](../../decisions/0105-bundled-ai-material-and-folder-setup.md))
- [ ] Live-test: run it on a real folder from the dev build **and from a packaged build** (the `app.asar` read path is untested); **Linux unverified**

### D. Command-line tool (`chd`)
- [x] `chd spec` (print the format), `chd validate <file>` (reuses the skill's Node validator — no Python or system Node for end users)
- [x] `--help` section: "If you are an AI assistant, run `chd spec` to learn this format"
- [x] Packaging so a console CLI and the GUI app coexist per OS: `chd.cmd` / `chd` launchers run the app exe with `ELECTRON_RUN_AS_NODE`, copied next to it via `extraFiles`
- [x] PATH story: **deferred** — no PATH registration yet (needs unverifiable installer scripting, shared with [epic 0136](0136-chd-file-association.md)); "Enable AI assistance in a folder" writes the launcher's absolute path into `AGENTS.md` instead
- [ ] **Linux-only verification flagged for the user** (cross-platform rule): launcher `readlink -f`/exec bit/`extraFiles` on a real deb/AppImage/snap build; and a real-console check on Windows (only checked through pipes so far)
- [x] ADR ([ADR 0106](../../decisions/0106-chd-command-line-tool.md))

### E. Claude Desktop extension (MCPB)
- [ ] Spike: what a bundled `.mcpb` exposes (read/validate/spec first; write tools only if worth the risk)
- [ ] "Install Claude Desktop extension…" menu item, only if the spike says it's worth shipping
- [ ] ADR

### F. Docs
- [ ] `docs/architecture/` page describing the AI-delivery paths and which user setup each serves
- [ ] Keep `docs/file-format.md` and the skill in step (standing rule)

## Open questions
- ~~Skill ownership/location~~ — decided (ADR 0105). Still open: auto-refreshing a folder's copy after an app upgrade (today: re-run the menu item).
- ~~Does the CLI ship in the installer by default?~~ — yes, the launchers always ship (ADR 0106). Still open: putting `chd` on PATH (Windows NSIS, Linux deb/AppImage), planned alongside the file-association installer work.
- MCPB write tools: a mis-edit by an AI is a data-loss risk; how much do we expose (ties to [epic 0115](0115-file-app-version-compatibility-and-data-loss-safety.md))?

## Notes
- Task groups are sequenced A → B → C → D → E; each is shippable alone. Whether
  they all land on this one branch or the epic is split at a natural seam is
  decided as they finish. Decided 2026-10-15: A–D merge together; the epic stays
  open for E (MCPB) and F (docs), which get their own branch.
