# 0078: Consider BPMN as the basis for this app's visual language

## Status
Not Started — not yet scoped, explicitly "a note to think about later." Raised by the user (2026-08-24) alongside the Shape/Container and swim-lane conversations.

## Goal
The user's own framing: BPMN (Business Process Model and Notation) might be a better foundation for this app's visual/notation language than whatever informal mix it uses today, specifically because it isn't tech-first — it's general enough to cover business-process modeling, not just IT-architecture-flavored diagrams. Nothing scoped beyond that observation.

## Relevant existing context
- [ADR 0014](../../decisions/0014-node-and-edge-style-schema.md) (node/edge style schema) already flagged and deliberately punted on "the exact notation-base question" — markers/styling were built "deliberately approximate, not pixel-correct ERD/UML notation" without settling what notation family this app is actually modeling after.
- [Epic 0077](later/0077-swim-lanes.md) (swim lanes, logged the same day) is itself a BPMN concept (pools/lanes) — if this app adopted BPMN as its notation basis, that would likely settle epic 0077's own "do we need a distinct feature" question one way or another, rather than the two being independent.
- The project brief's own scope already spans IT-architecture-adjacent and enterprise-architecture-adjacent work (business capability maps, motivation/goals views — [ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)), which is closer to BPMN's own territory than a narrowly technical notation would be.

## Notes
Purely a note for later, not a design in progress — no comparison against this app's current shape/marker vocabulary has been done, no decision about whether "basis for" means strict BPMN compliance, loose inspiration, or something else entirely.
