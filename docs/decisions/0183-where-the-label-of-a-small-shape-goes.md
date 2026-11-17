# 0183. Where the label of a small shape goes

## Context
The small shapes of [Behaviour](0180-stencils-are-light-elements-for-events-and-verbs.md) (starts, ends, events, branches) carry their label outside, because text does not fit inside them. Below was the only place, so an edge leaving the bottom of a shape ran through its label, and no position of the shape avoided it.

## Decision
- **A label has a position: below (the default), above, left, right or free**, stored on the element as `data.labelPosition` (absent is below). A step's label is inside it and has none.
- **A free label sits at `data.labelOffset`**, the offset of its centre from the shape's centre, and is tied to the shape by a dotted line once it is clear of it. It is dragged on the canvas while its shape is selected.
- **The position is explicit and stored, not chosen by the app.** An automatic choice (the side with no edge) was considered: it needs no work from the person, but labels would move when an edge is added or removed, and the file would not say where the label is.
- **The canvas and the exports place the label by the same rules**, written once (`shared/stencils/labelPlacement.ts`). Draw.io has no label with a leader line, so a free label is exported below, with a note.
- **A look, not a meaning:** a change of position shows in the review of changes with the other look changes.
- Not covered: the label of an entity or an edge, and a layout check that names a free side. A container's label has its own rule ([ADR 0184](0184-the-label-of-a-container-goes-on-any-side.md)).

## Consequences
The file format gains two optional fields on a stencil, readable by an older version, which draws the label below. Assistants can set them once the tools cover Behaviour.
