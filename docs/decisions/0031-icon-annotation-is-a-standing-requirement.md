# 0031: Icon annotation is a standing requirement across all entity variants

## Status
Accepted. Corrected 2026-11-16: this concerns entities only. It was written when entities were called shapes, and the rename left "shape" in the text. It says nothing about containers, text, lines or other kinds of element.

## Context
While raising the idea of entity/container variety beyond today's rectangle, the user flagged icon support as something not to lose. On first pass this got written down as if it were a constraint scoped to that one piece of design work. The user corrected that framing: icon annotation — today implemented only on `EntityNode.tsx`, for the one entity that exists — is a **general, standing wish**, not a detail specific to the non-rectangular-shapes work. It applies to every entity variant, present and any added later. The underlying need: the user relies on icons on entities to carry meaning (manual vs. automatic, server vs. human, etc.), and that visual language must keep working no matter how many entity options exist.

## Decision
**Every entity variant must be able to carry an icon annotation, as a standing rule.** Concretely:

1. Any work that adds or changes entity types must treat "this entity can carry an icon the way `EntityNode` does today" as a non-negotiable requirement of its design — not a detail to defer or an implementation nicety to fit in if convenient.
2. This is a durable product principle, not a one-time checklist item. It should be checked against any future entity-related work, the same way [ADR 0029](0029-backward-compatible-loading-is-a-standing-rule.md) is checked against any future file-format work.

## Alternatives considered
- **Leave it scoped to the non-rectangular-shapes planning doc.** What was actually happening before this ADR — the constraint was written down, but only inside one planning doc, framed as if satisfying it once would be the end of the concern. Rejected per the user's explicit correction: it needs to outlive that one piece of work.
- **Leave it as an unwritten expectation.** Same rationale ADR 0029 already rejected this for — real, and held up so far by consistent habit, but nothing forces the next entity-touching work to notice it's expected to keep holding.

## Consequences
- The non-rectangular-shapes planning doc's own "hard constraint" section now points here instead of restating this as local scope.
- Any later work that touches entity rendering (new entity geometry, an entity-like variant of another item type, etc.) inherits this as a design constraint to check against.
