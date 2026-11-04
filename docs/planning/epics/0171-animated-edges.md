# 0171: Animated edges

## Status
Built on the branch `epic/0171-animated-edges` (2026-11-04); not merged. Decision: [ADR 0141](../../decisions/0141-animated-edges-are-an-edge-style-field.md).

## Goal
Let an edge be animated (movement along the line, from the source end to the target end) to mark something live, such as a running integration or an active data flow, as opposed to a planned or dormant one. It is an edge style field, none by default, so the copy-style brush carries it from one edge to another and it is stored in the file.

## Tasks
- [x] Decide what animates: React Flow's own animated edge is a dash flow with no way to choose a kind, so two kinds of our own: `flow` (dashes travel along the line) and `pulse` (a dot travels along it)
- [x] `animation` in the edge style (`"flow"` | `"pulse"`, absent = none); an unknown value draws the edge still; `docs/file-format.md` and the skill's field reference
- [x] Properties panel: Line, Animation (None / Flow / Pulse), works on a multi-selection
- [x] Direction follows source to target, so it follows the arrow of the active edge direction set; nothing to transform when the reading changes
- [x] Respect the system's reduced-motion setting; the compare window shows the edge still
- [x] The copy-style brush copies the animation, and painting from an edge with none clears the target's (tests)
- [x] Round trip through save and load (test); the helper for the dash, timing and dot size (tests)
- [ ] Look at it in the app (see Notes): speed, the dot's size and colour, a selected edge, step and curved routing, a dashed and a dotted line, switching the direction set, light and dark theme
- [ ] Measure a diagram with many animated edges

## Notes
Not verified by eye: the animation could not be run here, so the checks are the unit tests, the type check and the lint. The two things most worth a look are that the `pulse` dot rides the path on every routing kind (it uses SVG motion along the same path the line is drawn with) and that the `flow` loop has no visible jump.

Not in the first version, by decision: the legend (a legend row does not animate, so there is no way to show "live" there yet), the SVG export (still) and the per-edge-direction-set default style. A rule or tag that sets the field automatically ("status=live" animates) was considered and left for later.
