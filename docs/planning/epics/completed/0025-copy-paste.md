# 0025: Copy / paste

## Status
Done (2026-08-22)

## Goal
Real clipboard copy/paste for nodes (and edges between copied nodes) — `Ctrl+C`/`Ctrl+V`/`Ctrl+X`. Split out from epic 0018 (selection and keyboard shortcuts): unlike most of that epic, this isn't just a keybinding over existing behavior — it needs an actual clipboard data model, paste-position logic, and id regeneration for pasted nodes (and any edges copied along with both their endpoints) so pasting doesn't collide with existing ids.

`Ctrl+D` (duplicate in place, no clipboard) stayed in epic 0018 — simpler, no cross-app/cross-window clipboard semantics to design.

## Decisions made
Full reasoning in [ADR 0049](../../../decisions/0049-clipboard-copy-paste.md). Short version, resolving every open question:
- **Real OS clipboard** (not in-app-only state) — settled directly by this app's existing one-window-per-diagram model (ADR 0023): an in-app clipboard couldn't cross windows at all, the OS clipboard gets that for free. Plain JSON text with a `chdClipboard` marker; anything unmarked/malformed is a silent no-op on paste.
- **Edges only copy when both endpoints are also copied** — copying just an edge alone is a no-op.
- **Every id regenerated on paste**, edges' source/target remapped via an old→new id map; connection point ids untouched (already scoped per-node).
- **Paste position: current viewport center**, not the original absolute position — avoids landing far outside a different diagram's content when pasting cross-window. Multi-node copies keep their relative arrangement, recentered. Repeated Ctrl+V cascades diagonally (+20px/repeat), matching standard clipboard-paste convention.
- **Cut reuses `rfInstance.deleteElements(...)`**, not a hand-rolled filter — same cascade-aware removal Delete-key already uses, so container-children promotion (ADR 0012) stays correct for free.
- **Known, inherited limitation**: a copy's `details`/`linkedDiagram`/custom-icon references point at the same file as the original (by reference, not duplicated) — not new, `Ctrl+D` already has this exact behavior; not fixed here.

## Tasks
- [x] `src/renderer/src/clipboard.ts` (new) — payload shape, build/parse/remap, pure logic.
- [x] Preload: `copyToClipboard`/`readClipboardText`, direct `electron.clipboard` access (no IPC needed, preload runs unsandboxed).
- [x] `Canvas.tsx`: `copySelection`/`pasteFromClipboard`/`cutSelection`, wired into the keyboard handler (deferring to native text-field behavior, same as Ctrl+A/D/Z) and the Edit menu.
- [x] `npm run typecheck` clean; `npm run lint` shows the same 4 pre-existing errors (epic 0028), zero new ones.

## Notes
**Live-tested by the user, confirmed working** (2026-08-22): "It also seems to work perfectly." A real, unplanned benefit surfaced immediately: since the clipboard payload is plain JSON text (not an opaque native format), a copied fragment can be pasted directly into a chat message — the user's own example: sharing a snippet with a colleague for help ("I don't know how to do X" / "please fill in Y") without either side needing the whole `.chd` file or a repo checkout. Worth keeping in mind if the clipboard format is ever reconsidered — this is a real, validated use case for staying plain-text rather than switching to a more compact/opaque encoding.
