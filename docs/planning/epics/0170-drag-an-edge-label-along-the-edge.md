# 0170: Drag an edge label along the edge

## Status
Not Started. Logged 2026-11-04; the next small editor feature after 0180. **Decided (2026-11-09): hold Alt and drag**, the same modifier that already means "copy" when dragging an entity, so the label drag reads as a variation of it.

## Goal
Move an edge's label along the edge by dragging it on the canvas, as an alternative to selecting the edge and using the label-position slider in the properties panel. The stored value stays `style.labelPosition` (a 0 to 1 fraction along the path), so the file format does not change.

## Tasks
- [x] Guard against accidental moves: Alt held while dragging (decided). Check it does not clash with the OS: some Linux window managers take Alt+drag to move the window, so verify on Linux and offer a fallback if it does
- [ ] Drag handler in `LabeledEdge.tsx` that projects the pointer onto the rendered path and writes `labelPosition`, one undo step per drag
- [ ] Respect locked elements; clamp to 0..1; works for every routing kind and for edges with bend points
- [ ] Show the guard key in the shortcuts help and mention it in the getting-started guide
- [ ] Tests for the projection onto a path

## Notes
Without the guard a click on a label to select or edit the edge could slide it by a pixel; the modifier removes that risk. The slider stays. Alt+drag is taken by many Linux window managers (move the window), which the maintainer cannot test from Windows, so flag it for a check there.
