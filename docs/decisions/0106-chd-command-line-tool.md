# 0106: The `chd` command-line tool — Electron-as-Node launchers, no separate binary

## Status
Accepted (2026-10-15).

## Context
Two audiences need to run our format knowledge from a terminal: an AI agent that
should be able to read the spec and validate its own edits, and a user whose
machine has no Node or Python. The validator already exists as plain Node
([ADR 0105](0105-bundled-ai-material-and-folder-setup.md)), but it needs a system
`node`. The app itself is an Electron GUI binary: on Windows a GUI-subsystem exe
prints nothing to the console it was started from, so `app.exe --help` cannot
be the CLI.

## Decision
- **The CLI is a plain-Node ES module, `resources/cli/chd.mjs`**, no
  dependencies, shipped unpacked (`asarUnpack: resources/**` already covers it).
  Commands: `chd spec [fields|authoring|layout|all]`, `chd validate <file>...
  [--recursive]`, `--version`, `--help`. `--help` carries the line "If you are an
  AI assistant: run `chd spec` first". Exit codes: 0 ok, 1 validation errors, 2
  usage.
- **It reuses the bundled skill rather than adding a second spec.** `spec`
  prints `SKILL.md` (frontmatter stripped); the three reference documents are
  opt-in topics because together they are ~65 KB — too much to dump into an
  agent's context unasked. `validate` is the skill validator's own `main`
  (exported for this), so the two cannot diverge.
- **No separate executable: two tiny launchers run the app's own exe as Node.**
  `build/launchers/chd.cmd` (Windows) and `chd` (Linux, POSIX sh) set
  `ELECTRON_RUN_AS_NODE=1` and run `<app exe> …/app.asar.unpacked/resources/cli/chd.mjs
  "$@"` — the pattern VS Code's `code.cmd` uses. They are copied next to the exe
  by electron-builder's `extraFiles` (`win` and `linux` sections; not mac, which
  is not a target). Launched from a batch file, the GUI-subsystem exe inherits the
  console's standard handles, so output appears; exit codes propagate.
  Linux's `executableName` is pinned in the config because the launcher
  hardcodes it.
- **Launchers ship in the installer by default** (they are two ~300-byte
  files); there is no "AI features" gate on them.
- **No PATH registration for now.** Editing the user's PATH needs installer
  scripting (NSIS include, deb hooks) that cannot be verified on this machine and
  overlaps the file-association installer work. Instead, "Enable AI assistance in
  a folder…" writes the launcher's **absolute path** into the folder's
  `AGENTS.md` (`{{CLI_NOTE}}` placeholder), so an agent can call it without PATH.
  Not written in dev builds or an AppImage (its exe lives in a temporary mount —
  the path would rot); re-running the menu item refreshes it after a
  reinstall/move.
- `.gitattributes` pins `*.cmd` to CRLF and the `chd` launcher to LF (the repo
  otherwise relies on `core.autocrlf`, which would hand Linux a CRLF shell
  script); the launcher is committed with the executable bit.

## Alternatives considered
- **A second small console exe** (e.g. a compiled Node/Go launcher, or Electron's
  console-subsystem trick): another binary per OS to build, sign and version for
  what two shell lines do.
- **Make the main exe itself the CLI** (`app.exe --help`): Windows GUI-subsystem
  exes do not attach to the parent console; workarounds (`AttachConsole`,
  re-spawn) are fragile.
- **Print the full spec from `chd spec` by default:** 65 KB per call.
- **Register on PATH now** (NSIS per-user PATH edit, deb symlink): deferred, see
  above. Revisit together with file associations.

## Consequences
- The AGENTS.md written into a folder names a machine-specific path; it is
  refreshed by re-running the menu item, not automatically.
- `chd` is not yet typeable from any terminal on its own. Linux package formats
  other than a PATH-registering deb/AppImage story are still open.
- Editing the skill still means `resources/ai/skills/chd-diagrams` +
  `npm run sync-ai`; `chd spec` picks the change up automatically.
- Verified on a Windows `win-unpacked` build (`chd.cmd`: version, help, validate,
  spec, exit codes). **Not verified: output in a real interactive console
  (verified through pipes only), the NSIS-installed layout, and everything on
  Linux** (`readlink -f`, exec bit surviving `extraFiles`, the deb/snap/AppImage
  layouts).
