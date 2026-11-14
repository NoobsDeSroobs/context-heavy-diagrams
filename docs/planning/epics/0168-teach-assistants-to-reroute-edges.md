# 0168: Teach assistants to reroute edges around entities

## Status
In Progress. The `route_edges` operation is built ([ADR 0174](../../decisions/0174-route-edges-is-an-edit-operation-that-draws-edges-only.md)); what is left is the trial with assistants and the guidance.

## Goal
An assistant that draws a diagram can see that an edge crosses an entity and fix it, the way a person does: by adding bend points to the edge and changing its routing style. When many edges have to cross the same crowded area, it routes them together through a corridor (a "routing highway") instead of letting each one cut through the entities.

## Why
Found while testing the C4 examples: a line crossed an entity, and the fix was one bend point on the edge (`points`) and a different `routingStyle` in its style. Assistants today only set the end points and the handles, so crossings stay.

## Ideas
- Teach the skill, the MCP guidance and the copy-paste instructions that an edge can carry `points` and a `routingStyle`, and when to use each.
- Tell an assistant how to notice a crossing: an edge's straight path against the boxes of the entities it passes.
- Routing highways: leave a lane free between rows or columns of entities and run the crossing edges along it, with a bend point at each end.
- The check an assistant can run after drawing exists now ([0167](../completed-epics.md#0167-an-assistant-can-see-the-diagram-it-drew)); this epic teaches it to act on what the check lists by rerouting.

## A benchmark
`scripts/spec-comparison/meridian-brief.md` is the Meridian Rail landscape as a brief (70 services in 10 domains, 83 connections, 29 of them between domains, spread over many domain pairs, so no grid puts every neighbour next to each other). The first run of an assistant on it (2026-11-14, `build` page, 7 `edit_diagram` calls, 168 operations) stopped after one pass with 77 problems left: 38 edges drawn across an element and 39 crossings. The example diagram it was made from has 126 by the same check (45 and 81). A routing method should bring such a run well below that.

## Direction, much later
**Lanes as a diagram element.** A person (or an assistant) marks a corridor, such as the gap between two rows of domains, and edges are assigned to follow it. A person could use it in the app, and the router would have only to send edges down a declared lane. It needs a new concept in the file format and the editor, and fits with [0188](0188-loosely-attached-edges.md) (where an edge attaches) and the free-space router of ADR 0174, which does not need it. Not planned.

## What was built first (2026-11-14)
`route_edges {ids?}` (ADR 0174). On the trial diagrams it removes every edge drawn across an element (3 of 3 on `small.chd`, 38 of 38 on `large.chd`, in under 0.1 s) and leaves the crossings about where they were (0 to 1 on small; 39 to 50 on large, because the placement of ten domains with 29 connections between them forces them). A first version had a route running through its own source box: edges are now checked against their own two elements too. The picture of the large one is right-angled and clean of elements but busy, with long runs through the gaps between domains; the placement is the next lever.

## Related
[0162](../completed-epics.md#0162-minimum-distance-between-connected-elements) (spacing, which makes room for a lane), [0164](../completed-epics.md#0164-tooling-fixes-from-the-first-assistant-trial-runs), [0165](../completed-epics.md#0165-an-editing-tool-for-assistants), [0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks) and [0167](../completed-epics.md#0167-an-assistant-can-see-the-diagram-it-drew).

## Tasks
- [x] Build the router as an edit operation (`route_edges`), with tests, the operations help, the build page, the changelog and ADR 0174
- [ ] Trial runs with `scripts/reroute-trial/` (`small.chd`, `large.chd`, `brief.md`, `score.mjs`): an assistant is asked to fix the reported problems, now with `route_edges` available; record what it does and what is left
- [ ] Decide what to teach, where it lives and whether a crossing check belongs in the tools
