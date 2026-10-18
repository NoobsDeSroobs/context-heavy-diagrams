# 0058: Align/distribute selected elements as one combined action, not two

## Status
Decided and implemented (2026-08-24)

## Context

The user asked for an Edit-menu feature to "align selected options vertically or horizontally, with a field for pixels between each element." Design tools conventionally split this into two separate concepts: **Align** (Left/Center/Right, Top/Middle/Bottom — snaps a shared coordinate, doesn't touch spacing) and **Distribute** (equal gaps along one axis, doesn't touch the cross-axis). The user's own phrasing collapsed both into one action per axis — "align vertically" meaning arrange into a spaced column, not just share an X coordinate — so before building anything, two behaviors needed pinning down that weren't obvious from the request alone:

1. When stacking along one axis, what happens to the other axis (all elements share the leftmost/topmost edge, share a center line, or keep their own current position)?
2. Is the pixel gap measured edge-to-edge (accounting for each element's real size) or as a fixed anchor-to-anchor distance (which could overlap larger elements)?

Asked directly; the user picked "snap to the leftmost/topmost edge" and "edge-to-edge," both flagged as the recommended option in each case.

## Decision

One combined action per axis, not separate align/distribute steps: **"Align Vertically"** stacks the selection into a column — sorted by each element's own current position along that axis (not selection order, so re-running is idempotent), all sharing the leftmost element's left edge, spaced by the entered gap measured edge-to-edge (accounts for each element's actual `width`/`height`, so a 20px gap always leaves 20px of visible space regardless of size mix). **"Align Horizontally"** is the same, arranged as a row.

Surfaced as one new Edit menu item ("Align / Distribute…", disabled under 2 selected elements) opening a small panel — reusing this app's existing fixed-right-side "dock" shell (same family as Preferences/Diagnostics/Layer panels) rather than an anchored popup, since a top-menu click has no natural anchor rect to popup from, unlike property-panel-triggered pickers. One `NumberField` for the gap (session-only state, resets to a default of 20px each time the panel reopens — not persisted as a Preference or Diagram setting, since nothing about the request implied it should stick across sessions) plus the two action buttons.

Geometry is computed in each element's **absolute** canvas position (`absolutePosition`, already used by drag-time snap-to-shape and by reparenting), then converted back to parent-relative before writing — so a selection spanning elements inside different containers (or a mix of contained and top-level) still measures real on-screen gaps correctly, reusing the exact pattern `setContainerForNodes`/the container-drag-reparent handler already establish for the same absolute/relative round-trip.

## Alternatives considered

**Traditional split Align + Distribute, six separate actions** (Left/Center/Right/Top/Middle/Bottom align, plus horizontal/vertical distribute with an "equal gaps" option instead of a fixed pixel value) — closer to Figma/Illustrator convention, but rejected as more UI and more decisions than the user's actual request asked for. Nothing rules this out as later, separate work if a real need for individual-axis alignment (without also respacing) shows up; the scope here is deliberately the combined "arrange into a column/row with this gap" action only.

**Anchor-to-anchor gap** (ignore each element's size, just space top-left corners by N px) — simpler to implement, explicitly rejected by the user in favor of edge-to-edge: with containers, shapes, and text mixed in one selection (routine in this app), anchor-to-anchor spacing would visibly overlap larger elements at small gap values, defeating the point of a "space these apart" tool.

## Consequences

- No `.chd` schema change — this only ever writes ordinary `position` updates to existing nodes, the same field every drag already mutates. Nothing new to version or migrate.
- `React Flow`'s own runtime-measured `node.width`/`node.height` (not `data.size`) is the size source, matching `alignment.ts`'s existing drag-time snap guides — correct for every node type including `'line'` (whose true size is its point bounding box, already reflected in its measured width/height once rendered), with no special-casing needed per type.
- Full undo support for free: one `pushSnapshot()` per click, same convention as every other bulk edit (`duplicateSelected`, cut/paste).
