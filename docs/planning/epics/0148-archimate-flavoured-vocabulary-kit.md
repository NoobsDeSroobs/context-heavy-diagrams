# 0148: An ArchiMate-flavoured vocabulary kit

## Status
Not Started. Logged 2026-10-21 from a discussion of the [comparison with other tools](../../comparison.md). Sparse on purpose: research first, and an open question whether it is worth building.

## Goal
Offer the recognisable visual language of ArchiMate (layer colours, a small icon in the corner of an element, relationship line styles) as a ready-made kit, so architects get a familiar look without the tool adopting a metamodel or validating anything.

## Why
This follows the same line as the BPMN decision ([ADR 0080](../../decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md)): adopt the vocabulary, not the grammar. [ADR 0008](../../decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md) only ruled out an enforced notation and validated relationship types.

## What might fit what exists (to verify)
- Elements are rectangles with a corner icon, which matches the icon slots and the rectangular-shapes rule ([ADR 0031](../../decisions/0031-icon-annotation-is-a-standing-requirement.md)). The ArchiMate specification is believed to allow this form; to be confirmed.
- Layer colours could be a named style palette (palettes are shareable).
- Relationships (composition, aggregation, assignment, realisation, serving, access, influence, triggering, flow, specialisation, association) are line styles plus end markers, probably as edge direction sets. Realisation and specialisation need a hollow triangle ([epic 0149](0149-hollow-triangle-edge-marker.md)).

## Open questions
- **Licence.** Whether the notation and its icons can be reused, and under what terms. This is the same question that blocks vendor icon packs ([epic 0019](0019-installable-icon-packs.md)).
- Which subset: strategy, business, application, technology, motivation layers and the core relationships.
- Whether a later conformance profile ([epic 0138](later/0138-architecture-conformance-checks.md)) could use ArchiMate's table of allowed relationships.

## Related
[Epic 0105](0105-semantic-notation-stencils.md), [epic 0149](0149-hollow-triangle-edge-marker.md), [epic 0138](later/0138-architecture-conformance-checks.md), `docs/diagram-and-architecture-types.md`.
