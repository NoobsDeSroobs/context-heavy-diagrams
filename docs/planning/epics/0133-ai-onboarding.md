# 0133: AI onboarding — let a non-technical user work with Claude (or similar) on their diagrams

## Status
Implemented — groups A–D merged earlier (PR #109); groups E and F on
`epic/0133-ai-extension-and-docs` (2026-10-16), live-tested on Windows and
confirmed working by the user. Pending PR/merge, then move to `completed/`.
Still unverified: macOS (the extension) and Linux (`chd` on PATH was deferred).
Design for the pieces below was discussed 2026-10-14/15; each task group got its
own ADR (the group list was the decided shape, not a frozen spec).

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
  shows. Toggleable in Preferences; a future installer ([epic 0053](../completed-epics.md#0053-installable-distribution-for-non-technical-users))
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
- [x] PATH story: **deferred** — no PATH registration yet (needs unverifiable installer scripting, shared with [epic 0136](../completed-epics.md#0136-associate-chd-files-with-the-app-double-click-to-open)); "Enable AI assistance in a folder" writes the launcher's absolute path into `AGENTS.md` instead
- [ ] **Linux-only verification flagged for the user** (cross-platform rule): launcher `readlink -f`/exec bit/`extraFiles` on a real deb/AppImage/snap build; and a real-console check on Windows (only checked through pipes so far)
- [x] ADR ([ADR 0106](../../decisions/0106-chd-command-line-tool.md))

### E. Claude Desktop extension (MCPB)
- [x] Spike: what a bundled `.mcpb` exposes — findings and recommendation in [Spike findings (group E)](#spike-findings-group-e) below; **scope decided**
- [x] ADR ([ADR 0110](../../decisions/0110-claude-desktop-extension.md))
- [x] `extension/`: the MCP server as plain ESM (`list_files`, `get_format_spec`, `validate_diagram`, `read_file`, `create_file`, `update_file`), path confinement, file-type rules (read: text types; write: `.chd`/`.md`/`.txt`/`.svg`; never dot-files), SHA-256 fingerprint helper — unit-tested directly and over stdio with the MCP SDK client
- [x] `extension/manifest.json` (manifest version 0.3, `directory` setting for the folder, `boolean` setting for update) and `npm run build:extension` (esbuild bundle, `mcpb` validate + pack into a git-ignored file under `resources/`); the app build runs it
- [x] "Install Claude Desktop extension…" menu item (Windows/macOS, AI features on): explanatory dialog incl. the data-leaves-the-machine sentence, then open the bundled `.mcpb`, else reveal it with instructions
- [x] Docs: packaging section for the extension build and how to test it with Claude Desktop
- [x] Live test (user, needs Claude Desktop) — **confirmed working on Windows 2026-10-16** (installs, tools run; macOS still untried): install flow, folder picker, update checkbox reaching the server, stale-edit refusal, unsigned-bundle warning

### F. Docs
- [x] `docs/architecture/` page describing the AI-delivery paths and which user setup each serves ([ai-integration.md](../../architecture/ai-integration.md))
- [x] Keep `docs/file-format.md` and the skill in step (standing rule) — the skill references still said `shape` for the node type, legend kind and security id lists (renamed to `entity` earlier); brought in step, with the accepted-synonym note

## Spike findings (group E)
Researched 2026-10-16 from the MCPB repo's README and manifest spec (nothing built).

**How it works.** A `.mcpb` is a zip: a required `manifest.json` plus the server code and its dependencies. Claude Desktop (Windows/macOS) shows an install prompt when the file is opened, and **launches the server itself** as a stdio child process — our app never hosts or starts it, and nothing is auto-discovered. Node ships with Claude Desktop, so a `server.type: "node"` bundle needs no separate Node install. Build with the `@anthropic-ai/mcpb` CLI (`init`, `pack`); the repo page says nothing about signing.

**Manifest facts that matter.** Required: `manifest_version`, `name`, `version`, `description`, `author`, `server`. The spec reads 0.3 (one example uses 0.4) — a moving format, so pin the version. `server.entry_point` + `server.mcp_config` (`command`/`args`/`env`, `${__dirname}`, `platform_overrides`). `user_config` entries can be of type `directory`/`file`, shown to the user at install and substituted into the launch args as `${user_config.KEY}` — a natural way to make the user pick **the one folder the server may touch**. `tools` is a name+description list. **There is no sandbox or permission model**: the server runs with the user's rights, so any folder scoping is our own code's job. `privacy_policies` is only required for extensions that call external services; ours must not.

**Fit with this project.**
- Reuse: the Node validator (`resources/ai/skills/chd-diagrams/scripts/validate_chd.mjs`), `chd spec`, and the skill's reference text already exist as plain Node ESM with no dependencies. The server would be a thin MCP wrapper over them, bundled to one file (the MCP SDK is the only new dependency).
- Fully local and offline: the bundle ships inside our installer and the server makes no network calls. (Claude itself still needs internet, and anything a tool returns becomes conversation content sent to the model — see the warning question below.)
- **Platforms:** Claude Desktop exists for Windows and macOS only, so the menu item should be hidden on Linux. That makes this a Windows/macOS feature; the agent-in-a-folder route (groups C/D) remains the Linux story.
- Unverifiable here: how the OS hands a `.mcpb` to Claude Desktop (association unknown), whether an unsigned bundle shows a warning, and the Mac path. The Windows install flow needs the user's Claude Desktop to test.

**Decided scope for v1 (2026-10-16, revised same day to cover more than `.chd`).** Writing to existing files is allowed, opt-in, with no extra safeguards beyond that and a stale-edit check. Full detail in [ADR 0110](../../decisions/0110-claude-desktop-extension.md):
- `list_files`, `get_format_spec`, `validate_diagram`, `read_file` (content **and a content hash**), `create_file` (new file only; exclusive create) — always on.
- `update_file` — **only available when the user ticks "Allow Claude to modify existing files (can cause data loss)"**, a `boolean` entry in the manifest's `user_config`, off by default and worded plainly in the install text.
- **Files.** The chosen folder holds diagrams, their Markdown "details" notes, icons, and supporting documents the user placed there for the assistant. Read: text types (`.chd`, `.md`, `.txt`, `.json`, `.csv`, `.yaml`, `.svg`, ...). Write: only `.chd`, `.md`, `.txt`, `.svg` (never anything runnable). Never dot-files or dot-directories (`.env`, `.git`, ...). Binary files (PDF, images) are not served in v1.
- **Stale-edit check on every write** (a project-wide standing rule now: [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md); `chd hash` and the skill/`AGENTS.md`/copy-paste wording already carry it): an update must send back the hash from the last read and is refused, with a "re-read first" message, if the file's current hash differs; a create is refused if the file now exists.
- **Deliberately no backups or other safeguards.** The people who enable writing are the ones who would be using an agent with terminal access, which can already overwrite anything, and the files are plain text that version control handles well. Opt-in plus the stale check is the whole policy.
- All paths are resolved and checked against the chosen folder (reject `..`, absolute paths outside it, and symlinks that escape); size limits.
- Install-time text and the extension description state plainly that file contents the assistant reads are sent to the AI provider.
- An open window with **unsaved** edits is not visible to a file hash; the app's existing external-change warning is what covers that case.

**Menu item.** "Install Claude Desktop extension…" (Windows/macOS only): try opening the bundled `.mcpb` with the OS; if nothing handles it, reveal it in the file manager with a short dialog explaining the two-step install. The `.mcpb` is built by an npm script during the app build and shipped under `resources/`.

## Open questions
- ~~**AI-menu data-leak notice (raised 2026-10-16, for later discussion).**~~ Decided 2026-10-16: a short orange/amber notice line at the top of the AI dropdown ("Could cause data leaks: what an AI assistant reads is sent to its provider."), implemented via `MenuBarMenu.notice`. Not decided: whether the first-use flows (Copy AI instructions / Enable in a folder) also need their own wording. Original question: The installer's AI checkbox now carries a warning that sharing diagrams with an AI assistant may leak their contents. Should the AI menu itself carry a similar notice — where (a persistent line, a first-use dialog, in the "Copy AI instructions" / "Enable AI assistance in a folder" / extension-install flows), what wording, and whether it can be dismissed? Not decided.
- ~~Skill ownership/location~~ — decided (ADR 0105). Still open: auto-refreshing a folder's copy after an app upgrade (today: re-run the menu item).
- ~~Does the CLI ship in the installer by default?~~ — yes, the launchers always ship (ADR 0106). Still open: putting `chd` on PATH (Windows NSIS, Linux deb/AppImage), planned alongside the file-association installer work.
- ~~MCPB write tools: how much do we expose?~~ — decided 2026-10-16: create is always on, update is opt-in with a stale-edit check on every write (see Spike findings).

## Notes
- Task groups are sequenced A → B → C → D → E; each is shippable alone. Whether
  they all land on this one branch or the epic is split at a natural seam is
  decided as they finish. Decided 2026-10-15: A–D merge together; the epic stays
  open for E (MCPB) and F (docs), which get their own branch.
