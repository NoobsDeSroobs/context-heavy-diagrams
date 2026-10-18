# 0099: Modifier+drag duplicates by dragging a fresh copy; the original is left untouched

## Status
Accepted (2026-09-24); implemented and live-tested on Windows (Linux untested, see known-issues).

## Context
First external feature request: "Alt+drag = duplicate". The natural model (Figma, draw.io) is that the original stays where it is — same id, same edges — and the thing under the pointer is a new object.

## Decision
- **Hand-off.** React Flow binds a drag to the node it was pressed on, so we can't just retarget it. `useModifierDragDuplicate` catches the modifier mouse-down in the capture phase (before React Flow's own listener) and swallows it; after the pointer travels 4px it spawns the copy in place, selected, and replays a mouse-down at the original press position on the copy's DOM element, so React Flow starts a normal drag on it. All existing drag behaviour (snapping, guides, reparenting on drop) applies to the copy for free. A press-and-release without travel is left as a plain click.
- **What is copied:** the dragged selection (or just the grabbed node if it wasn't selected) plus every descendant of a copied container; edges *between* copied nodes are copied (like clipboard copy/paste, unlike Ctrl+D); a copy whose parent wasn't copied stays in that same container. Copies get fresh ids and selection; `directionSets` on copied edges are dropped, same as paste.
- **One undo step** for copy + move: `beginContinuousEdit` before the copy, closed by the drag's end (or by a fallback if the drag never started).
- **One modifier only: Alt** (as requested), held in a single constant. Locked nodes, label inputs, connection handles and resize handles are ignored; Alt combined with Shift / Ctrl / Cmd is ignored (Shift is multi-select; AltGr arrives as Ctrl+Alt on Windows).

## Alternatives considered
- **Clone at the origin, drag the original** (simplest): the moved node keeps the id and edges, the stationary copy is the "new" one — backwards from the user's model, and edges would follow the wrong node.
- **Swap identities mid-drag** (give the original's id to the stationary copy, rewire edges/parent links): fragile with containers and with React Flow's id-keyed drag state.
- **Ctrl/Cmd as the modifier**: safe on Linux, but not what was asked for; left as a one-line switch.
- **Accept both Alt and Ctrl**: rejected by the user — two keys for one action.

## Known limits / to verify
- **Linux:** many window managers (GNOME, KDE, XFCE, i3) grab Alt+drag to move the window, so the app may never receive it. Needs testing on Linux; the fallback is `'ctrlKey'`.
- A copy shares the original's details-note path (as Ctrl+D and paste already do).
- Relies on React Flow internals staying as they are: nodes are `.react-flow__node[data-id]`, and its drag accepts a synthetic mouse-down. A React Flow upgrade could break the replay.

## Addendum (2026-09-24): Alt no longer reveals the native menu bar
Live testing showed Alt revealing Electron's native File/Edit menu, because windows used `autoHideMenuBar: true` (hidden until Alt is pressed). Windows now use `setMenuBarVisibility(false)` without `autoHideMenuBar`, so Alt does nothing there (`src/main/windows.ts`). The app's own in-renderer menu bar is unaffected. Main-process change: needs an app restart, not just a renderer reload. Linux behaviour of the same API is unverified.
