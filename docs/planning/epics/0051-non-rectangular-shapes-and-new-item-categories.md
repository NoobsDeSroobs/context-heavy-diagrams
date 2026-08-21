# 0051: Non-rectangular shapes, freeform lines, and a large-icon category

## Status
Not Started — not yet scoped. Raised by the user as a design idea for later, explicitly not to be designed now.

## Goal
Three related extensions to the existing Shape / Container / Text split (item palette, `ItemPalette.tsx`):

1. **Shape variety** — today shapes (and containers) are only rectangles. Add other shapes (circle, diamond, etc.) as options, both for shapes and containers.
2. **Freeform, bendable lines** — a new top-level category distinct from edges: a line that can be placed and bent freely rather than one that connects two node endpoints. Not yet clear whether this is really "an edge with no required endpoints" or a genuinely separate item type.
3. **Iconography category** — a new top-level category for large, icon-only nodes (a person, a computer, etc.), distinct from today's shapes-with-an-optional-small-icon.

## The hard constraint (explicitly called out by the user, not optional)
Whatever shape variety looks like, it must keep working with icon annotation the way it does today (`ShapeNode.tsx`) — the user relies on icons on shapes to convey meaning (manual vs. automatic, server vs. human, etc.), and does not want more shape freedom to come at the cost of that. This isn't a constraint scoped to this epic alone: it's a general, standing product requirement across every shape variant, present or future — see [ADR 0031](../../decisions/0031-icon-annotation-is-a-standing-requirement.md). Any design pass on this epic needs to treat "shapes carry an icon" as a hard requirement to preserve, not a detail to figure out later.

## Relationship to existing epics (not resolved here)
- **Freeform lines vs. [epic 0032](0032-edge-routing-and-waypoints.md)** — 0032 is about *edges* (which already connect two nodes) gaining manual waypoints/bias offsets. The freeform line idea here sounds different — a line that isn't necessarily anchored to two node endpoints at all — but the overlap is real enough that whoever scopes either epic should check the other first; they may turn out to be the same feature, or 0032's waypoint mechanism might be exactly what a freeform line needs internally.
- **Iconography category vs. [epic 0019](0019-installable-icon-packs.md)** — 0019 (installable vendor icon packs, currently blocked on licensing) is about *where icons come from*. This epic's "large icon nodes" is about a *new item type* that displays an icon as the whole node rather than a small annotation on a shape. Different concerns, but they'd likely share the same icon asset pipeline once both exist.
- **Shape variety vs. containers** — the user explicitly mentioned "shape, or container" for the variety ask, so a design pass shouldn't assume this is shapes-only.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up. The user was explicit this is "a design discussion to be had for later," so this file deliberately stops at capturing the idea rather than proposing a design.
