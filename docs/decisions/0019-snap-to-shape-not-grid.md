# 0019: The canvas is an unstructured surface; an element is placed relative to other elements

## Status
Accepted. Reformulated 2026-11-26 as the principle behind the original decision (snap to shapes, never to a grid).
Supersedes: none
Superseded by: none

## Context
Alignment while dragging could mean snapping to nearby shapes or to a fixed grid. The two rest on different ideas of what the canvas is.

## Decision
**The canvas is an infinite, flat, unstructured surface, and a diagram element is only placed relative to other diagram elements.** The canvas imposes no grid, no page and no columns of its own. A position is a free coordinate that means something only next to what is around it.

What follows from it:
- **Alignment is to other elements.** While dragging, an element's edges and centre snap to another element's within 5 screen pixels (divided by the zoom, so it feels the same at any zoom), and the elements need not touch, so two shapes with a gap between them can still line up. Guides show the match.
- **There is no grid** in the data model or in the interface, and no setting for one.
- **Aligning with what an element is connected to is a different question.** It is a layout question, with a layout algorithm behind it, and this decision does not answer it.

## Alternatives considered
- **Snap to a grid.** A grid is a structure the diagram does not have: it aligns elements to coordinates nobody sees, not to the diagram's own content.

## Consequences
- The snap geometry is a small pure module, independent of React Flow, that other alignment features can reuse.
- Snapping and guides apply while dragging, not while resizing.
