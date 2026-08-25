# 0088: Detect/highlight edges crossing container boundaries

## Status
Not Started — idea only, not yet scoped

## Goal
Detect edges whose source and target shapes sit in *different* containers (or one in a container and one outside), and call that out visually somehow — similar in spirit to how a swim-lane diagram makes a cross-lane flow visually distinct from an in-lane one. Idea only; no decisions yet on how it should actually surface (a distinct edge style, a diagnostic/warning list like the existing empty-legend check, a togglable highlight mode, something else).

## Open questions, not yet discussed with the user
- What should "crossing" actually look like once detected — automatic edge styling (color/dash), an opt-in highlight/dim mode (compare epic 0063's dim-non-matching-elements idea), a DiagnosticsPanel-style list, something else entirely?
- Does "container" here mean direct `parentId` only, or should it walk up nested containers (a container inside a container) and compare top-level ancestry?
- Is this actually about containers specifically, or does it generalize to "any two elements whose nearest common container differs" regardless of nesting depth?
- Related to, but distinct from, [epic 0077](0077-swim-lanes.md)'s open question about whether swim lanes need to be a dedicated construct — this could plausibly be useful with or without that ever being resolved, since it only needs containers to already exist (epic 0004), not a dedicated lane type.

## Notes
Raised by the user 2026-08-24 as a "for later" idea, logged without further design discussion — not scoped, not committed to any particular implementation shape yet.
