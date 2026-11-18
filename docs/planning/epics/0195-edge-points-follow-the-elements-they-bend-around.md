# 0195: Edge points follow the elements they bend around

## Status
Case 1 built (2026-11-18, [ADR 0189](../../decisions/0189-edge-points-move-with-elements-that-move-together.md)); case 2 (the nearest-end rule) and its key are open.

## Goal
When elements move, the bend points of the edges between them should move too, so a route that went around an element still goes around it. Today a manual point is an absolute canvas position and stays put.

## The problem
`points` on an edge are absolute coordinates for catmull-rom, step and smooth step routing ([file-format.md](../../file-format.md)). As far as the code shows, moving a node never touches them. Three cases, in order of how clear they are:

1. **Both ends move by the same amount.** Dragging a container, or a selection, with an edge between two of the things moved. The ends go along; the points do not, so a loop that went round the element is now cut through it. Plainly wrong, and the one that was noticed.
2. **One end moves, the other stays.** Dragging one entity of an edge with bend points. Here "correct" is a judgement: a point that routes around the moved entity should follow it, one that routes around the other end should stay.
3. **Neither end moves but a third element does.** Out of scope: an edge that avoids something that is not its own end is auto-routing, a different feature.

## Decided so far (2026-11-18)
- **Case 1 is built first and needs no key:** when both ends of an edge move by the same amount, for any reason (drag, container drag, nudge, align, assistant move), its points move with them. A is the default behaviour.
- **Case 2 gets a rule of its own, proposed by the maintainer ("nearest end"):** for each point, find which of the edge's two ends it is closest to; when that end moves, the point gets the same translation, and a point nearer the end that stays is left alone. A 10 px detour around the moved element stays 10 px from its wall; a point nearer the other element stays put. This is option B with a hard assignment instead of a blend. Whether it is worth building, and which key, is still open; the key would only matter for a one-end move.

## Options
- **A. Move the points with the elements when both ends move by the same delta.** Computed at drag time, stored as absolute points as now. No format change, no heuristic, no new data. Covers case 1 and nothing else. Weakness: a diagram moved one element at a time gets no help.
- **B. Weight by distance to the two ends (rubber band).** At drag time, each point moves by a blend of the two ends' movements, by how near it is to each (along the path, or straight-line). Still stored absolute, no format change. Covers case 2 for the common shape (a few points between two ends). Weakness: a blend is a guess; a point near the middle of a long edge ends up half-moved, which can look worse than either all or nothing, and a step edge's corners stop being right angles unless the result is snapped back to the orthogonal rules.
- **C. Anchor each point to an element.** Store `anchor` (a node id) and an offset on each point; the point is drawn at the anchor's position plus the offset. "The element closest to the point" is picked when the point is made or dragged, or set by the person. Exact, and survives any move, resize and undo. Weakness: a file format change (additive, so a MINOR bump, [CLAUDE.md](../../../CLAUDE.md)), a new idea in the format that assistants and the extension must also write, and questions about what the offset is relative to (the element's top left, its centre, a fraction of its size when it is resized), what happens when the anchor is deleted or moved into another container, and whether a point near no element has an anchor at all.
- **D. Store points relative to the two ends** (a fraction along the line between them and a perpendicular distance). Moves and scales with both ends and is the simplest format. Weakness: rotates and stretches a detour that was meant to be a fixed size, and still has nothing to say about a point that belongs to one end.

Devil's advocate: A is small and certain and might be the whole answer, since the loop-in-a-container case is A. B and C buy case 2 at the price of guesses or a new format. It is worth asking how often case 2 happens, and whether the person would rather just see the points stay and fix them by hand than have them guessed.

## The key
The maintainer suggests a key that decides between following and staying put during a move. Things to settle:
- **Which is the default.** Following is what most people expect of a container move; staying put is today's behaviour and what a person who has placed a point on purpose may rely on.
- **Which key.** Alt is taken by drag-to-duplicate, Ctrl/Cmd by link navigation, Shift by selection and probably by axis locks; check before choosing. It has to be readable at the moment of the drag and not needed to make the common case work.
- **Whether it is a key at all**, or a per-edge or per-diagram setting, or an action afterwards ("fix the points where they are"). A key leaves no trace in the file, so a reader of the diagram cannot tell which was used.

## Questions to settle
- Containers: points of an edge between two children of one container are in absolute coordinates, the children's positions are relative to the container. Moving the container is case 1; an edge whose ends are in different containers, with only one container moved, is case 2.
- Resize and group resize: do points scale with the elements? (They do not today.)
- Undo: the move and the points it carried must be one step.
- Locked elements, the compare window and the review of changes since the last save: a point that moved with an element is a change to the edge, so it should not read as an edited edge when only a container moved. See how `changesSinceSave` and the compare fields treat points now.
- Assistants: `set_edge_points` writes absolute points; the extension and the command line are unaffected by A and B, and need to learn the anchor under C ([ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md) applies to any new writer).
- Interaction with springy points ([ADR 0176](../../decisions/0176-connection-points-slide-a-little-to-straighten-edges.md)) and automatic attachment: the ends already follow; check that moving the points does not fight a slide of the end.

## Tasks
- [x] Discuss and decide case 1: A as the default, no key; recorded in ADR 0189
- [x] Cover every way of moving: the editor watches node positions (`useCarryEdgePoints`) so drag, container drag, multi-select, arrow keys, align and a typed position all count; the assistants' `move` uses the same rule (`shared/edges/carryPoints.ts`)
- [x] Case 1 in one undo step, with tests (pure rule, hook, assistant `move`) and a live check of a container drag, undo and redo
- [ ] Decide case 2 (the nearest-end rule) and the key, record it in an ADR
- [ ] The chosen answer to case 2, if any
- [ ] The key, or whatever replaces it, and its mention in the shortcuts dialog
- [x] Example `examples/edge-points-follow.chd` ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)); the file format is unchanged, its doc has a note

## Notes
Raised on 2026-11-18 while moving a container with a looped step edge inside it. Related: the completed entry for 0188 (springy points and automatic attachment), where the ends already follow the elements.
