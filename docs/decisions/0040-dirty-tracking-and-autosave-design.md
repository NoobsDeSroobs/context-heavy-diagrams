# 0040: Dirty tracking, close-prompt, and autosave/crash-recovery design

## Status
Accepted

## Context
Dirty tracking was raised early (during the details-panel design discussion) and deliberately deferred. It bundles two halves: real unsaved-changes tracking plus a Save/Discard/Cancel close prompt, and periodic autosave with crash recovery. It became a hard prerequisite for drag-to-open once that feature's own design conversation (2026-08-22) surfaced that the app has zero dirty-tracking today — `handleClose` and `handleReload` ([Canvas.tsx](../../src/renderer/src/Canvas.tsx)) can only tell "empty" from "non-empty," not "saved-clean" from "genuinely unsaved," so they collapse both into one blanket `confirm()`. Drag-to-open's own drop-onto-a-window design needs to distinguish those states properly, so dirty tracking was pulled forward as a prerequisite and both its halves designed together, worked through with the user in conversation.

## Decision

### Dirty tracking
- **Explicit `markDirty()` calls at every semantically-relevant mutation site, not derived from the undo/redo stack.** I initially proposed storing the dirty bit alongside each undo snapshot so undo/redo could restore it precisely — but `HistorySnapshot` only covers `{ nodes, edges }`; `diagramMetadata`, `requiredTags`, `highlights`, `legend`, and `detailsDrafts` all live outside the undo stack entirely (e.g. `runSync`'s metadata reconciliation is deliberately excluded from undo history, per its own existing comment). The user rejected coupling dirty state to undo/redo as a result — it can only ever cover part of what "dirty" needs to mean, since real content changes exist that never touch the undo stack at all. Simpler and complete: mark dirty directly at every site that changes something `toDiagramFile()` actually serializes.
- **Split by what's actually persisted, matching the existing split-persistence pattern** (ADR 0025's `enabledHighlightIds`, ADR 0033's `legendPanelOpen` — both deliberately never saved, always reset on load):
  - Marks dirty: `pushSnapshot()` (the single existing chokepoint for all real nodes/edges content changes, already excluding selection-only changes), `setRequiredTags` (template edits), `setHighlights` (add / edit color / remove — the highlight *definitions*), `setLegend` (add / edit / remove entries), `setDetailsDrafts` (actual draft content edits).
  - Never marks dirty: `setEnabledHighlightIds` (which highlights are toggled on — session-only, ADR 0025), `setLegendPanelOpen` and every other panel-open/context-menu/picker boolean (pure UI state, never serialized).
  - `diagramMetadata` has a setter but nothing in the app mutates it outside `loadDiagramIntoCanvas` today (no editor UI for it yet) — no hook needed until one exists.
- Resets to false in `loadDiagramIntoCanvas` (fresh load) and after a successful `persistDiagram` (save).

### Close prompt
- Save/Discard/Cancel on a real OS window-close attempt (close button, Alt+F4), gated on `isDirty` — clean windows close immediately, matching the "nothing to lose" reasoning already used elsewhere (`handleOpen`'s window-reuse check, `handleClose`'s skip-confirm-when-empty).

### Autosave / crash recovery
- **Central storage**, not sibling files: `app.getPath('userData')/recovery/`, keyed by a hash of the normalized diagram path for saved diagrams, or a random session id (generated at window creation, carried via the same query-string mechanism `?path=` already uses) for a diagram that hasn't been saved yet. Rejected sibling `diagram.chd.recovery` files — they'd clutter the user's project folder, risk an accidental git commit, and don't have anywhere sensible to live for a never-saved diagram. Each recovery file is a small envelope (`{ originalPath: string | null, savedAt: number, diagram: DiagramFile }`), not a bare `DiagramFile` — the envelope is what makes the startup orphan scan possible (see below) without guessing.
- **Every ~60s, only while `isDirty`** — skip the write when nothing changed since the last check. A save also implicitly satisfies this (dirty goes false), so no separate timer-reset logic is needed beyond the dirty check itself.
- **Per-path check on open, prompting Recover/Discard** when a window opens a path that has a recovery snapshot newer than the real file. Rejected silently preferring the newer file — a stale recovery snapshot could otherwise silently clobber a real edit made outside the app (hand-editing the `.chd`, other tooling) with older in-app content.
- **Startup orphan scan for never-saved diagrams.** A path-keyed check can't help a diagram that crashed before ever being saved once — there's no path to key against on the next launch. Decided to scan the recovery folder on app startup for envelopes with `originalPath: null` and offer Recover/Discard for each into a new window, rather than accepting that class of loss as out of scope. Reuses the same Recover/Discard prompt as the per-path check.
- **Toggleable, off a mirrored settings file, not `localStorage`.** The user flagged the startup scan as an unwanted cost some users may want to skip — a new `scanForUnsavedRecoveryOnStartup: boolean` (default `true`) in `AppPreferences`. The scan itself runs in the main process before any renderer window exists, but `AppPreferences` lives in a renderer's `localStorage` (ADR 0032), which main can't read at that point. Rather than pulling the broader localStorage-to-config-file settings migration forward for one toggle, the renderer mirrors just this one boolean to a small JSON file under `userData` via IPC whenever it changes; main reads that file synchronously at startup. The Preferences panel itself still reads/writes the real value through the normal `AppPreferences`/`localStorage` path, so the UX is no different from any other setting — only the persistence has an extra, narrowly-scoped fan-out.
- **Cleanup**: delete the active recovery file (whichever key — path-hash or session id — is currently in use for that window) right after a successful save, and after Discard is chosen in either recovery-prompt flow.

## Alternatives considered
- **Deriving dirty state from the undo/redo stack.** Rejected — undo/redo's snapshot shape structurally can't cover everything that counts as "unsaved," see Decision above.
- **Full deep-diff against the last-saved diagram**, re-serializing and comparing on each check. Considered seriously (the user asked about it directly) — real and workable, but needs value-comparison rather than reference equality (React gives new object identities on every render regardless of content change) and a throttling strategy to avoid re-serializing on every drag frame (node position updates fire continuously, not just at gesture-end). Rejected in favor of the explicit-call-site boolean as simpler for equivalent real-world behavior; the only case it would additionally catch — hand-reverting values back to exactly the saved state without using undo — is rare and low-value.
- **Sibling `.recovery` files** next to the real diagram. Rejected — see Decision.
- **Recovery/crash-handling scoped only to already-saved diagrams.** Considered as the smaller-scope option (ships sooner, accepts pre-first-save crashes as an unrecovered loss, same as today). Rejected — the user chose full coverage via the startup orphan scan instead.
- **Pulling the OS-conventional-settings-storage work forward** to move all of `AppPreferences` off `localStorage` now, so the startup-scan toggle (and any future main-process-relevant setting) reads the same way. Rejected as bigger scope than one toggle needs — see Decision's mirrored-file approach.
- **Silently preferring whichever file (real vs. recovery) is newer**, no prompt. Rejected — risks silently discarding an out-of-app edit, see Decision.

## Consequences
- New `isDirty` state (and `markDirty()`) in `Canvas.tsx`, threaded through the mutation call sites enumerated above — any future state that gets added to `toDiagramFile()`'s serialized shape must remember to call `markDirty()` at its own mutation site; this isn't automatic or centrally enforced.
- New main-process recovery module (file I/O: write/read/delete/list-orphans under `userData/recovery/`), a startup orphan-scan flow, and IPC surface for the periodic write, the per-path check, and cleanup.
- A window's recovery key changes identity once across its lifetime — session id before the first save, path hash after — with the pre-save orphan file deleted once that switch happens (covered by the same save-time cleanup as the normal case).
- Real OS window-close now round-trips through IPC to check dirty state before the close is allowed to proceed, where previously `BrowserWindow.close()` was unconditional.
- A new small settings-mirror file under `userData` (outside `AppPreferences`'s own `localStorage` storage), owned by main, holding just the one startup-scan boolean — a narrow, deliberate exception to "settings live in `localStorage`," not a precedent to extend to other settings without its own reason.

## Addendum 2026-09-20 — tighter autosave, and unresolved save conflicts (ADR 0092)
Found while live-testing the multi-file save: killing the app soon after an edit (or right
after a Save that left a conflict unresolved) offered no recovery. Causes and changes:
- **The 60 s interval was too coarse.** An edit made and then killed within the minute had never
  been snapshotted. Now **every 5 s, but only while dirty and only if any piece of state changed
  since the last snapshot** (reference equality), so an idle dirty window still writes nothing.
- **A snapshot older than the real file is ignored** (`checkRecoveryForPath`), by design. After
  a Save that writes the diagram but leaves a conflicting note unsaved, every earlier snapshot is
  therefore ignored and the unsaved note existed only in memory. The save now writes a fresh
  snapshot **before** showing the conflict popup (so a crash during it, or after Cancel, is
  recoverable); the snapshot is only deleted once nothing is left unsaved.
- **Snapshots carry each dirty note's baseline** (path, disk stamp, original text). A note
  restored from one still detects an outside edit made before the crash — without it a restored
  draft would silently overwrite that edit on the next Save. Snapshots from older builds restore
  as before (no baseline, never conflict-checked).
