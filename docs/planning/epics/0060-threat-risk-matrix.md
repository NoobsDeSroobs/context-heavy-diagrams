# 0060: Threat/risk matrix (security view) — possibly its own program, not this app

## Status
Not Started — not yet scoped, not even decided whether this belongs in this app at all. Raised by the user (2026-08-22). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055/0056/0057/0058/0059 before their own design passes. **Explicitly told to log this, nothing more.**

## Goal
A threat/risk matrix: services or components (whichever granularity, hierarchical the way this app's own diagrams already are) listed along one axis, relevant threats listed along the other. Each cell holds two values — probability and consequence — for that specific threat against that specific component/service. Row and column edges show aggregate scores (a vulnerability score per service, a threat score per threat), and the bottom-right corner shows one total security score for the whole matrix.

## The open question this epic is really about
**Is this even part of this application?** The user's own framing, explicitly unresolved: it could be a new view type inside this tool (a lot of the underlying machinery already exists — see below), or it could be a deliberately separate program entirely, specifically to avoid bloating this app with a feature that's substantially different in kind from diagramming. Nothing about scope, architecture, or even *whether to build this here* should be assumed from this doc — this is a placeholder for the idea, not a commitment to build it as part of this project.

## Relevant existing behavior, if it ever does end up here
- This is a much more fully-developed version of an entry already sitting in [epic 0022](0022-example-diagram-gallery.md)'s own backlog: "Risk register / risk heat map — same caveats as the RACI matrix" (a flagged cross-cutting limits-test — this app is a canvas, not a spreadsheet, and grid/tabular content has no row/column primitive to lean on).
- Hierarchy: services/components nested to whatever granularity is wanted maps naturally onto this app's existing containers (epic 0004) and/or linked-diagram drill-down (epic 0009) — same structural pattern the C4 chain already demonstrates.
- Per-cell values (probability/consequence) and aggregate scores are conceptually close to this app's tag/metadata system (epic 0034/ADR 0022) and highlight-based visual overlays (epic 0026/0036) — a threat matrix's "color the cell by risk level" instinct is exactly what highlights already do for ordinary diagram elements.
- The aggregation (row/column edge totals, one grand total) is the same *shape* of idea as [epic 0059](0059-aggregate-tags-up-to-parent-diagram.md) (rolling values up a hierarchy), just for numeric scores instead of categorical tag values.

## Notes
Not scheduled into any current batch, and not even confirmed to belong in this project's backlog at all — flagged here purely so the idea isn't lost while the user decides (at some later point) whether it's a feature here or a separate tool entirely.
