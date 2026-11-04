# 0171: Animated edges

## Status
Not Started. Logged 2026-11-04; for later.

## Goal
Let an edge be animated (a flow moving along the line, in the arrow's direction) to mark something live, such as a running integration or an active data flow, as opposed to a planned or dormant one. It is a style of the edge, like its line style, so it can also be part of a legend line.

## Tasks
- [ ] Decide what animates: a moving dash pattern along the path (React Flow's own `animated` edge is the cheap first thing to try), or moving dots; check what the library offers before building anything
- [ ] An `animated` flag in the edge style, set in the edge properties and by a style preset; additive file-format change, so `docs/file-format.md`, the skill's field reference and the validator follow
- [ ] Direction: follow the arrow, and the active edge direction set when the arrow is reversed or two-way
- [ ] Respect the system's reduced-motion setting (no animation, the line stays as a dashed or marked line), and a way to pause all animation for a diagram
- [ ] Cost on large diagrams: measure many animated edges at once, and animate only what is on screen
- [ ] Static output: SVG export and the compare window draw the edge still; decide whether the export marks it (for example a dash) so the meaning is not lost
- [ ] A legend line can carry it
- [ ] Tests for the style round trip and for the static export

## Notes
Animation must not be the only carrier of the meaning: it vanishes in an export and for anyone with reduced motion, so a tag on the edge (or a legend entry) is what says "live". Not wanted: animation as decoration on every edge by default.
