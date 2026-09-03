# 0078: BPMN as a basis for this app's visual language

## Status

Resolved (2026-08-31), merged to `master` (PR #83) — see [ADR 0080](../../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md).
Discussion held, decision recorded, no code in this epic itself; the work it
drives lives in [epic 0105](../0105-semantic-notation-stencils.md).

## The question

The user's framing (2026-08-24): BPMN might be a better foundation for this
app's visual/notation language than the informal mix it uses today — it isn't
tech-first, and covers business-process modelling, not just IT-architecture
diagrams.

## The answer (2026-08-31)

**BPMN as an adopted visual _vocabulary_, for recognisability and pickup — not
a grammar, metamodel, or execution model.** Full reasoning in
[ADR 0080](../../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md).
Key points:

- BPMN's value is its known, precise vocabulary; its cost is the rigid
  metamodel + validation + token semantics that [ADR 0008](../../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)
  explicitly rejects. Take the vocabulary, leave the grammar.
- **Shapes stay rectangular.** A gateway/decision/event is an ordinary Shape
  with a distinguishing **icon + label** — the same way every concept type is
  already conveyed ([ADR 0031](../../../decisions/0031-icon-annotation-is-a-standing-requirement.md)).
  Non-rectangular shape variants for this were considered and **rejected**;
  [epic 0051](../later/0051-non-rectangular-shapes-and-new-item-categories.md)
  stays an independent parked idea, not on BPMN's path.
- Sequencing = numbers on edge labels; conditions = text on edge labels. No
  new machinery.
- Drill-down, per-element context, lanes: already covered (linked diagrams,
  Details, Container).
- Token semantics / BPEL / validation: out of scope — the user doesn't want
  them.
- **Process / workflow modelling is confirmed in scope** — ADR 0008 addendum +
  overview.md Purpose updated.

## What this drives

- **[Epic 0105](../0105-semantic-notation-stencils.md)** — a new item-palette
  category of ready-to-drag semantic symbols (choice, parallelism, events, …),
  each a rectangular Shape pre-seeded with an icon + default label. Neutral
  labels + BPMN search keywords; type changed via right-click. Not blocked on
  anything.

## Notes

Originally logged as "a note to think about later, not scoped." The design
conversation happened 2026-08-31 after the 0086 → 0095 → 0080 menu-bar run.
First pass of this write-up wrongly had non-rectangular shape variants as a
driven outcome; the user corrected it — shapes are square, icon + label do the
work.
