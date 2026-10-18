# 0098: Multi-select resize scales every selected node by the same percentage, each anchored like the dragged one

## Status
Accepted (2026-09-23); implemented and live-tested.

## Context
Every selected node already shows its own resize handles, but React Flow resizes only the one being dragged, so resizing a selection meant one node at a time. The first user request asked for the whole selection to resize together.

## Decision
When the dragged node is part of a selection, every *other* selected, unlocked shape/container/text node is resized too:

- **Percentage, not delta.** The dragged node's new size ÷ its size at gesture start gives a factor per axis, applied to each member's own start size. A small shape and a large one keep their proportions instead of the small one being distorted by a fixed +50px.
- **Always against gesture-start sizes**, never incrementally — no rounding drift, and a member clamped at its own minimum size recovers when the pointer comes back.
- **In place, no layout reflow.** Positions are not scaled. Each member keeps the *same edge fixed as the dragged node*: a right/bottom handle keeps left/top edges; a left/top handle keeps right/bottom edges (so the position shifts to compensate). Everything grows the direction the pointer pulls.
- Only the axis being dragged scales (edge handles change one axis; corner handles both, independently — no aspect lock).
- Each member clamps to its own type minimum. Locked nodes and nodes without a resizer (lines) are skipped.
- Undo: no new snapshot — the dragged node's own resize change already opens the gesture's one snapshot, and member writes go straight to `setNodes`.

Implementation: pure `scaleGroupMembers` (`groupResize.ts`, unit-tested); `groupResize.start/resize/end` in `Canvas.tsx` exposed through `DiagramContext` and called from each node's `NodeResizer` `onResizeStart/onResize/onResizeEnd`.

## Alternatives considered
- **Same pixel delta for all** — distorts unequal shapes; rejected in favour of percentage (the user's own proposal).
- **Scale positions too** (resize the selection as a rigid group) — a different feature ("scale layout"); the user explicitly wanted the resize to stay local.
- **Always anchor top-left** — simpler, but a left/top handle drag would grow the other nodes the opposite way to the pointer.
- **Centre-anchored** — each node grows around its own centre; feels detached from the handle being held.

## Known limits
- A selected container's selected children scale in place, so they can end up outside their container's bounds; not clamped.
- Rotated text nodes inherit the existing `NodeResizer` rotation limitation.

## Addendum (2026-09-24): which edge is fixed is inferred from the dragged node's box, not React Flow's `direction`
The first cut read `direction` from `onResize`, assuming it named the grabbed handle. It actually says grow (+1) vs shrink (-1) for the size change, so reversing the pointer mid-drag flipped the anchor side and made the other nodes jump. `scaleGroupMembers` now takes the dragged node's live box: if its `x`/`y` moved relative to gesture start, a left/top handle is being dragged (right/bottom edge fixed); otherwise the left/top edge is fixed.
