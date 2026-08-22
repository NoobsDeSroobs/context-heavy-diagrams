# 0020: Autosave / crash recovery and unsaved-changes protection

## Status
Implemented and live-tested (2026-08-22) on `epic/0020-autosave-and-crash-recovery`, not yet merged — see the user's own note in [PROGRESS.md](../../../PROGRESS.md) for when. Pulled forward as a prerequisite for [epic 0038](0038-drag-file-to-open.md), which paused mid-design once it became clear the app has no dirty-tracking at all to build its own drop-onto-non-empty-window prompt on. Design fully worked through with the user in conversation; see [ADR 0040](../../decisions/0040-dirty-tracking-and-autosave-design.md) for the reasoning behind every decision below. Typecheck and lint clean throughout; every phase confirmed working live by the user after three real bugs found and fixed — see Notes and [docs/known-issues.md](../../known-issues.md).

## Goal
Periodic recovery snapshots so unsaved work survives a crash, plus a proper "save before closing?" prompt. Raised during epic 0008 design discussion, explicitly deferred by the user ("for a later epic though, I feel").

## Tasks

### Phase A — dirty tracking
- [x] `isDirty` boolean state + `markDirty()` in `Canvas.tsx`
- [x] Wire `markDirty()` into `pushSnapshot()` (covers all real nodes/edges content changes in one place)
- [x] Wire `markDirty()` into `setRequiredTags`, `setHighlights` (definitions, not `setEnabledHighlightIds`), `setLegend`, `setDetailsDrafts` — see ADR 0040 for the exact call sites
- [x] Reset `isDirty` to false in `loadDiagramIntoCanvas` and after a successful `persistDiagram`
- [x] Bonus, not originally itemized: `handleClose`/`handleReload`'s old blanket `confirm()` (their own comments explicitly named this epic as the reason they couldn't do better) now gate on real `isDirty` instead of node/edge emptiness

### Phase B — Save/Discard/Cancel close prompt
- [x] Main process: intercept `BrowserWindow`'s `close` event, `preventDefault()`, IPC round-trip to ask the renderer's `isDirty`
- [x] Not dirty: let the close proceed immediately, clean up any recovery file for that window
- [x] Dirty: native `dialog.showMessageBox` with Save / Discard / Cancel — Save persists (reusing the existing save path, including `pickSavePath` if never-saved) then closes; Discard closes immediately and deletes the recovery file; Cancel leaves the window open

### Phase C — periodic autosave
- [x] Main process: recovery module (`src/main/recovery.ts`) under `userData/recovery/` — write/read/delete/list-orphans, envelope shape `{ originalPath: string | null, savedAt: number, diagram: DiagramFile, detailsDrafts: Record<string, string> }`. `detailsDrafts` wasn't in the original envelope sketch — added after review caught that `toDiagramFile()` alone doesn't carry in-progress, not-yet-flushed details-panel text, so a crash mid-edit would otherwise recover everything except that text.
- [x] Window creation: generate a session id for a window with no `initialPath`, carried the same way `?path=` already is, used as the recovery key until the first save switches it to a path-hash key (old session-id file deleted at that point)
- [x] Renderer: ~60s timer, only writes when `isDirty`, reuses `toDiagramFile()` to build the snapshot
- [x] Cleanup: delete the active recovery file after a successful save

### Phase D — crash-recovery UX
- [x] Per-path check on open: if a recovery snapshot newer than the real file exists, prompt "Recover unsaved changes from an unexpected close?" (Recover / Discard). Recover loads the snapshot's content (now dirty); Discard deletes the stale file and opens the real file normally
- [x] Startup orphan scan: on app launch, find `originalPath: null` envelopes and offer Recover (into a new window) / Discard for each

