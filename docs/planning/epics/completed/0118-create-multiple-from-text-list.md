# 0118: Create multiple shapes/containers from a pasted text list

## Status
Done — live-tested and confirmed working by the user, merged (squash).

## Goal

Right-click the Shape or Container button in the "Add to diagram" dock palette to open a small text window; paste or type a list of lines, and each non-blank line becomes the label of one new shape (or container) — a fast path for adding several named elements at once instead of one click-and-rename per element.

## Tasks
- [x] Design — see [ADR 0089](../../decisions/0089-bulk-create-from-text-list.md)
- [x] `BulkCreateDialog.tsx` — textarea + live count + Cancel/Create, Escape/outside-click/Ctrl+Enter
- [x] `Canvas.tsx`: `addMultipleNodes(type, labels)` — grid layout, one undo step, same per-type defaults as the existing single-add callbacks
- [x] `ItemPalette.tsx` / `DiagramDock.tsx`: right-click on Shape/Container buttons opens the dialog
- [x] `typecheck` / `lint`
- [x] Live test in the Electron renderer (user)

## Notes

Scoped to Shape and Container only — Text and Line palette buttons don't get this yet; a natural follow-up if the pattern proves useful there (a Text bulk-create would be closer to "several labels dropped on canvas," a Line one is less obviously useful since lines aren't usually named in bulk).

No `.chd` schema change — see ADR 0089's Consequences.
