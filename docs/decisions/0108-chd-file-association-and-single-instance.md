# 0108: `.chd` file association and installer choices — opt-in at install, one running instance, files arrive as launch arguments

## Status
Accepted (2026-10-15).

## Context
A freshly installed app can only open a diagram through File → Open or
drag-and-drop. Double-clicking a `.chd` in the file manager does nothing useful,
which is a poor first experience for a non-technical user. Today:

- `electron-builder.yml` declares no file association on any platform.
- The main process does not look at `process.argv`, does not take a
  single-instance lock, and has no macOS `open-file` handler. Every launch
  creates one blank window and then runs the startup orphan-recovery scan
  against it (`src/main/index.ts`).
- The app is already multi-window, keyed by file path
  ([ADR 0023](0023-multi-window-diagram-model.md)): `openOrFocusWindow` in
  `src/main/windows.ts` focuses the window that already shows a path, or opens a
  new one.

Two facts shape the decision:

- **The extension collides.** `.chd` is also the MAME/RetroArch "Compressed
  Hunks of Data" disk-image format. The extension is established in the file
  format and in existing files, so changing it is a much bigger call than this
  feature.
- **A second process is unsafe.** Per-user state is shared on disk: the settings
  file, the crash-recovery snapshots ([ADR 0040](0040-dirty-tracking-and-autosave-design.md))
  and the window-by-path registry that stops one file opening twice. Two app
  processes would each treat that state as theirs alone.

## Decision

### Keep the `.chd` extension; the user decides who owns it
The extension stays. The collision affects a small slice of users, who can still
open our files by drag-and-drop or File → Open, and can keep their emulator as
the default. The mitigations are:

- A **distinctive identity** for our registration: a Windows ProgID of
  `ContextHeavyDiagramTool.Diagram` and a vendor MIME type
  (`application/vnd.context-heavy-diagram+json`) rather than a generic
  `application/x-chd`.
- **Never take the default silently.** On Windows the association is created
  only if the user ticks a box in the installer. The operating system's own
  "open with" choice always wins afterwards.

### Opt-in at install time
- The Windows installer changes from one-click to the assisted (wizard) form,
  per-user by default and with elevation disabled (`allowElevation: false`, so
  no UAC prompt), and gains an options page with an
  "Associate `.chd` files with this app" checkbox, **checked by default**. The
  non-technical user this feature is for gets the behavior without having to find
  it, and a user with an emulator can untick it.
- The Windows registry keys are written by our own installer script, guarded by
  that checkbox, instead of electron-builder's global `fileAssociations`
  mechanism, which registers unconditionally. The per-user keys go under
  `HKCU\Software\Classes`: the ProgID with its open command and icon, and the
  `.chd` default value pointing at it.
- Windows will not let an installer force itself as the default handler (its
  user-choice protection). The first double-click may therefore show an
  "open with" chooser. That is expected and gets documented.
- The uninstaller removes only what the installer wrote: the ProgID, and the
  `.chd` default only if it still points at our ProgID (restoring a previous
  value if one was saved).
- macOS and Linux use the `fileAssociations` entry in `electron-builder.yml`
  with the explicit MIME type above. On macOS the system's document-type
  declaration is the opt-in surface. On Linux the deb and snap packages ship the
  MIME type definition and a desktop entry that lists it. AppImage cannot
  register an association on its own and is documented as such.
- `fileAssociations` is accepted per platform, so it is set under `mac` and
  `linux` only and left off Windows; our NSIS include does the Windows
  registration (checked against the electron-builder templates, which call
  their generated register macro only when a Windows association is configured).

### The AI-features choice rides on the same options page
The wizard’s options page also asks "Enable AI features (adds an AI menu)",
**checked by default**, with a short warning under it that using AI tools can send diagram
content to the AI provider (so an organization with confidential diagrams opts in knowingly), which seeds the `aiFeaturesEnabled` preference
([ADR 0103](0103-ai-menu-and-feature-preference.md)) — the installer question
that ADR anticipated.

- The installer writes a small `install-options.json` (for example
  `{ "aiFeaturesEnabled": false }`) **next to the executable**, not into the
  user’s settings directory. That keeps the installer ignorant of where the
  app keeps its data, which is resolved by Electron per OS.
- On startup, before any window exists, the main process looks for the
  settings file. **Only if it does not exist yet** and `install-options.json`
  does, it creates the settings file from those options merged over the defaults
  (`normalizePreferences`). From then on the user’s own Preferences switch is
  the only source of truth: a reinstall or an upgrade never resets a choice made
  later, and a missing, empty or malformed options file just means defaults.
