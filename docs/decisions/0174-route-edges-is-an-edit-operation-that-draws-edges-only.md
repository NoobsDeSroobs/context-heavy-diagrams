# 0174: `route_edges` is an edit operation that draws edges only

## Status
Accepted (2026-11-14)
Extends: [0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md), whose operations lay nothing out; this one routes edges and still places no element.
Superseded by: none

## Context
An assistant that sees an edge drawn across an element can only fix it by computing coordinates: bend points that clear every box and every other edge, for each edge. That is exact work, easy in code and error-prone in a language model, and on a large diagram (dozens of reported edges) it is most of the cost of a repair. The checks already say which edges are wrong ([0161](0161-the-layout-check-judges-edges-as-they-are-drawn.md)).

## Decision
- **A new operation, `route_edges {ids?}`**, in the shared edit core, so the extension's `edit_diagram` and `chd edit` have it identically ([0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)). With `ids` it routes those edges; without, the edges the layout check reports as drawn across an element or crossing another edge.
- **It draws edges and nothing else.** No element, container size or connection point moves; the edge gets bend points and the `step` routing style. Where everything goes stays the assistant's decision.
- **How:** a grid of lanes is laid over the free space (the gaps between element sides, up to four lanes in a wide gap, three round the whole drawing). Each edge leaves its connection point straight out and is searched through the lanes at the least cost: length, each bend, each crossing of another edge, each pixel along another edge's lane, and each pixel inside a container the edge does not belong to. Edges are routed one at a time, shortest first, each seeing the ones before it and the edges that are not being routed.
- **Simple cases stay simple:** an edge whose plain `step` route clears every element, including its own two, and crosses nothing, gets no bend points.
- **Never worse on elements:** a route that still touches an element, its own two included, is discarded, and the edge is left as it was. So is an edge with no room beside an end, one with no route, one to a container or to itself, and any edge left when the time limit (8 seconds) is reached. The answer names each with its reason.
- **Deterministic:** the same diagram gives the same routes.
- **Not covered:** edge labels (the checks report a label that lands on something, and `labelPosition` moves it), choosing another connection point, containers as ends, and diagrams that show an edge direction set other than the first.

## Alternatives considered
- **Guidance only:** teach the assistant to compute bend points. Leaves the geometry to the model, and the work grows with the number of edges.
- **Lanes as part of the diagram:** a person or an assistant marks a corridor and edges are assigned to it. It would let a person use the same routing in the app, but it is a new concept in the file format and in the editor; this operation needs none of that and can sit under it later.
- **A router in the app for people:** nothing in the editor asks for it yet.
- **Also moving elements to make room:** the placement decision is the assistant's, and a router that moves things would undo what a person arranged on purpose.

## Consequences
- Edges drawn across elements are removed in one call, and a clear edge keeps its look.
- The number of crossings is only as low as the placement allows: a layout where many edges join distant elements gets right-angled edges that cross each other and run in busy corridors. Fixing that is placement.
- Routed edges are right-angled, and a diagram that was curved becomes partly stepped.
- The routing works in lanes between elements, so it needs gaps; the guidance says to leave them.
