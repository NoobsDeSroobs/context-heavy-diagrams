# 0168: Teach assistants to reroute edges around entities

## Status
In Progress. The `route_edges` operation is built ([ADR 0138](../../decisions/0138-assistants-build-diagrams-like-a-person-through-one-implementation-behind-the-cli-and-the-mcp-server.md)) and chooses the connection points it routes from ([ADR 0138](../../decisions/0138-assistants-build-diagrams-like-a-person-through-one-implementation-behind-the-cli-and-the-mcp-server.md)); what is left is the second trial with assistants and the guidance. Released in 0.10.0 as it is.

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
**Lanes as a diagram element.** A person (or an assistant) marks a corridor, such as the gap between two rows of domains, and edges are assigned to follow it. A person could use it in the app, and the router would have only to send edges down a declared lane. It needs a new concept in the file format and the editor, and fits with [0188](../completed-epics.md#0188-edges-that-attach-loosely-to-their-connection-points) (where an edge attaches) and the free-space router of ADR 0138, which does not need it. Not planned.

## What was built first (2026-11-14)
`route_edges {ids?}` (ADR 0138). On the trial diagrams it removes every edge drawn across an element (3 of 3 on `small.chd`, 38 of 38 on `large.chd`, in under 0.1 s) and leaves the crossings about where they were (0 to 1 on small; 39 to 50 on large, because the placement of ten domains with 29 connections between them forces them). A first version had a route running through its own source box: edges are now checked against their own two elements too. The picture of the large one is right-angled and clean of elements but busy, with long runs through the gaps between domains; the placement is the next lever.

## First trial (2026-11-14), extension `0.10.0+bf2e877`, one run each, no new guidance
Scored with `scripts/reroute-trial/score.mjs`; the brief does not mention `route_edges`.
- **small, two runs: 7 problems to 0 in both.** Both found and used `route_edges` for the edge across Database, then routed the edge across Message queue and Analytics warehouse by hand, over the top of the diagram: the router's route for it crossed another edge, which they would not accept. Labels were moved with `labelPosition`. One run also moved five elements and bent an edge as a curve; the other changed two elements and made an edge straight. Neither could render the diagram.
- **large, router only: 77 to 49** (38 through elements to 0, crossings 39 to 49). It stopped there: the rest "come from the structure". It also added two connection points it could not use.
- **large, own router: 77 to 22** (0 through elements, 22 crossings), the cleanest picture of the four. That run (it had a shell, so not what a chat-only user has) wrote its own router, added 111 connection points so that no two edges share one, **removed and re-made 70 edges** to put them on the new points, made 48 edges straight, and swapped the places of 11 same-sized elements inside their containers.
- **What it shows:** (1) every run hit the same gap: an existing edge cannot be moved to another connection point, which cost one run 70 re-made edges (fixed: `set_edge_handles`). (2) On the large diagram the lever was not routing but attachment: each edge on its own point on the side facing its other end, so edges run straight and do not fan. `route_edges` does not choose points. (3) Small edges: the crossing price is low enough that the router accepts a crossing where a person goes a long way round.


[0162](../completed-epics.md#0162-minimum-distance-between-connected-elements) (spacing, which makes room for a lane), [0164](../completed-epics.md#0164-tooling-fixes-from-the-first-assistant-trial-runs), [0165](../completed-epics.md#0165-an-editing-tool-for-assistants), [0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks) and [0167](../completed-epics.md#0167-an-assistant-can-see-the-diagram-it-drew).

## Second look (2026-11-15), the maintainer's reading of the four runs
Small 2 a little better than small 1, with much to criticise in both. Large 2 a little more readable (no shared points, sensible use of them), but its routing a jumble; large 1 very bad. Wider spacing between lines would give clearer air gaps. Fixes the maintainer made by hand to large 2, each now a rule:
1. The last straight piece of an edge long enough that the arrowhead does not cover the last bend (router: 24 px, shorter only where the gap is narrow).
2. Edges kept off container borders (router: no lane within 8 px of a border, and the end piece stops short of one).
3. Connection points evenly spaced, as in the app, not at offsets the assistant chose ([ADR 0175](../../decisions/0175-assistants-make-what-a-person-can-make.md); `add_connection_point` now respaces the side).
4. Bends not on top of each other, so crossings fall on clear straight pieces (router: a high price for a bend or a straight pass where another edge has a corner).
5. Container borders heavier, so they read apart from edges. Not a default change: the build guide now says that in a complex, busy diagram style is used to increase the differences between aspects (borders, weights, colours).
Principle from the maintainer: an assistant's diagram and a person's must look alike, with no custom edges and no custom point locations.

Router, large diagram, every edge routed: edges across elements 38 to 0; crossings 41 (price 1200; 39 at the start); lanes 14 to 20 px apart, up to 6 in a gap. Small diagram: 3 crossings left whichever price, where the hand fixes had none.

## Tasks
- [x] Build the router as an edit operation (`route_edges`), with tests, the operations help, the build page, the changelog and ADR 0138
- [ ] Trial runs with `scripts/reroute-trial/` (`small.chd`, `large.chd`, `brief.md`, `score.mjs`): an assistant is asked to fix the reported problems, now with `route_edges` available; record what it does and what is left
- [x] `set_edge_handles` (move an edge's ends to other connection points), from the trial
- [x] `route_edges` choosing connection points ([ADR 0138](../../decisions/0138-assistants-build-diagrams-like-a-person-through-one-implementation-behind-the-cli-and-the-mcp-server.md)): one per edge on the side facing its other end, in the order of their targets, evenly spaced. On the trial diagrams, every edge routed: small 3 crossings and 3 label collisions to 0; large crossings 54 to 33, none over an element. Still to look at: crowded spots where many edges meet one side (the large diagram's Identity & Access Management), and choosing the side by cost where the facing side is blocked
- [ ] A second trial round after rebuilding the extension (`npm run build:extension`)
- [x] Wider lanes, container-border and corner rules, a longer end piece, the crossing price (1200); the small diagram's last 3 crossings remain
- [ ] Decide what to teach, where it lives and whether a crossing check belongs in the tools
