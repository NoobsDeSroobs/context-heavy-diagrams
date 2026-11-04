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
- [x] Controls: `animationSpeed` (a multiplier, 0.1 to 10) and `animationDirection` (forward or reverse) per edge, shown in the panel only while an edge is animated, copied by the brush; setting None removes both
- [x] One global switch: the **Animate edges** preference (on by default) draws every animated edge still; a class on the canvas, so no edge re-renders
- [ ] **View → Animate edges** toggle (checked while on) with a shortcut, bound in the command registry; with it off, holding Ctrl/Cmd over an edge still animates that edge, the same hover-with-modifier idea as the note peek on a node
- [ ] **Pulse distance** (`pulseDistance`): 0 or absent is one pulse repeating; a positive number is the distance between pulses in a stream; negative is read as 0
- [ ] **Dash length and gap** (`dashLength`, `dashGap`) for a dashed, dotted or flowing line, so the pattern can be set; used by the canvas, the SVG export and the flow
- [ ] **Animated legend line**: a legend entry can carry the animation, speed, direction, pulse distance and dash settings, so the legend arrow moves; picking a legend line from an edge copies them; image exports stay still
- Decided against: animating only the selected edges, and showing the speed in the legend
- [x] Looked at in the running app (2026-11-04, over the DevTools protocol): flow and pulse draw, the loop times match the speed (flow 0.49 s at speed 1, 0.98 s at 0.5; pulse halves at 2), reverse runs the other way, and an unstyled edge draws its arrowhead
- [ ] Still to look at by eye: the pulse dot on step and curved routing, a selected edge, a dotted line, switching the direction set, light and dark theme, and that the `flow` loop has no visible jump
- [ ] Measure a diagram with many animated edges

## Notes
The maintainer has looked at the first version (flow and pulse, no speed or direction) in the app and found it good. Two things were not looked at: that the `pulse` dot rides the path on every routing kind (it uses SVG motion along the same path the line is drawn with), and that the `flow` loop has no visible jump. The reverse pulse (`keyPoints`) was checked only as attributes, not by watching a dot.

The missing arrowhead on a default edge ([known issues](../../known-issues.md)) was found while testing this and fixed on the same branch, since it is unrelated to animation.

Not in the first version, by decision: the legend (a legend row does not animate, so there is no way to show "live" there yet), the SVG export (still) and the per-edge-direction-set default style. A rule or tag that sets the field automatically ("status=live" animates) was considered and left for later.
