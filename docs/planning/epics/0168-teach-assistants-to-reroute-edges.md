# 0168: Teach assistants to reroute edges around entities

## Status
Not Started. An idea for later; it needs a lot of trial and error before anything is worth writing down as guidance.

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

## Related
[0162](../completed-epics.md#0162-minimum-distance-between-connected-elements) (spacing, which makes room for a lane), [0164](../completed-epics.md#0164-tooling-fixes-from-the-first-assistant-trial-runs), [0165](../completed-epics.md#0165-an-editing-tool-for-assistants), [0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks) and [0167](../completed-epics.md#0167-an-assistant-can-see-the-diagram-it-drew).

## Tasks
- [ ] Trial runs: ask an assistant to fix crossings in a few dense diagrams and record what it gets wrong
- [ ] Decide what to teach, where it lives and whether a crossing check belongs in the tools
