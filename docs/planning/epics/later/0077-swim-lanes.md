# 0077: Swim lanes — maybe not a real feature at all

## Status
Not Started — not yet scoped, and the user's own framing is skeptical of whether this needs to exist as a distinct feature at all. Raised by the user (2026-08-24) alongside unrelated naming/threat-matrix work.

## Goal
Swim lanes (the BPMN-style convention: horizontal or vertical bands partitioning a diagram by responsible actor/role/team, with elements placed within their lane) are a common diagramming request. Whether this app needs a dedicated construct for them, or whether the existing Container node type already covers it, is the actual question this epic is about — not a commitment to build anything.

## The open question this epic is really about
**Do we need a distinct swim-lane feature, or is a Container already sufficient?** The user's own framing: "I can not think of some special feature that a swimlane needs that is not doable with a container." Nothing here should be read as a decision to build a dedicated swim-lane node type — this is a placeholder to think through the comparison, not a scoped feature.

## What a conventional swim lane offers, for comparison against Container
Listed so a future pass can check each one against what a Container (epic 0004) already does, not as a requirements list to build:
- A persistent header/label band, distinct from the lane body itself.
- Full-span sizing along one axis (spans the whole diagram's width or height), often auto-resizing as the diagram grows rather than being manually sized like an ordinary container.
- Multiple parallel lanes sharing one axis, typically with equal width/height and aligned edges to each other.
- Reordering/inserting a lane shifts or resizes its siblings automatically.

Whether any of these are actually needed, or whether they're solvable today by manually sizing/positioning a few Containers side by side, isn't evaluated here.

## Notes
Not scheduled into any current batch — flagged here so the idea isn't lost, not because it's next up. Genuinely might resolve to "no new feature needed" once actually looked at against Container's existing capabilities.
