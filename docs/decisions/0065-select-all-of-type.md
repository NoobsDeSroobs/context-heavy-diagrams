# 0065: Select all of type — trigger and scope

## Status
Decided and implemented (2026-08-27).

## Context

[Epic 0082](../planning/epics/0082-select-all-of-type.md) left two real questions open: where the trigger lives, and how granular "all of a type" should be. Raised by the user while testing drag-to-select on a large diagram, wanting a fast way to bulk-select every edge (or every shape, etc.) for a style change, instead of shift-clicking each one.

## Decision

**Trigger: a "Select all X" item in each type's own right-click context menu**, not a top menu-bar item. `MenuBar` has no submenu support yet (a real gap, already noted independently in [epic 0091](../planning/epics/0091-recent-diagrams-and-last-opened-path.md)'s own doc), which rules out a clean `Edit → Select All → Shapes/Containers/.../Edges` submenu without first building that infrastructure. A per-type context-menu entry needs no new UI surface at all — every node type and edges already have their own right-click menu — and it's exactly where the user's own framing pointed ("select all edges").

**Scope: whole-type only, no finer filtering.** The epic's own open question about narrower scoping (e.g. "all edges with this routing style") is left for later if it turns out to matter — the base case (every shape, every edge, etc.) covers the motivating use case (a bulk style change across everything of one kind).

**Lines are the one exception to "menu item on the element itself."** Right-clicking a `LineNode`'s own body doesn't open a menu at all today — it immediately adds a bend point (`onPathContextMenu`), an established, presumably-valued shortcut. Adding a menu there would change that existing behavior. Instead, "Select all lines" lives in the *per-point* context menu (gravity presets, "Remove point") — still a real right-click menu on a line element, just reached via one of its points rather than its body.

## Implementation

`Canvas.tsx`'s new `selectAllOfType(type)` replaces the current selection outright (every element of the given type selected, everything else deselected) — matches `selectAll`/`deselectAll`'s existing all-or-nothing shape, and the "instead of shift-clicking individually" framing implies a fresh selection, not an additive one. Threaded through `DiagramContext` (same convention as `attachContainedNodes`) so each node/edge component's own context-menu builder can call it without Canvas.tsx constructing every menu itself.

One implementation wrinkle: `selectAllOfType` had to be declared *before* `onEdgeContextMenu` in `Canvas.tsx`, not alongside `selectAll`/`deselectAll` further down (where it was first placed) — a `useCallback`'s dependency array is evaluated immediately at render time, unlike the callback body itself, so referencing a not-yet-declared `const` in a dependency array is a genuine temporal-dead-zone error, not just a hypothetical one. TypeScript's `noUnusedLocals`-adjacent checks caught this immediately (`TS2448`/`TS2454`).

## Alternatives considered

- **Top menu-bar item under Edit** — rejected for now; blocked on `MenuBar` submenu support that doesn't exist yet, and building that just for this would be a much larger lift than the feature itself warrants.
- **Finer scope filtering** (by routing style, by tag, etc.) — rejected for V1, logged as a possible future refinement in the epic doc, not designed.
- **A menu on right-clicking a line's own body** — rejected to avoid changing the existing add-point-on-right-click behavior there.

## Consequences

- No `.chd` schema change — this is a pure selection/UI action, no persisted state.
- If `MenuBar` submenus are ever built (epic 0091's bigger half needs them too), a top-level "Select All" submenu could be added alongside the context-menu entries rather than replacing them — both are cheap to keep.
