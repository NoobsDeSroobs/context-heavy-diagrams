# 0176: Connection points slide a little to straighten edges

## Status
Accepted (2026-11-15)
Supersedes: none
Superseded by: none

## Context
A side's connection points are evenly spaced ([ADR 0175](0175-assistants-make-what-a-person-can-make.md)), so two elements facing each other rarely have points exactly opposite, and the edge between them gets a small jog. Placing points by hand to fix that is what a person (and an assistant) should not have to do, and stored offsets that differ by author would make an assistant's diagram look unlike a person's.

## Decision
- **Each stored point is tied to its slot by a spring.** An edge with no bend points of its own, between opposite sides (right to left, bottom to top), asks each of its two ends to move half of the misalignment. A point that several edges ask is moved by the average. The move is limited to 10 px along the side.
- **Past the range the edge bends instead.** If the misalignment is more than twice the range, nothing pulls and the edge is drawn between the slots with its routing style's bends.
- **A point moves on its own.** Its neighbours on the side stay where they are. The only coupling is that two points keep at least 6 px between them, keep their order, and stay 4 px off the corners.
- **Nothing is stored.** The slide is computed from the nodes and edges every time, by one pure function (`pointSlides`). The canvas draws the handles at the slid place; SVG and draw.io export, the layout checks, `route_edges` and "Add point here" read the same places. A person's edge with bend points of its own is left alone. A reader of the file format that ignores the slide draws the edge up to 10 px off, which is still attached to the right point.
- **Same for everyone:** a person's and an assistant's diagram behave alike, because the slide depends only on where things are.

## Alternatives considered
- **A chain of springs between the points of a side**, so pulling one moves its neighbours a little. Built and tried alongside this one; it gives a smoother look when neighbours are crowded but moves points nobody asked to move, and its strength is a tuning matter (the first values moved neighbours almost one to one). Dropped for the simpler rule.
- **Stored offsets set by an assistant or a command** ("align a point with another element"): exact, but breaks the rule that assistants make what a person can make.
- **A range setting:** not added; 10 px is a fixed number until someone needs another.

## Consequences
- Elements placed nearly in line give straight edges with no work; elements clearly out of line show their bends.
- Dragging an element makes its edges' ends slide live, since the places are recomputed from the nodes.
- Not covered in the first version: the dashed line shown while dragging a new connection from several selected elements starts at the slot, not the slid place.
