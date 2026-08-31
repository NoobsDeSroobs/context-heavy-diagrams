# 0105: Semantic notation stencil category (choice / parallelism / events)

## Status

Not Started — scoped out of the [epic 0078](0078-bpmn-as-visual-language-basis.md)
BPMN discussion (2026-08-31), see [ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md).
Not blocked on anything — a stencil is a plain rectangular Shape pre-seeded
with an icon + label.

## Goal

A new item-palette category of ready-to-drag semantic symbols — the BPMN-derived
vocabulary (a choice/gateway, parallelism, events, …) delivered as
pre-configured **rectangular** Shapes rather than a metamodel or new outlines.
Someone who knows BPMN builds a recognisably-BPMN-flavoured diagram; someone who
doesn't gets ordinary labelled-and-iconed shapes. Nothing is enforced or
validated ([ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md)).

## What the user specified (2026-08-31)

- **One category**, named to encapsulate all the symbol types (parallelism,
  choice, events, …) — not one palette entry per type at the top level.
- Each symbol is **individually named and findable** in a searchable list/
  dropdown.
- The specific type is **changed via right-click** on a placed symbol (e.g.
  swap "Decision" ↔ "Parallel"), the same way other element facets are edited.
- **Neutral labels** in the list ("Decision", "Parallel split", "Trigger"…);
  **BPMN terms as search keywords** ("gateway", "exclusive gateway", "XOR",
  "BPMN start event", …) — picker-layer only ([ADR 0010](../../decisions/0010-named-searchable-style-presets.md)),
  the tool's own vocabulary stays notation-neutral.
- **Shapes stay rectangular** — each stencil maps to an ordinary Shape with a
  distinguishing icon + a default label, not a non-rectangular outline
  ([ADR 0031](../../decisions/0031-icon-annotation-is-a-standing-requirement.md)).

## Open questions (not yet designed)

- **Category name** — "Notation", "Flow symbols", "Process symbols",
  "Semantics"? Needs to read well next to Shape / Container / Text / Line.
- **Which symbols ship** — at minimum: exclusive choice, parallel, inclusive
  choice; start event, end event, intermediate/message/timer event. How many
  event sub-types before it's bloat?
- **Is a stencil a distinct thing in the `.chd`, or just a Shape?** Leaning:
  just a Shape (style + icon + a default label) with no new schema — the
  palette is a convenience, the file only ever sees Shapes. Confirm there's a
  clean way to seed a Shape's icon slot + label from a palette item.
- **Right-click type-swap** — swapping keeps size/position/label edits/edges,
  and just changes the icon (and maybe re-suggests the default label if the
  user hasn't customised it). Interaction with the existing icon controls in
  the property panel.
- **Icons** — reuse the built-in Tabler set, or does this need dedicated
  glyphs (the BPMN gateway marks X / + / O, an event's thin/thick/double ring
  aren't obviously in Tabler)? Ties into [epic 0019](0019-installable-icon-packs.md)
  and the custom-icon pipeline.

## Notes

The stencil category is the concrete home for the BPMN-vocabulary decision.
Deliberately light on design here — the interesting choices (category name,
symbol set, icon sourcing, type-swap UX) want their own pass.
