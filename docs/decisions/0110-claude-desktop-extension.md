# 0110: Claude Desktop extension (MCPB) — a local, folder-scoped server shipped inside the app

## Status
Accepted (2026-10-16).

## Context
The folder route ([ADR 0105](0105-bundled-ai-material-and-folder-setup.md)) and
the `chd` command line ([ADR 0106](0106-chd-command-line-tool.md)) serve an agent
that works in a folder and has a shell. A person using the Claude Desktop chat
has neither: no shell, and no way to hand the assistant the format knowledge or a
validator. The goal is that they can install something once and then ask for
diagrams in plain language.

Claude Desktop installs "MCPB" bundles (`.mcpb`): a zip holding a `manifest.json`
and a local MCP server that Claude Desktop itself starts. The format is
versioned (the manifest spec currently reads 0.3) and has no permission model: the server runs
with the user's rights, so anything it should not touch it must refuse itself.
Claude Desktop exists for Windows and macOS only.

Constraints from decisions already made: everything runs locally and the server
makes no network calls; anything a tool returns becomes conversation content sent
to the AI provider; and every AI write path follows
[ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md).

## Decision

### Shape
- A **Node server, bundled into one file**, packaged as a `.mcpb` with manifest
  version **0.3** (pinned; the build runs the official `mcpb` validator, so a
  format change shows up as a build failure rather than as a broken install).
  Node ships with Claude Desktop, so the user installs nothing else.
- **Claude Desktop starts it; our app does not.** The app never hosts a server,
  opens a port or discovers anything. The bundle is a build artifact shipped
  inside the app's installer, so installing it needs no download.
- The server is a thin layer over code that already exists: the validator
  (`validateFile`) and the spec text (the skill and its references), both inlined
  at build time, so the extension always matches the app version that shipped it.

### Tools
The folder holds more than diagrams: the notes a diagram points at (Markdown
"details" files), the icons and images it uses, and whatever supporting documents
the user put there on purpose for the assistant to use. So the file tools are
general, and only the diagram-specific ones know about `.chd`. All paths are
relative to the user's chosen folder.
- `list_files` — files under the folder (path, size, modified time, whether the type
  can be written), with a cap. Fingerprints come from `read_file`, so a listing never
  has to read every file.
- `get_format_spec` — the `.chd` format spec; the same topics as `chd spec`.
- `validate_diagram` — runs the validator on one `.chd` and returns errors and
  warnings. Non-recursive: following links outside the folder is not offered.
- `read_file` — a text file's content and its fingerprint.
- `create_file` — creates a **new** file from the content given; fails if the
  name exists. A `.chd` is validated first.
- `update_file` — replaces an existing file with the content given, only with the
  fingerprint the edit was based on. A `.chd` is validated first. **It is only
  offered when the user has enabled it** (below). Whole-file replacement in v1;
  patch-style edits can come later if the token cost of large files warrants.

Both write tools refuse a `.chd` the validator reports errors for (warnings are
returned, not blocking), and return the new fingerprint. Creating a details note
and pointing a diagram at it are two writes, each with its own fingerprint.

**Which files.** The folder is the user's chosen scope, so reading is broad and
writing is narrower:
- **Read** any text file with a known document or data extension (`.chd`, `.md`,
  `.markdown`, `.txt`, `.json`, `.csv`, `.tsv`, `.yaml`, `.yml`, `.xml`, `.svg`,
  `.html`, `.toml`, `.ini`). Binary files (PDFs, images) are not served in v1.
- **Write** (create or update) only `.chd`, `.md`, `.txt` and `.svg` — diagrams,
  their notes, supporting text, and custom icons. Nothing that could be run
  (scripts, executables, shortcuts, configuration for other tools) can be
  written, whatever the user's update setting.
- **Never** a dot-file or anything inside a dot-directory (`.env`, `.git`,
  `.ssh`, ...), for reads or writes, and listings skip them and common
  dependency folders. Credentials and repository internals are the likeliest
  things to sit near a user's documents, and no diagram task needs them.

### Scope and safety
- **One folder, chosen by the user.** The manifest declares a required
  `directory` setting, so Claude Desktop asks for the folder when the extension is
  installed and passes it to the server. Everything is confined to it: paths are
  resolved and must stay inside after symlinks are resolved (for a file being
  created, the parent directory is the one resolved); `..` and absolute paths
  outside are refused; only the file types above; a size cap (5 MB) on reads and writes.
- **Update is a second manifest setting, a boolean, off by default**, labelled
  along the lines of "Allow Claude to modify existing files (can cause data
  loss)". With it off, `update_file` is not registered at all and the server
  would refuse it anyway.
