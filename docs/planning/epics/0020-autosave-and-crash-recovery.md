# 0020: Autosave / crash recovery and unsaved-changes protection

## Status
Not Started

## Goal
Periodic recovery snapshots so unsaved work survives a crash, plus a proper "save before closing?" prompt. Raised during epic 0008 design discussion, explicitly deferred by the user ("for a later epic though, I feel").

## Tasks
(Not broken down yet — revisit when this epic starts.)
- [ ] Periodic autosave to a recovery copy (every ~minute) — decide storage location: sibling to the real diagram file with a naming convention (e.g. a distinguishing suffix), or centrally in an app-data location
- [ ] On proper close (window close button, Alt+F4, etc.) with unsaved changes: prompt to save, then clean up the recovery file once actually saved
- [ ] Decide what "unsaved changes" even means precisely once detail-panel drafts (epic 0008) are part of the picture, not just node/edge state

## Notes
Right now the app has no unsaved-changes tracking or close-time prompt at all — closing without saving silently discards everything, for both the main diagram and (once epic 0008 lands) any open detail-panel drafts. This epic covers all of that uniformly, not just details specifically.
