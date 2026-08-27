# 0059: Multi-connection-line, full live visual over result-only

## Status
Decided and implemented (2026-08-24)

## Context

The user asked for React Flow's own documented "Multi Connection Line" pattern ([reactflow.dev/examples/edges/multi-connection-line](https://reactflow.dev/examples/edges/multi-connection-line)): select several shapes, drag a connection from one of them, and every selected shape gets wired to the drop target in one gesture — not a built-in toggle, a pattern xyflow's own docs show how to build via `onConnect` plus a custom `connectionLineComponent`.

Two real decisions needed settling before building, both asked of the user directly:

1. **Scope** — build only the end result (drag normally, extra edges appear on release), or also the live drag-time visual (a line from every selected shape converging on the cursor while still dragging)? The user's own framing, given the earlier edge/line-unification attempt that was built twice and discarded: build the full visual *if* it isn't disproportionately costly, otherwise take the simpler result-only version — explicitly delegating that cost judgment.
2. **Handle choice for the non-dragged shapes** — xyflow's own plain example doesn't specify a handle at all for the extra connections (it has no concept of multiple named connection points per side). This app does (custom connection points per side), so leaving it unspecified isn't a neutral no-op here the way it is in the original example.

## Decision

**Built the full live visual, not just the result.** Assessed as low-to-moderate complexity, not a repeat of the line/edge-unification trap: that attempt failed because it fought React Flow's structural requirement that every edge endpoint be a real node. This feature uses `onConnect` and `connectionLineComponent` exactly as xyflow's own documentation designed them to be used — no structural fight, purely additive rendering during an already-supported interaction.

**`onConnect`** (`Canvas.tsx`): when the drag completes, every node that is either the actual drag origin *or* currently selected (and of a connectable type — `shape`/`container`/`anchor`; `text`/`line` have no handles at all) gets its own edge to the target. The dragged node's own edge keeps the exact handle the user dropped onto; every other selected node's handle is resolved via **"whichever side faces the target"** (the user's chosen option over "same side as the dragged node") — `nearestConnectionPointId` (`connectionPoints.ts`), reusing the same nearest-side geometry already built for right-click "add connection point here," so each additional edge looks deliberate regardless of how that shape happens to sit relative to the target.

**`MultiConnectionLine.tsx`** (new `connectionLineComponent`): providing a custom component replaces React Flow's default connection-line rendering entirely, so it draws React Flow's own default dashed line (same `react-flow__connection-path` className, so it inherits the same CSS with no new styling) from the actual drag origin, plus one more identical line per other selected connectable node — each one starting from whichever of that node's own connection points is nearest the *current cursor position* (`nearestConnectionPointWithCoordinates`, the coordinate-returning sibling of the id-only resolver `onConnect` uses), so the live preview always points at exactly the handle the real edge will use once released.

## Alternatives considered

**Result-only (no custom connection-line visual)** — the explicitly-offered fallback if the visual proved costly. Not needed: the visual reuses documented extension points with no architectural resistance, unlike the line/edge-unification attempt this was being compared against.

**Same side as the dragged-from node**, for the non-dragged shapes' handles — simpler (no per-shape geometry), rejected by the user: shapes in a real diagram aren't laid out symmetrically around a target, so "always the right side" would routinely point away from the target for shapes actually positioned elsewhere.

## Consequences

- `absolutePosition`/`subtractPosition` moved out of `Canvas.tsx` into a new `geometry/nodePosition.ts` — `MultiConnectionLine.tsx` needs the same parent-relative-to-absolute conversion `Canvas.tsx` already had, and importing it directly from `Canvas.tsx` would be a genuine circular import (`Canvas.tsx` renders `MultiConnectionLine` as its `connectionLineComponent`), not just an awkward one. Pure extraction, no behavior change.
- `nearestConnectionPoint` (`connectionPoints.ts`) widened its `rect` parameter from `DOMRect` to a small structural `RectLike` interface ({left, top, width, height}) — a real `DOMRect` still satisfies it, so no existing caller changed, but it lets both new resolvers build a rect from a node's absolute canvas position without needing an actual DOM measurement.
- No `.chd` schema change — every edge this creates is an ordinary edge through the existing `addEdge` path.
