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
- Probably needs a check the assistant can run (`chd check`-style) or the picture of its own output ([0167](0167-assistants-can-see-their-own-output.md)).

## Related
[0162](../completed-epics.md#0162-minimum-distance-between-connected-elements) (spacing, which makes room for a lane), [0164](0164-tooling-fixes-from-the-first-assistant-trial-runs.md), [0165](../completed-epics.md#0165-an-editing-tool-for-assistants), [0166](../completed-epics.md#0166-the-mcp-server-and-the-command-line-share-their-checks) and [0167](0167-assistants-can-see-their-own-output.md).

## Tasks
- [ ] Trial runs: ask an assistant to fix crossings in a few dense diagrams and record what it gets wrong
- [ ] Decide what to teach, where it lives and whether a crossing check belongs in the tools
