# 0105: Semantic notation stencil category (choice / parallelism / events)

## Status

Not Started — scoped out of the [epic 0078](completed/0078-bpmn-as-visual-language-basis.md)
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

## Selectable / toggleable stencil sets (2026-09-08, user thoughts — not designed)

The user's current thinking, logged for the design pass, explicitly not resolved:

- Stencils should be **selectable** — not one fixed global palette but **different
  named sets** that can be toggled on/off to show or hide, the same way edge
  direction sets work ([ADR 0081](../../decisions/0081-flippable-edge-direction-sets.md)).
- The driving example is **threat modelling**: a "threat diagram" would layer a
  set of threat-modelling symbols (trust boundaries, threat actors, attack
  vectors, STRIDE markers, …) onto an otherwise ordinary architecture diagram,
  toggled as one unit — turn the set on to see the threat view, off to see the
  plain diagram.
- This has to be **squared with edges**: you still want to route edges to and
  from these symbols (a data flow crossing a trust boundary, an attacker →
  asset arrow). Open tension — if a stencil set can be hidden as a group, what
  happens to edges that connect to a hidden symbol? (Compare `edgeDirectionSets`,
  where every edge exists in every set and only direction swaps; a hide-a-whole-
  group model is a different shape.)
- Relationship to highlights ([ADR 0026](../../decisions/0026-grouped-highlights.md))
  and to the security matrix ([ADR 0055](../../decisions/0055-security-data-lives-on-diagram-elements.md) /
  [ADR 0082](../../decisions/0082-security-data-schema.md)) is unexplored — a
  "threat overlay" toggle sounds adjacent to both. Whether threat-modelling is a
  stencil-set feature, a highlight-group feature, a security-matrix companion
  view, or its own thing is an open question for the design pass, not decided
  here.

This meaningfully widens the epic beyond "a palette category of pre-iconed
Shapes" — a stencil *set* is potentially real `.chd` state (which set is active,
what's in each set), not just a palette convenience. Needs its own design pass
and probably its own ADR; may warrant splitting the simple palette-category part
from the toggleable-sets part.

## Notes

The stencil category is the concrete home for the BPMN-vocabulary decision.
Deliberately light on design here — the interesting choices (category name,
symbol set, icon sourcing, type-swap UX) want their own pass.
