# 0156: Threat matrix design pass

## Status
Not Started.

## Goal
`ThreatMatrixView.tsx` (589 lines, one 482-line component) began as a proof of concept. Redesign it with a real design pass, set up for future additions rather than split mechanically.

## Tasks
- [ ] Write down what the matrix has to do today and what is expected to be added (scales editor, more views, exports, rollups)
- [ ] Propose a structure and the state it needs (it shares `security` and the crawl with `Canvas.tsx`; see [ADR 0126](../../decisions/0126-canvas-features-are-hooks-that-own-their-state.md))
- [ ] ADR, then implement

## Notes
Not part of the mechanical splits in [0152](0152-split-the-large-files.md) and [0154](0154-canvas-feature-hooks.md); the threat-matrix hook from 0154 should be done first so the redesign starts from a clean boundary.
