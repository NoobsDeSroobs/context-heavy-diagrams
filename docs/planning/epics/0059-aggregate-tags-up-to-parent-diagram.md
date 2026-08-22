# 0059: Aggregate tags up from a linked child diagram to its parent

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22). Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030/0037/0038/0048/0055/0056/0057/0058 before their own design passes. **Explicitly told to log this for later.**

## Goal
An opt-in or manually-triggered process that rolls tag *values* up from a linked child diagram's own elements to the parent node that links down to it — e.g. if a Component-level diagram has a sub-component tagged `GDPR: Sensitive PII`, the Container-level node linking down to that diagram could reflect that upward, rather than staying whatever it was independently set to.

This is the mirror image of the existing direction: [epic 0035](0035-propagate-required-tags-to-children.md)/[ADR 0024](../../decisions/0024-propagate-required-tags-to-children.md) already propagates the *template* (which tags exist, their allowed values) downward from a parent to its linked children. This new idea moves actual tag *values* upward instead, from children back to the parent — a different, complementary direction, not a variant of the same feature.

## Relevant existing behavior
- Linked diagrams (epic 0009/ADR 0005): `data.linkedDiagram` on a node is a relative path to another `.chd` file, resolved on demand — the C4 chain (Context → Container → Component, [epic 0022](0022-example-diagram-gallery.md)) is the deepest real example of this drill-down structure in the gallery.
- Epic 0035's own downward-propagation feature already has the link-tree-walking infrastructure this would need in reverse — `windows.ts`'s `previewRequiredTagsChildren`/`copyRequiredTagsToChildren` (and their `RequiredTagsWalkResult` shape: `reached`/`external`/`unreachable`) walk the link tree by reading each linked diagram's own file off disk. An upward-aggregation feature would plausibly reuse the same walking mechanism, just reading child *metadata values* instead of writing a template.

## Real open questions (deliberately not resolved here)
- **Aggregation rule per tag** — worst-case/highest-severity wins (e.g. any child with `Sensitive PII` makes the parent `Sensitive PII` too)? Most common value? A union/list of every distinct value found among children? Different tags plausibly want different rules (a severity-style tag like GDPR sensitivity vs. a plain categorical tag like owning team don't aggregate the same way).
- **Which tags aggregate** — all required tags uniformly, or does the user pick per-tag which ones roll up?
- **Scope of "opt-in or manually triggered"** — a one-shot action (like epic 0035's existing "copy to children" button) recomputed on demand, or something that stays live/re-syncs automatically once turned on for a given node? The user's own phrasing ("opt in OR manually triggered") suggests these might be two different mechanisms, not decided between.
- **Depth** — one level down only, or recursing through a multi-level drill-down (Context ← Container ← Component)?
- **Applies per-linked-node, or diagram-wide** — trigger it once per node that happens to have a link, or a single diagram-level action that walks every linked node at once?

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.
