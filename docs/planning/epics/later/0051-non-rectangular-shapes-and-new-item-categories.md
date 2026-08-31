# 0051: Non-rectangular shapes and a large-icon category

## Status
Not Started — not yet scoped. Raised by the user as a design idea for later, explicitly not to be designed now. **Split 2026-08-22**: the freeform/bendable-line idea originally item 2 here was pulled out into its own epic, [0064](../completed/0064-simple-curved-freeform-line.md), since a simple version of it is actually needed soon (trust-boundary lines for threat-modeling diagrams) while the two items remaining here are not — see that epic for the reasoning. This epic is deliberately smaller now than its original scope; the remainder stays logged, not scheduled.

## Goal
Two related extensions to the existing Shape / Container / Text split (item palette, `ItemPalette.tsx`):

1. **Shape variety** — today shapes (and containers) are only rectangles. Add other shapes (circle, diamond, etc.) as options, both for shapes and containers.
2. **Iconography category** — a new top-level category for large, icon-only nodes (a person, a computer, etc.), distinct from today's shapes-with-an-optional-small-icon.

## The hard constraint (explicitly called out by the user, not optional)
Whatever shape variety looks like, it must keep working with icon annotation the way it does today (`ShapeNode.tsx`) — the user relies on icons on shapes to convey meaning (manual vs. automatic, server vs. human, etc.), and does not want more shape freedom to come at the cost of that. This isn't a constraint scoped to this epic alone: it's a general, standing product requirement across every shape variant, present or future — see [ADR 0031](../../../decisions/0031-icon-annotation-is-a-standing-requirement.md). Any design pass on this epic needs to treat "shapes carry an icon" as a hard requirement to preserve, not a detail to figure out later.

## Relationship to existing epics (not resolved here)
- **Iconography category vs. [epic 0019](../0019-installable-icon-packs.md)** — 0019 (installable vendor icon packs, currently blocked on licensing) is about *where icons come from*. This epic's "large icon nodes" is about a *new item type* that displays an icon as the whole node rather than a small annotation on a shape. Different concerns, but they'd likely share the same icon asset pipeline once both exist.
- **Shape variety vs. containers** — the user explicitly mentioned "shape, or container" for the variety ask, so a design pass shouldn't assume this is shapes-only.
- **Not on BPMN's path.** The 2026-08-31 BPMN discussion ([epic 0078](../0078-bpmn-as-visual-language-basis.md) / [ADR 0080](../../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md)) considered using non-rectangular shapes to deliver BPMN gateways/events and **rejected it** — shapes stay rectangular, icon + label convey concept type ([ADR 0031](../../../decisions/0031-icon-annotation-is-a-standing-requirement.md)). This epic stays an independent parked idea; nothing depends on it.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../../PROGRESS.md)) — flagged here so it isn't lost, not because it's next up. The user was explicit this is "a design discussion to be had for later," so this file deliberately stops at capturing the idea rather than proposing a design. See [epic 0064](../completed/0064-simple-curved-freeform-line.md) for the freeform-line piece that used to live here.
