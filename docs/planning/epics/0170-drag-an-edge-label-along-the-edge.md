# 0170: Drag an edge label along the edge

## Status
Not Started. Logged 2026-11-04; for later.

## Goal
Move an edge's label along the edge by dragging it on the canvas, as an alternative to selecting the edge and using the label-position slider in the properties panel. The stored value stays `style.labelPosition` (a 0 to 1 fraction along the path), so the file format does not change.

## Tasks
- [ ] Decide the guard against accidental moves: a held modifier key (such as Alt or Shift), or only after the edge is selected; pick keys that do not clash with the existing drag, duplicate and pan gestures on both Windows and Linux
- [ ] Drag handler in `LabeledEdge.tsx` that projects the pointer onto the rendered path and writes `labelPosition`, one undo step per drag
- [ ] Respect locked elements; clamp to 0..1; works for every routing kind and for edges with bend points
- [ ] Show the guard key in the shortcuts help and mention it in the getting-started guide
- [ ] Tests for the projection onto a path

## Notes
Without the guard a click on a label to select or edit the edge could slide it by a pixel; the modifier removes that risk. The slider stays.
