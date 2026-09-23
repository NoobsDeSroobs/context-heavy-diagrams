# 0132: Modifier+drag duplicates the dragged selection

## Status
Planned — design agreed in part (2026-09-23), not started. From the first external feature request ("Alt+drag = duplicate").

## Goal
Holding a modifier while starting a drag on a selected node (or selection) leaves a copy behind and drags the selection on, like Figma/Illustrator/draw.io.

## Decisions so far
- **The dragged thing should feel like the new object**: the untouched original stays put with its ID and edges; the copy is a fresh node (new ID, no edges — same as Ctrl+D, [ADR 0049](../../decisions/0049-copy-paste.md)) seeded from the original's data. Mechanically React Flow's drag is already bound to the grabbed node's id by the time Alt is known, so this needs a hand-off (spawn the new node on pointer-down in the capture phase, then start the drag on it) — to be prototyped first.
- **One modifier only.** Open: **Alt** (as requested; but many Linux window managers — GNOME, KDE, XFCE, i3 — grab Alt+drag to move the whole window, so the app never sees it) vs **Ctrl/Cmd** (free here: multi-select is pinned to Shift, Ctrl+click is link navigation; matches draw.io) — needs a decision, and Alt needs Linux testing if chosen.
- A dragged **container** should leave a full copy including its children (reuse `remapForPaste`, which already remaps nested `parentId`s).
- One undo step for clone + move.

## Tasks
- [ ] Decide the modifier
- [ ] Prototype the pointer-down hand-off
- [ ] ADR, implementation, live test (Windows + Linux)
