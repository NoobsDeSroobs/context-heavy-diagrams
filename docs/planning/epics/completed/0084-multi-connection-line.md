# 0084: Multi-connection-line + reverse edge direction

## Status
Done — merged to `master` (its code rode in on PR #63, stacked under
`epic/0085-drag-select-mode-setting`: `MultiConnectionLine.tsx`,
`geometry/nodePosition.ts`, the "Reverse direction" edge menu item and the
`connectionLineComponent` wiring are all on `master`). The two "live-test"
task boxes below were never individually re-confirmed, but the feature has been
in `master` and in use since. (Status line corrected 2026-08-30 during the
completed-epics sweep — it had stale "not yet merged" text.)

## Goal
Two separate, small edge-drawing conveniences the user asked for back to back in the same session:
1. React Flow's own "Multi Connection Line" pattern — select several shapes, drag a connection from one, and every selected shape wires to the drop target in one gesture (with a live preview while dragging).
2. A right-click "Reverse direction" action on any edge, swapping which end has the arrowhead.

## Tasks
- [x] Multi-connection-line — design the two open questions (scope, handle choice for non-dragged shapes) with the user — see [ADR 0059](../../../decisions/0059-multi-connection-line.md)
- [x] `onConnect` (`Canvas.tsx`) — wire every selected connectable node to the target, not just the dragged one
- [x] `MultiConnectionLine.tsx` — live drag-time visual, one line per selected node
- [x] `nearestConnectionPointWithCoordinates`/widened `RectLike` (`connectionPoints.ts`) — shared nearest-point resolver for both the live visual and the real edges
- [x] Extract `absolutePosition`/`subtractPosition` into `geometry/nodePosition.ts` (avoids a circular import between `Canvas.tsx` and the new connection-line component)
- [ ] Live-test multi-connection-line (drag from a selected shape among several, both the live preview and the resulting edges) — pending, appended to this epic before the first part was confirmed
- [x] Reverse direction — right-click menu item on any edge, swaps `source`/`target`, `sourceHandle`/`targetHandle`, reverses `data.points` order (so a catmull-rom curve keeps its shape rather than tracing a different one), and swaps `startMarker`/`endMarker` and flips a custom `labelPosition` so both travel with the correct physical end
- [ ] Live-test reverse direction (plain edge, and a catmull-rom edge with bend points and a customized label position) — pending

## Notes
Second task (reverse direction) was appended by the user mid-epic, before the first task had been live-tested — both landed in the same session, same branch, per the user's own instruction to fold it into this epic rather than starting a new one.
