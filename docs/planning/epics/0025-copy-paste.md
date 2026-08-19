# 0025: Copy / paste

## Status
Not Started — not yet scoped

## Goal
Real clipboard copy/paste for nodes (and probably edges between copied nodes) — `Ctrl+C`/`Ctrl+V`/`Ctrl+X`. Split out from epic 0018 (selection and keyboard shortcuts): unlike most of that epic, this isn't just a keybinding over existing behavior — it needs an actual clipboard data model, paste-position logic (offset from original? centered on viewport? at cursor?), and id regeneration for pasted nodes (and any edges copied along with both their endpoints) so pasting doesn't collide with existing ids.

`Ctrl+D` (duplicate in place, no clipboard) stayed in epic 0018 — simpler, no cross-app/cross-window clipboard semantics to design.

## Tasks
(Not broken down — revisit when this epic starts.)

## Notes
Worth deciding early whether paste should work across two different open diagrams once epic 0024 (tabs/windows) exists — copying a node in one diagram and pasting it into another is a real, likely-wanted use case, but depends on that epic's shape (a real system clipboard vs. in-app-only state) more than this one's.
