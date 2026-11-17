# 0088: Detect/highlight edges crossing container boundaries

## Status
In Progress. Decided 2026-11-17 with the maintainer; first slice built ([ADR 0185](../../decisions/0185-edges-that-cross-a-container-are-marked-with-a-gate.md)).

## Goal
Detect edges whose source and target shapes sit in *different* containers (or one in a container and one outside), and call that out visually somehow — similar in spirit to how a swim-lane diagram makes a cross-lane flow visually distinct from an in-lane one. Idea only; no decisions yet on how it should actually surface (a distinct edge style, a diagnostic/warning list like the existing empty-legend check, a togglable highlight mode, something else).

Update 2026-11-15: for BPMN-style flows this is the functional half of a swim lane: a container is the lane visually, and an edge that leaves its lane is a hand-off. Re-read it with [0105](../completed-epics.md#0105-behaviour-the-flow-elements), where a stencil carries no context of its own and its lane (its parent container) is the only context it has.

## Decided
- A lane is the container an element has as its parent; nested containers count one border each; every edge counts.
- Shown as a gate along the border, on a session switch that is off by default (View, Display, Mark crossings), and on a Ctrl hover over the edge; derived, nothing in the file.
- A rule that forbids a crossing ("no edge between zone A and zone C") is a check of a diagram metamodel, not part of this.

## Tasks
- [x] The crossing function, the gates on the canvas and in the SVG export, the Ctrl peek, the switch, an example (`examples/crossings.chd`)
- [ ] The gate and the whole edge highlighted as a second mode, for when a crossing should stand out
- [ ] A list of the crossings with counts per pair of containers, each row selecting its edges
- [x] The assistant tools: the crossings in `inspect_diagram`, with the other tool work for Behaviour ([ADR 0187](../../decisions/0187-assistants-build-behaviours-and-read-crossings.md))
- [ ] A file setting, only if the need shows
- [x] Tried in the app on real flows by the maintainer (2026-11-17)

## Notes
Raised by the user 2026-08-24 as a "for later" idea, logged without further design discussion — not scoped, not committed to any particular implementation shape yet.
