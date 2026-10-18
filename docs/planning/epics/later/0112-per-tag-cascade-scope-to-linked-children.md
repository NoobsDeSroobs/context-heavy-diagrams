# 0112: Per-tag control over whether a required tag applies at linked-child depth

## Status

Not Started — parked. Raised by the user 2026-09-05 while reviewing the new
layered Meridian Rail landscape example (epic 0022): "The metadata should
still be made available because some things are relevant at all layers.
GDPR is a classic such example. NIS2 is an example where it makes less
sense because the entire service or business domain are either all under
or outside NIS2 together. Some tags should be shared, and some tags should
be entirely unique to each layer."

## Goal

Let a required tag declare whether it's meaningful to re-ask at every depth
of a linked-diagram drill-down, or whether it's a property of the
service/domain as a whole that shouldn't need re-declaring on every child
shape. Concretely, in the new `meridian-rail-landscape-layered` example:
`gdpr` genuinely varies component-by-component within one service's own
AWS deployment (a load balancer doesn't store personal data, the database
behind it does) — worth a real per-shape value at every layer. `nis2`,
`owningTeam`, `businessDomain`, and `serviceState` are constant for the
whole service regardless of which internal component you're looking at —
re-asking them at the infra layer is either busywork or, worse, a place
values can quietly drift out of sync with the service-level tag they were
supposed to match.

## Relevant existing behavior (this is none of it — genuinely new)

- [ADR 0024](../../completed-epics.md#0024-multi-diagram-tabs-or-windows) /
  [epic 0035](../../completed-epics.md#0035-propagate-required-tags-to-linked-children)
  already pushes a `requiredTags` template *down* the link tree, but
  uniformly — the whole template, merged into every child, no per-tag
  opt-out. This epic is about a tag declaring itself "doesn't apply below
  this depth" (or "applies but should stay in sync"), not about how the
  copy operation itself works.
- [epic 0059](0059-aggregate-tags-up-to-parent-diagram.md) is the mirror
  direction — rolling *values* up from children to a parent. Different
  problem: that's about summarizing child data at the parent; this one is
  about *not duplicating* parent-level facts down into children in the
  first place.

## Possible directions (not chosen)

- **A `scope` field on `RequiredTagDefinition`** (e.g. `"perElement"` vs.
  `"perDiagram"` vs. `"inherited"`) — a diagram-scoped tag shows once,
  diagram-level (like `metadata` already works at the top-level object,
  see field-reference.md), rather than being stamped on every shape.
- **Read-only inherited display** — a linked child diagram could show its
  parent's value for a given tag as context (e.g. in the property panel)
  without it being separately stored/editable metadata on every one of the
  child's own shapes — avoids the "which copy is authoritative" drift risk
  entirely, but needs the child to actually know which shape in the parent
  linked down to it (not currently tracked either direction — links only
  point downward, per ADR 0005).
- **Do nothing structural — just an authoring convention**: only declare
  the tags in a child diagram's own `requiredTags` that actually vary
  there, and explain the omission in the diagram's blurb/details, same as
  `aws-deployment.chd` does today. Zero app changes, but leaves the
  "shouldn't drift" risk unaddressed — nothing stops a child's own copy of
  a tag from silently disagreeing with its parent's.

## Notes

Concretely demonstrated in `examples/gallery/landscape/meridian-rail-landscape-layered/ticketing-and-booking/aws-deployment.chd`
(2026-09-05): its `requiredTags` deliberately declares only `gdpr`, not the
other four tags `ticketing-and-booking.chd` carries — today that's just the
authoring-convention option above, done by hand, not by any app mechanism.
