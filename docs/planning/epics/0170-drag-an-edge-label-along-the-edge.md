# 0170: Drag an edge label along the edge

## Status
Built (2026-11-09), to be tried by the maintainer; still to check on Linux (Alt+drag). Hold Alt and drag the label ([ADR 0164](../../decisions/0164-alt-drag-slides-an-edge-label-along-its-edge.md)), the same modifier that means "copy" when dragging an entity.

## Goal
Move an edge's label along the edge by dragging it on the canvas, as an alternative to selecting the edge and using the label-position slider in the properties panel. The stored value stays `style.labelPosition` (a 0 to 1 fraction along the path), so the file format does not change.

## Tasks
- [x] Guard against accidental moves: Alt held while dragging (decided). Check it does not clash with the OS: some Linux window managers take Alt+drag to move the window, so verify on Linux and offer a fallback if it does (the slider is the fallback; logged with the duplicate drag in `docs/known-issues.md`)
- [x] Drag handler in `LabeledEdge.tsx` that projects the pointer onto the rendered path and writes `labelPosition`, one undo step per drag
- [x] Respect locked elements; clamp to 0..1; works for every routing kind and for edges with bend points (edges have no lock; the projection clamps; it works on the drawn path, whatever the routing)
- [x] Show the guard key in the shortcuts help and mention it in the getting-started guide
- [x] Tests for the projection onto a path (`src/shared/geometry/pathSampling.test.mjs`)
- [ ] Try it in the app on Windows; try Alt+drag on Linux

## Notes
Without the guard a click on a label to select or edit the edge could slide it by a pixel; the modifier removes that risk. The slider stays. Alt+drag is taken by many Linux window managers (move the window), which the maintainer cannot test from Windows, so flag it for a check there.

Driven in the dev app over the DevTools protocol on `examples/gallery/technical/c4-context.chd` (a Bezier edge): a plain drag leaves the label, Alt+drag slides it along the line, far past either end stops at the end, the Position slider follows, one Ctrl+Z per drag, and Alt+click adds no undo step. Not driven: step and smoothstep routing, edges with bend points, the compare window (its edges accept the drag as they do bend points, but nothing is saved there). Dragging a bend point still makes one undo step per move, as before; it is not part of this epic.