### Phase E — startup-scan toggle
- [x] `scanForUnsavedRecoveryOnStartup: boolean` (default `true`) added to `AppSettings`, exposed as a checkbox in `SettingsPanel`
- [x] Renderer mirrors this one boolean to a small JSON file under `userData` via IPC whenever it changes (main can't read `localStorage` before any window exists)
- [x] Main reads the mirrored file synchronously at startup to decide whether to run Phase D's orphan scan at all

## Notes
Right now the app has no unsaved-changes tracking or close-time prompt at all — closing without saving silently discards everything, for both the main diagram and any open detail-panel drafts. This epic covers all of that uniformly, not just details specifically.

**2026-08-20**: the user re-raised the close-time prompt specifically (independent of the autosave half of this epic) — three options, **Save / Discard / Cancel**, when closing a window with an unsaved diagram. Consistent with the task breakdown above.

**2026-08-22**: full design pass with the user once this became a hard prerequisite for epic 0038 — see ADR 0040 for every decision and the alternatives rejected along the way (undo-derived dirty state, full deep-diff dirty checking, sibling recovery files, silently preferring the newer file with no prompt, scoping recovery to already-saved diagrams only, pulling epic 0054 forward). Notably, the user's own proposal to key dirty-state off the undo/redo stack surfaced a real gap — `HistorySnapshot` only covers `{ nodes, edges }`, not the other four pieces of persisted state — which shaped the final explicit-call-site design.

**2026-08-22, implementation**: all five phases built in one pass (the user explicitly chose not to phase the build itself, only the design conversation). New files: `src/main/recovery.ts`, `src/main/settingsMirror.ts`. Touched: `windows.ts` (session ids, close-guard/choreography), `diagram.ts` (save-time recovery cleanup), `index.ts` (handler registration, startup scan), preload (new API surface), `settings.ts`/`SettingsPanel.tsx` (Phase E), `Canvas.tsx` (the bulk of it). `recovery.ts` initially imported `createWindow` from `windows.ts` while `windows.ts` imported from `recovery.ts` — a real circular module dependency, caught in review and fixed by injecting the window-creation function into `runStartupOrphanScan` instead of importing it directly. `npm run typecheck` and lint are clean (only the repo's existing CRLF warnings, same ones epic 0028 already tracks); confirmed the app boots without a startup exception via a throwaway `npm run dev` run.

**2026-08-22, first live-testing pass by the user**, three real bugs found and fixed (all now in [docs/known-issues.md](../../known-issues.md) with full detail):
1. File → Close left main's window-path registry stale (never a page navigation, so `registerWindowPath`'s usual sync point never ran) — reopening the same file afterward just focused the stale, now-blank window instead of reloading it. Fixed with a new `windows:clearPath` IPC call.
2. React Flow's own post-load auto-measurement (a `dimensions` change with `resizing` left undefined) was indistinguishable, by shape alone, from `onNodesChange`'s pre-existing "discrete real edit" classification for the same change shape — harmless before this epic (an extra no-op undo entry), but meant *every* load falsely dirtied the diagram once `pushSnapshot` started driving `isDirty` too. Fixed with a 500ms post-load grace window.
3. The startup orphan-recovery dialog had no owning window and could open behind the app — fixed by parenting it to the already-created initial window.

Confirmed working as designed: the real-OS-close Save/Discard/Cancel prompt, autosave actually writing a file, the startup orphan-recovery prompt (once the z-order fix landed), and the Phase E settings toggle actually suppressing that prompt.

**Resolved, not a bug**: the "per-path recovery didn't prompt on restart" report turned out to be a mix-up between the two different recovery triggers, not a defect — the user was watching for a prompt right at app launch (blank window, no path yet — nothing for the per-path check to key against), when the per-path check only actually runs once that *specific file* is reopened. Confirmed working correctly once tested that way: reopening the file after the Task-Manager kill prompted "an unsaved version of this diagram was found," and Recover correctly restored the moved shape.

**2026-08-22, re-verified after the three bugfixes above**: every phase now confirmed working live by the user — dirty-aware Close/Reload, the real-OS-close Save/Discard/Cancel dialog, autosave actually writing a snapshot, the per-path recovery prompt (including recovering real content correctly), the startup orphan scan (dialog now correctly on top), and the Phase E settings toggle. Ready to merge once the user reviews the branch.