- **No backups or other safeguards** beyond opt-in and the stale-edit check, as
  decided in ADR 0109.
- **Stale-edit check as in ADR 0109.** The fingerprint is the SHA-256 of the raw
  bytes. `create_file` creates the file exclusively (`wx`), so it cannot replace a
  file that appears in the meantime. `update_file` compares the
  fingerprint, and again immediately before replacing; a small window remains
  between that last check and the replace, which is accepted and documented.
- **Validating a `.chd` before writing** without a validator that takes text: the
  server writes the candidate to a temporary file beside the target, validates that file
  (so relative paths resolve exactly as they will for the real one), then
  publishes it and removes the temporary file whatever happens.
- **No network, no telemetry, no spawning of other programs.** Dependencies are
  bundled into the single file. The extension's description and the install text
  say plainly that diagram contents the assistant reads are sent to the AI
  provider.

### Getting it to the user
- A menu item **AI → "Install Claude Desktop extension…"**, shown only on Windows
  and macOS and only when AI features are enabled
  ([ADR 0103](0103-ai-menu-and-feature-preference.md)).
- It first shows a short dialog (what the extension does, that the contents of
  diagrams Claude reads are sent to its provider, that Claude Desktop will ask
  for a folder and for the update option), then asks the operating system to open
  the bundled `.mcpb`. If nothing handles it, the file is revealed in the file
  manager with a note on installing it from Claude Desktop's extension settings.
- The extension is rebuilt with every app build and carries the app's version, so
  an app upgrade makes the menu item offer the newer one; installing it again
  replaces the old copy.

### Build and layout
- Source in a top-level `extension/` folder as plain ESM (like the `chd` tool, so
  it needs no TypeScript pipeline and is testable with the built-in runner).
- `npm run build:extension` bundles it with esbuild, stages the manifest and
  bundle, and packs it with the `mcpb` CLI into a generated, git-ignored file
  under `resources/`, which the packaging already ships unpacked. The app build
  runs it. The MCP SDK, esbuild and the `mcpb` CLI are development dependencies
  only; none is shipped as a package.

## Alternatives considered
- **The app hosts the server while it runs ("Start MCP server").** Needs the app
  open, a port, and the user to wire Claude to it by hand, and it loses the
  one-install goal. Rejected.
- **A Python (`uv`) or compiled-binary server.** Node already ships with Claude
  Desktop, and the validator and spec text are JavaScript. Rejected.
- **Offering the extension as a separate download.** One more thing to find and to
  keep in step with the app. Rejected in favor of shipping it in the installer.
- **Read-only, or create-only.** Considered and replaced by the opt-in update:
  people who enable it are the ones for whom overwriting is already routine, and
  a copy-only workflow makes simple edits awkward.
- **Several folders.** The manifest allows it, but one keeps the scope easy to
  explain and to check. A later change can allow more.
- **Recursive validation through links.** It would follow relative links out of
  the chosen folder, which the confinement rule forbids. Left out.
- **Only `.chd` files, for reading and writing** (the first draft). Rejected: the
  notes a diagram points at are Markdown files the assistant must be able to read
  and edit, and users place supporting documents in the folder for it to use. The
  safety goal is met by a short list of text types plus the dot-file rule instead.
- **Letting the assistant write any file in the folder.** Rejected: planting a
  script or shortcut the user might later run is a different class of harm from
  editing a document, and nothing the extension is for needs it.
- **Registering `update_file` only if enabled, versus always registering and
  refusing.** Registering it only when enabled keeps the assistant from planning
  around a tool it cannot use; the refusal remains as a second guard.

## Consequences
- Windows and macOS only. Linux users keep the agent-in-a-folder route.
- Three development dependencies and one more build step; the installer grows by
  the bundle's size (the MCP SDK plus a small amount of our code).
- The manifest format is young and may change. The pinned version plus the build
  validation is the early warning; tracking a new manifest version is a small,
  deliberate change.
- An unsigned bundle may show a warning in Claude Desktop, like the unsigned
  installer does; signing is a later release concern.
- **Verified on Windows with Claude Desktop (2026-10-16):** the bundle installs and
  the tools work. **macOS is still unverified.** The server itself is also tested
  directly and over the MCP protocol with the SDK's client, from source and from
  the shipped bundle.
- Using the extension means diagram contents leave the machine through the
  assistant. The installer's AI warning, the extension's description and the
  install dialog all say so, as does the notice at the top of the AI menu.
