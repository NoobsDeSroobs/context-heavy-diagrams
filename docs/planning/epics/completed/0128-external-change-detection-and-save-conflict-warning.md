# 0128: External change detection and save-conflict warning

## Status
Implemented 2026-09-19 — live-tested and confirmed working by the user, merged (#95). See [ADR 0091](../../decisions/0091-external-change-detection.md). Originally: design agreed with the user 2026-09-19. (Raised from the brainstorm: files here are edited
outside the app — the user's own editor for details `.md` files, `git checkout`,
and Claude editing `.chd` files directly — so a window can silently hold a stale
copy, and saving from it would silently overwrite the outside change.)

## Goal
Never silently clobber, or silently miss, a change made outside the app —
without the app trying to be a merge tool.

## Agreed design: git is the merge tool, the app just refuses to hide a conflict
- **Detection is cheap, not a watcher.** Record the file's modified-time and
  size when the app loads or saves it. Re-`stat` on **window focus** and again
  **immediately before any save**. No polling, no `fs.watch` (behaves differently
  on Windows/Linux and breaks under editors that save by renaming).
- **Files covered:** the window's `.chd`, and the detail `.md` the Details
  panel has open. Displayed images/reference images: optional, lower priority
  (Chromium may need cache-busting to re-read).
- **No conflict (in-app copy unchanged, disk changed):** on focus, offer
  *Reload* / *Ignore* (reuses `handleReload`, [epic 0041](completed/0041-reload-diagram-from-disk.md)).
- **Conflict (in-app unsaved changes AND disk changed):** on **save**, a popup
  that says there are changes in the editor *and* outside it, with choices:
  - **Cancel** — go to git, commit the outside version, come back;
  - **Overwrite** — save the editor version over the disk version (afterwards
    the user resolves the difference through git, which has both);
  - **Reload / discard mine** — take the disk version.
  Discard/overwrite are legitimate without git if the user knows which side is right.
- The app **never merges** and never needs to explain git; it names the situation
  and offers the safe exits.

## Implementation notes / open questions
- Compare against the *recorded* stat, never wall-clock. Record our own save's
  resulting stat so we don't flag ourselves. Prefer mtime+size (or a content hash
  if mtime granularity turns out unreliable cross-platform — verify on Linux).
- The popup is probably a native `dialog.showMessageBox` like the existing close
  prompt (`windows:requestCloseDecision`, [ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md)).
- Interplay with autosave/crash recovery ([epic 0020](completed/0020-autosave-and-crash-recovery.md)):
  confirm what autosave writes and where, so it neither triggers a false
  conflict nor overwrites an outside change.
- Details `.md` saved while its panel has unsaved textarea edits: same three choices, scoped to that file.
- Overlaps in spirit with [epic 0115](0115-file-app-version-compatibility-and-data-loss-safety.md)
  (data-loss safety) — share wording/UX where sensible.
- Tie-in: the peek card ([epic 0119](completed/0119-details-peek-on-modifier-hold.md)) reads
  details on demand, so it is not stale either way.
- Linux behaviour of the whole flow can only be verified on Linux
  ([CLAUDE.md](../../../CLAUDE.md) cross-platform rule).

## Tasks
- [x] Scoping pass + ADR — [ADR 0091](../../decisions/0091-external-change-detection.md)
- [x] Record stat at load/save in main (`diagram.ts`, new `fileStamp.ts`)
- [x] Focus-time check → Reload/Ignore toolbar notice when the editor is unchanged (also shown, with different text, when dirty)
- [x] Save-time check → native conflict popup (Cancel / Overwrite / Reload), before details are flushed
- [x] Same for detail notes (edited draft → popup; unedited draft → outside change wins) — `details:stat`
- [x] `npm run typecheck` / `lint` clean
- [ ] Live test (user): edit the `.chd` externally then Save; edit a detail `.md` externally with/without editing it in-app then Save; focus the window after an outside edit (banner); Ignore then Save (still prompts)
- [ ] Verify on Linux

## Notes
- Autosave/crash recovery writes only to `userData/recovery/`, so it doesn't interact with this — answers the open question above.
- Found while implementing: every detail draft (including never-edited ones) is rewritten on each save, so just opening a note could clobber a later outside edit; ADR 0091 covers the fix.
- Open items deliberately left: reference images/icons, a deleted-on-disk notice, recovered-snapshot drafts unchecked.
- **Parked as-is (2026-09-19).** Live testing showed the diagram and the detail notes each carry their own baseline/compare/popup logic (main-side vs renderer-side), so the same idea is implemented twice. Deliberately not refactored here — the fix is a redesign of how multi-file saves work, tracked in [epic 0129](completed/0129-unified-multi-file-save-and-change-tracking.md). Behaviour as described above is what ships.
