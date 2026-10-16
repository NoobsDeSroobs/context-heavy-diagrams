# AI integration

How a person who has just installed the app gets Claude (or another assistant) working on their `.chd` diagrams, without hand-feeding it a spec, a skill or a server. There is no single mechanism: people use assistants in three different ways, and each way can only consume a different kind of delivery. The app's job is to deliver the format knowledge and a way to check an edit, in whichever shape the person's setup can use, from one menu.

All of it sits behind one switch: **AI features** (the `aiFeaturesEnabled` preference, default on, set at install time on Windows and changeable in Preferences — [ADR 0103](../decisions/0103-ai-menu-and-feature-preference.md), [ADR 0108](../decisions/0108-chd-file-association-and-single-instance.md)). The preference only shows or hides the **AI** menu; it gates the interface, not any capability.

## The three setups

| The person is using… | They do | The assistant gets | Notes |
|---|---|---|---|
| A **chat with no tools** (any assistant, any OS) | AI → **Copy AI instructions**, paste it into the chat, then paste or attach the `.chd` ([ADR 0104](../decisions/0104-copy-ai-instructions.md)) | A short, hand-kept primer: the structure and the traps that corrupt files | No validation, and the person moves the file by hand. Works everywhere, including Linux. |
| An **agent in a folder with a shell** (Claude Code, Cursor, Codex, …) | AI → **Enable AI assistance in a folder…** and choose the folder ([ADR 0105](../decisions/0105-bundled-ai-material-and-folder-setup.md)) | `AGENTS.md` and `CLAUDE.md` pointing at a copy of the **skill** (core rules, field reference, authoring and layout guides, a validator script); the **`chd` command line** ([ADR 0106](../decisions/0106-chd-command-line-tool.md)) for `spec`, `validate` and `hash` | The agent edits files with its own tools. Windows, macOS and Linux. |
| **Claude Desktop** (chat, no shell) | AI → **Install Claude Desktop extension…**, then choose a folder in Claude Desktop ([ADR 0110](../decisions/0110-claude-desktop-extension.md)) | A local MCP server limited to that folder: `list_files`, `get_format_spec`, `validate_diagram`, `read_file`, `create_file`, and `update_file` only if the person turns it on | Windows and macOS only (Claude Desktop does not exist on Linux). Runs locally, no network of its own. |

What the setups share is deliberately small: the format knowledge, a validator, and one safety rule.

## Where the knowledge comes from

One chain, from the spec outward. When the file format changes, every link has to follow:

| Piece | What it is | How it stays current |
|---|---|---|
| [`docs/file-format.md`](../file-format.md) | The authoritative, standalone spec | Edited with `src/shared/diagram.ts` (standing rule) |
| `resources/ai/skills/chd-diagrams/` | The skill: core rules (`SKILL.md`), `references/` (field reference, authoring guide, layout guide) and `scripts/validate_chd.mjs` | Edited by hand to mirror the spec. The single source of truth for everything below |
| `.claude/skills/chd-diagrams/` | A synced copy so this repository's own agents use the same skill | `npm run sync-ai`; a test fails if it drifts |
| `src/shared/aiInstructions.ts` | The short copy-paste primer | Edited by hand; a test guards its key rules and its size |
| `chd spec`, `chd validate` | The command line reads the skill files and runs the validator | Nothing to do — it reads the skill |
| The Claude Desktop extension | A bundle with the skill text and the validator baked in | Rebuilt by every app build (`npm run build:extension`), so it always matches the version that shipped it |

So a format change means: update `docs/file-format.md`, the skill's `SKILL.md` and `references/field-reference.md`, the primer if a trap changed, then `npm run sync-ai`. The rest follows from the build.

## Rules every path follows

- **Stale-edit check** ([ADR 0109](../decisions/0109-stale-edit-check-for-every-ai-write-path.md)). A write to an existing file is conditional on it being unchanged since the version the edit was based on, using the SHA-256 of the file's bytes; a create fails if the file exists. The extension enforces it; the skill, `AGENTS.md` and the primer instruct it; `chd hash` prints the fingerprint. Any new way of letting an assistant write a diagram must carry it.
- **Opt-in writes.** The extension cannot modify an existing file unless the person ticked "Allow Claude to modify existing files (can cause data loss)" when installing it. There are no backups or other safeguards beyond that and the check: the files are plain text for version control.
- **Confinement.** The extension touches one folder the person chose, only text files, and writes only `.chd`, `.md`, `.txt` and `.svg`; dot-files such as `.env` and anything runnable are never accessed.
- **Nothing leaves the machine by itself, but what an assistant reads does.** The extension, the CLI and the folder files make no network connections. Whatever an assistant reads in order to help is sent to its provider as part of the conversation. The installer's AI checkbox, the extension's description, the install dialog and a coloured notice at the top of the AI menu ("Could cause data leaks…") all say so.

## Where things live

- Menu items: `src/renderer/src/Canvas.tsx` (the AI menu); main-process handlers in `src/main/ai.ts` and `src/main/aiFolder.ts`.
- Bundled material: `resources/ai/` (skill, `AGENTS.md`/`CLAUDE.md` templates) and `resources/cli/chd.mjs`.
- The extension: source in `extension/`, built by `scripts/build-extension.mjs` into `resources/extension/` (see [packaging](packaging.md#the-claude-desktop-extension)).
