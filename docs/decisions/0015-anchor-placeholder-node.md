# 0015: Anchor placeholder node for unresolved drag-created edges

## Status
Accepted

## Context
[Epic 0014](../planning/epics/0014-drag-edge-to-create-shape.md) (dragging an edge into empty space) originally assumed the dropped edge always creates a `ShapeNode`. User testing corrected that: the type shouldn't be assumed — a small popup (Shape / Container / more later) should let the user choose, and if they dismiss it without choosing, "just leave the edge in space, I can drag it around later."

That last requirement needs *something* for the edge to actually point at. React Flow's data model has no concept of an edge with an unresolved/free-floating end — `source`/`target` are always node ids. So "leave the edge in space" has to mean *some* node exists at the drop point, even before the user has decided what it should become.

## Decision
**A new node type, `AnchorNode`** (`src/renderer/src/nodes/AnchorNode.tsx`, registered as `'anchor'` in `nodeTypes`) — a minimal, small (14px), draggable placeholder with no label/icons/style, reusing the same shared `ConnectionHandles` component `ShapeNode`/`ContainerNode` already use (so it exposes the same `'top'/'right'/'bottom'/'left'` handle ids). Dropping an edge on empty canvas always creates one of these plus the edge; a popup then offers to resolve it into a real `ShapeNode` or `ContainerNode` in place (same id, same connected edge, just a type/size/data change) via `resolveAnchorNode`. Dismissing the popup leaves the anchor as-is — draggable, connected, persisted, exactly like any other node, with no special-cased "floating edge" logic anywhere else in the codebase.

**Schema**: no schema change. `DiagramNode.type` is already a plain string, deliberately not a closed union (see ADR 0004) — `"anchor"` is just a new value for it, following the same "absent/unrecognized type falls back to being treated as `shape`" leniency rule the format already had. Documented in `docs/file-format.md`.

## Alternatives considered
- **Always create a `ShapeNode`, no choice offered** (the epic's original, unrevised plan): rejected per direct user feedback — assuming the type was the wrong default, and offering only Shape with no way to defer the decision doesn't support "leave it in space."
- **A genuinely free-floating edge endpoint** (extend `DiagramEdge` to allow `target: null` plus a raw `{x, y}` position instead of a node id): rejected. This is a deeper, more invasive change — every place that reads an edge's endpoints (rendering, `getIncomers`/`getOutgoers`-style graph queries, hit-testing, drag-to-reposition) would need a second code path for "endpoint has no node." Backing the dangling end with a real (if minimal) node gets dragging, persistence, and selection for free from infrastructure that already exists, at the cost of one small new component.
- **Reuse `ShapeNode` itself with an "unresolved" flag** (e.g. `data.unresolved: true`, rendered differently) instead of a distinct node type: rejected — would mean every place that reads a shape's data (styling, icons, details panel, connection-point editing) needs to special-case "well, unless it's still unresolved," rather than a genuinely separate, much simpler component that just doesn't have those affordances at all.

## Consequences
- `nodeTypes` gains an `anchor` entry (now four: `shape`, `text`, `container`, `anchor`).
- `docs/file-format.md`'s Node `type` field documents `"anchor"` alongside the existing three.
- No way (yet) to resolve an already-dismissed anchor later, e.g. via right-click — not asked for, the user's framing was "drag it around later," not "convert it later." Worth adding if it turns out to matter in practice.
- Flagged, not resolved: conceptual overlap with [epic 0032](../planning/epics/0032-edge-routing-and-waypoints.md) (edge routing/waypoints) — "a point an edge connects to" (`AnchorNode`) and "a point an edge routes through" (a future waypoint) are adjacent ideas. Kept as two separate mechanisms for now; epic 0032's own scoping pass should decide deliberately whether they ever converge, not inherit an accidental answer from this ADR.
- Flagged, not resolved: [ADR 0021](0021-connection-point-removal-blocked.md) (predates this one) blocks removing a connection point that has an edge attached, specifically because there was no way to represent a dangling edge at the time. `AnchorNode` is exactly that missing representation — worth reconsidering whether point removal should re-target the edge to a fresh anchor instead of blocking, next time that interaction is revisited. Not decided here.
- Reused by [epic 0033](../planning/epics/0033-edge-reconnection.md) (edge reconnection): dropping an *existing* edge's endpoint on empty canvas spawns an `AnchorNode` the same way a brand-new edge does here — same placeholder, second trigger path, no new decision needed.
