# 0105: Semantic notation stencil category (choice / parallelism / events)

## Status

In Progress — the first slice is built on the branch `epic/0187-hide-react-flow-label` (ADR [0180](../../decisions/0180-stencils-are-light-elements-for-events-and-verbs.md)); the pull request waits for a fuller set. Scoped out of the [epic 0078](../completed-epics.md#0078-bpmn-as-a-basis-for-this-apps-visual-language)
BPMN discussion (2026-08-31), see [ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md).
Not blocked on anything. (The first plan, a plain Shape pre-seeded with an icon and a label,
was replaced by its own light node type, see "Decided".)

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
  (decided in [ADR 0180](../../decisions/0180-stencils-are-light-elements-for-events-and-verbs.md)).

## Decided (the maintainer, 2026-11-15)

- **What is a stencil:** events and verbs (what happens, and how the flow behaves: a step, a decision, a split or join, a start, an end, a timer). **Nouns and concepts are entities** (a User, a service, a node, an ArchiMate element), already possible with an icon. A stencil is never a thing in the system.
- **Stencils need no context:** no notes, tags, links, metadata or security data. That is also what keeps them from replacing entities: whatever needs context is an entity.
- **Design pass (2026-11-15):** a stencil has a properties panel (its kind, label, number of connection points, look, size and place, and its one link; none of the notes, tags, metadata or references sections); it sits inside a container as a child, like an entity; **one link to another `.chd` file is allowed**, nothing else of the context an entity has; **the legend shows what each kind in the diagram means**, so nobody has to know the marks (derived from the kinds present; shown by default, with a switch in the app only, for the session, nothing in the file, to hide it when it clutters; settled once there are example diagrams); highlights and tags do not apply. **Shapes:** a start or end is a circle, a gateway a square with its mark, a step a rounded rectangle (the frame stays a rectangle for resize, containment and connection points). **Size of the first release:** Step, Decision, Parallel split/join, Start and End are the first slice, but the pull request waits for a fuller set. **Search and review:** a stencil is found by id, label and kind (its neutral name and BPMN terms), and its kind and link show in a review of changes as meaning, not look. **Leaning, not settled:** each kind has a built-in default colour, used unless the element has its own fill (see the design notes).
- **Vector first.** The built-in stencil marks (a gateway's ×, + and ○, an event's ring, a step's corner) are drawn as SVG by the app, with no raster files in the base, so they follow the theme and stay sharp at any zoom. A person may install raster elements if they want them; that is an extension of [0183](0183-installable-icon-packs.md), which today takes SVG only (to decide there).
- **Swim lanes need no new element.** A container is a lane, and a stencil's lane is its parent. What is missing is the functional half: seeing which edges cross lanes (a hand-off), which is [0088](0088-cross-container-edge-detection.md) and is worth re-reading with this one.
- **Licence of the notation (read 2026-11-15, [ScanCode's entry](https://scancode-licensedb.aboutcode.org/omg-bpmn-2.0.html) for the BPMN 2.0 specification's terms; not legal advice).** They are the terms of the specification document, not of icons. They say nobody infringes the holders' copyright by using the specification or conforming software to it, and allow software based on it. The conditions are about copies of the document: its notice with every copy, no posting on a network, no modifying, no reselling. So: draw our own marks, copy nothing from the specification (text, figures or the XSD) into the repository, say "based on BPMN 2.0" and never "compliant" (only a full match to the compliance points may claim that), and credit OMG in the notices anyway. The terms are not an open-source licence; the Apache Software Foundation has had the question open with OMG since late 2024 (LEGAL-690). Check the current version of the specification (2.0.2) before release.
- **A closed, built-in list:** no stencils made or installed by a person, so the category cannot grow nouns. [0183](0183-installable-icon-packs.md) gives entities icons; it does not add stencils.

## Tasks

- [x] ADR 0180; the `stencil` node type with `data.kind`; the kinds table (step, decision, parallel, start, end) with shapes, marks and default colours; `docs/file-format.md`
- [x] The canvas node, the palette entry with a kind list and filter, the property panel (kind, look, size, connection points), the kind changed from the property panel (the right-click menu has no kind list: a flat list of thirteen is not usable), one link, inside containers
- [x] The legend rows for the kinds in use with a session-only switch; search by kind and BPMN terms; the review of changes; SVG, PNG and draw.io export; conformance leaves them out
- [x] Example `examples/process-flow-stencils.chd` with a drill-down diagram
- [x] Tried in the app on real flows by the maintainer (2026-11-17; the build sessions could not run it): label position when an edge leaves the bottom of a small shape, the colours in the light theme, the palette list
- [x] The palette entry's name: Behaviour; the step is a rectangle with an arrow band (no direction property: the edges give it)
- [x] More kinds before the pull request: 13 now, with ids that say what the kind is, general first (`step-user`, `event-timer`); marks drawn from one shared table; later candidates (start and end variants with a mark, boundary events, data objects, pools with message flows, annotations) wait for real flows to need them
- [x] The assistant tools (`edit_diagram`, `chd edit`, the MCP server) and the build guide: `add_behaviour`, `set_kind`, `set_label_position`, the kind and label position and the crossings in `inspect_diagram`, the skill's guides ([ADR 0187](../../decisions/0187-assistants-build-behaviours-and-read-crossings.md))
- [x] The lane hand-off check ([0088](0088-cross-container-edge-detection.md))
- Spun out of this epic: where a label goes ([0189](0189-where-a-label-goes.md)) and repetition and parallel policy ([0190](0190-behaviour-parameters-repetition-and-parallel-policy.md))
- [ ] The BPMN specification's current version (2.0.2) and its terms, before release

## Open questions (not yet designed)

- **Category name** — "Notation", "Flow symbols", "Process symbols",
  "Semantics"? Needs to read well next to Shape / Container / Text / Line.
- **Which symbols ship** — at minimum: exclusive choice, parallel, inclusive
  choice; start event, end event, intermediate/message/timer event. How many
  event sub-types before it's bloat?
- **Is a stencil a distinct thing in the `.chd`, or just a Shape?** The
  decision above changes the earlier leaning (just a Shape, no schema). Now
  leaning: **its own light node type** with a `kind` from the built-in list, so
  it carries no notes or tags, conformance and required tags can leave it
  alone, and a person or an assistant cannot mistake it for an entity. Costs: a
  schema, `docs/file-format.md`, an edit operation, the exports (draw.io has
  BPMN shapes to map to) and the checks. To settle first.
- **Right-click type-swap** — swapping keeps size/position/label edits/edges,
  and just changes the icon (and maybe re-suggests the default label if the
  user hasn't customised it). Interaction with the existing icon controls in
  the property panel.
- **Icons** — reuse the built-in Tabler set, or does this need dedicated
  glyphs (the BPMN gateway marks X / + / O, an event's thin/thick/double ring
  aren't obviously in Tabler)? Ties into [epic 0183](0183-installable-icon-packs.md)
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

Update 2026-10-21: covers the parallel-flow need (fork, join, choice) raised while writing the [comparison with other tools](../../comparison.md). Related: [epic 0148](0148-archimate-flavoured-vocabulary-kit.md). Sequence diagrams are a different problem and are not part of this epic.
