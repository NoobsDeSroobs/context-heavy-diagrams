# 0099: Search / isolate by reference presence

## Status
Not Started — split off [epic 0090](completed/0090-image-element.md) (2026-08-27, [ADR 0069](../../decisions/0069-reference-images.md)).

## Goal
Make "has one or more reference images" (epic 0090) a matchable facet in the search overlay (epic 0062/ADR 0062), combinable with the existing free-text / tag matching — the user's illustrative example: `hasPicture = true & tag=GDPR.PII`. Since search feeds Isolate (epic 0063), this also makes "dim everything except shapes that carry a reference" work for free.

## Relationship to existing work
- Directly parallel to [epic 0094](completed/0094-search-by-icon.md) (search by icon — find every element carrying a given icon). Both extend epic 0062's matcher with a structured/boolean facet rather than pure substring matching. Worth designing the two together — whatever token syntax (`has:references`, `has:icon`, a structured query) is chosen should cover both.

## Open questions
- Query syntax: a `has:references` keyword token in the existing free-text box, a separate set of checkboxes/filters in `SearchOverlay`, or a small structured query language.
- Whether this pulls epic 0094 in with it (shared design) or stays independent.
