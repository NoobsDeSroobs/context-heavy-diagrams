# 0080: BPMN as an adopted visual vocabulary, not a metamodel

## Status

Accepted (2026-08-31). Sits under
[ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md) (notation-agnostic,
flexibility over formal notation) and
[ADR 0031](0031-icon-annotation-is-a-standing-requirement.md) (icon + label is
how a Shape conveys what it is).

## Context

An open question: should BPMN be the basis for this tool's visual/notation
language, given it isn't tech-first and covers business-process modelling as
well as IT-architecture diagrams?

BPMN's genuine value is a **known, precise vocabulary** — a business analyst and
a developer read the same diagram the same way. But that precision comes from
its metamodel: ~100 elements, a rigid grammar, validation rules, and token /
execution semantics (→ process engines, BPEL). That rigidity is exactly what
[ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md) rejects — "no
formal EA metamodel, no validated relationship types," flexibility as the
competitive edge.

Assessment of BPMN's load-bearing ideas against what this tool already has:

| BPMN idea                                        | This tool                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Leveled abstraction / sub-process drill-down     | Already have it, arguably better — linked diagrams ([ADR 0005](0005-diagram-identity-and-linking.md)) are real navigable files, not expand-in-place.                                                   |
| Terse diagram + rich context elsewhere           | Already have it, better — the Details feature is exactly what BPMN diagrams lack.                                                                                                                      |
| Pools / lanes                                    | Container covers it — no dedicated construct needed.                                                                                                                                                   |
| Sequence vs message vs association flow          | Line style + markers ([ADR 0014](0014-node-and-edge-style-schema.md)) + named presets ([ADR 0010](0010-named-searchable-style-presets.md)). Truly non-directional connectors are a separate open item. |
| Events, gateways as distinct symbols             | Adopted — but as **icon + label on an ordinary rectangular Shape**, not via the outline. See Decision.                                                                                                 |
| Token semantics, execution, BPEL                 | Out of scope. Not a process engine.                                                                                                                                                                    |
| Validation (no dangling flows, gateway arity, …) | Rejected — violates ADR 0008.                                                                                                                                                                          |

## Decision

**Adopt BPMN as a visual _vocabulary_, for recognisability and ease of pickup —
never as a grammar, metamodel, or execution model.** Someone who knows BPMN
should be able to build and read a recognisably-BPMN diagram; someone who
doesn't gets ordinary shapes. Nothing is enforced or validated.

**Shapes stay rectangular.** What a Shape represents — a task, a decision, an
event — is carried by its **icon + label**, exactly as every other concept type
already is ([ADR 0031](0031-icon-annotation-is-a-standing-requirement.md)). A
"decision" is a rectangular Shape with a branch/fork icon and a label, not a
diamond node. This keeps the primitive count at one and stays consistent with
how the tool already works; the cost is that a BPMN-literate reader loses the
instant shape-based read (a diamond screams "gateway") — accepted, the icon
carries it.

Concretely:

1. **Semantic symbols** (choice, parallelism, events, …) are ordinary Shapes
   with a distinguishing icon and a sensible default label. Not new node types,
   not new outlines.
2. **A stencil category** in the item palette holds ready-to-drag versions —
   each a Shape pre-configured with the right icon + default label. One category
   name that encapsulates all of them (parallelism, choice, events, …); the
   specific type is changed via right-click; every entry is individually
   findable in a searchable list. (Its own planning item; not built here.)
3. **Naming**: neutral labels in the palette/list ("Decision", not "Exclusive
   Gateway"); BPMN terms ("gateway", "XOR", "BPMN start event") attached as
   picker-layer search keywords ([ADR 0010](0010-named-searchable-style-presets.md)),
   so the tool's own vocabulary isn't committed to one standard but BPMN users
   still find things by the name they expect.

Sequencing and conditions need no new machinery — numbers on edge labels for
order, text on edge labels for logic, both already supported.

**Process / workflow modelling is confirmed in scope** — [ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md)
gains an addendum. The tool should handle a process/flow diagram well through
generic primitives + this vocabulary, without becoming a dedicated process
tool.

## Alternatives considered

- **BPMN as the actual notation basis** (adopt the grammar, offer the full
  palette, maybe validate). Rejected — it's the rigidity ADR 0008 exists to
  avoid; the goal is not "a BPMN tool."
- **Non-rectangular Shape variants** (a diamond node for gateways, a circle for
  events). **Rejected.** Shapes stay rectangular; icon + label is how concept
  type is conveyed ([ADR 0031](0031-icon-annotation-is-a-standing-requirement.md)).
  A connectable non-rectangular "gateway" is just a Shape with a different
  outline — it adds a styling axis and some rendering/hit-testing complexity
  for a recognisability gain the icon can largely deliver on its own. The
  separate "non-rectangular shapes" idea in the planning backlog stays parked
  and is unrelated to this decision.
- **A non-enforced `role` facet on nodes** (event / activity / gateway / plain)
  driving default icon + markers. Rejected for now — it's a small metamodel,
  and a stencil that just seeds a Shape's icon + label does the same job with
  no schema. Revisit only if real use shows icon + label isn't enough to keep
  symbol types straight.
- **ArchiMate instead of BPMN** as the vocabulary source — closer to the tool's
  IT/EA domain, but an even heavier metamodel, and less widely recognised for
  process/flow work. Same verdict would apply: vocabulary, not grammar.

## Consequences

- No `.chd` schema change from this ADR. The stencil category most likely needs
  none either — a stencil resolves to a plain Shape with an icon and a label.
- [ADR 0008](0008-tool-scope-includes-ea-adjacent-diagrams.md) addendum +
  `docs/architecture/overview.md` Purpose section: process/workflow modelling
  explicitly named as in scope.
- The eventual notation-vocabulary catalogue ([ADR 0014](0014-node-and-edge-style-schema.md)'s
  deferred "notation-base question") now has a partial answer: BPMN is one
  keyword source among others, layered on shape-described primitives, never the
  schema's own vocabulary.