- The installer file is removed on uninstall, like everything else it wrote.
- This is a first-run default only. The choice stays reversible in Preferences,
  and the preference gates menu visibility, not capability (the `chd` launchers
  ship regardless).
- Linux (deb, snap, AppImage) and macOS have no install wizard, so they keep the
  default of on and the Preferences switch. No question is invented for them.

### One running instance
- The packaged app takes `app.requestSingleInstanceLock()`. A second launch exits
  immediately and hands its command line to the running process through the
  `second-instance` event. The lock is **skipped when not packaged**, so a
  development run never fights an installed copy for it.
- The `chd` command-line tool ([ADR 0106](0106-chd-command-line-tool.md)) runs
  the executable in Node mode, never reaches the main script and is unaffected.

### Files arrive as launch arguments
- A small pure helper picks file paths out of an argument list: arguments that
  end in `.chd` (case-insensitive), resolved to absolute paths against a given
  working directory. Flags and every other argument are ignored. It is
  unit-tested.
- **Cold launch with files:** no blank window is created. Each file is opened
  through the existing `openOrFocusWindow` path, so duplicates focus instead of
  doubling up. The startup orphan scan's dialogs are parented to the first window
  that was opened. With no files the launch behaves exactly as today.
- **Already running:** `second-instance` opens each file the same way, using the
  second process's working directory to resolve relative paths. It never reuses
  an empty window: emptiness is renderer state that the main process does not
  hold, and a new window per double-click is predictable. With no files, the
  running app focuses its most recently used window (restoring it if minimized),
  or creates one if none is left.
- **macOS:** the `open-file` event replaces the argument route. It can fire
  before `ready`, so paths are queued until the app is ready and then opened
  the same way. Finder does not start a second process, so `second-instance`
  is not involved there.
- The path then loads through the same renderer open flow as any other opened
  file, so recent diagrams and per-file recovery behave as they do for
  File → Open. Only the `.chd` filter stands between a command-line argument and
  that flow, which is no new trust boundary beyond File → Open.

### Icon
The association initially reuses the application icon. A dedicated document icon
is a branding asset and waits for the app's real identity.

## Alternatives considered
- **No single-instance lock; every double-click starts a process.** The least
  code, but two processes then share the settings file, the recovery snapshots
  and a per-process window registry, so the same file could be open twice and
  recovery could be misattributed. Rejected.
- **Register the association silently in the installer.** Simple, and what most
  apps do. Rejected: it takes `.chd` from users of the other format with no say,
  and the requirement is that the user chooses during install.
- **Associate `.chd` only as an "open with" candidate, never as the default.**
  Friendly to the collision, but it leaves the target user's double-click doing
  nothing, which is the problem being solved. Rejected as the default behavior;
  unticking the box gives the same practical result.
- **Seed the AI preference by writing the settings file directly from the
  installer.** Rejected: it would hard-code the per-OS data directory and the
  settings schema into installer scripts, and overwrite or race a file the app
  owns.
- **Choose the default from inside the app on first run** (register through the
  registry or `xdg-mime` at runtime). Works without a wizard installer, but it
  cannot be done on macOS, needs per-OS registration code in the app, and does
  not meet "choose during install". Not chosen; a Preferences toggle to
  re-register or remove the association later remains possible follow-up work.
- **A different extension for new files** (or a second one). Rejected as out of
  proportion to the collision; the existing files and the documented format use
  `.chd`.
- **Reuse an empty window for a file opened from outside.** Would need the main
  process to ask the renderer whether a window is empty. Rejected for now: the
  cost is one extra blank window in the rare case it matters.

## Consequences
- The Windows installer becomes a short wizard instead of a single click. That
  is a visible change to installation, accepted for the sake of the opt-in.
- Launching the app a second time no longer creates a second process. Anything
  that depended on that (for example comparing two builds side by side) must use
  a development run, which skips the lock.
- The Windows registration touches only `HKCU`, so no elevation is required, and
  uninstalling cleans up after itself.
- **Verification is split by machine.** Windows can be exercised here: cold
  double-click, double-click while running, paths with spaces and non-ASCII
  characters, and uninstall. Linux (deb, snap and the MIME definition) and macOS
  (`open-file`, document type) cannot, and are recorded as untested until run
  on those systems.
- Both installer choices are first-run defaults only. Reinstalling does not
  re-apply them to an existing settings file, so an upgrade respects whatever the
  user has since set in Preferences.
- The document-icon work is left to the branding effort, and the packaging
  document gains a section on associations and the "open with" chooser caveat.
