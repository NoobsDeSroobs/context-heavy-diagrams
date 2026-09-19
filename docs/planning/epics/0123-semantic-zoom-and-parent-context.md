# 0123: Semantic zoom (level of detail) and seeing one level up

## Status
Not Started — idea, logged 2026-09-19. **Not yet designed; the user wants to
see how it looks before deciding what to hide/show** — start with a
prototype/mock, not an ADR.

## Goal
Make large, layered diagrams (e.g. the 70-service landscape) readable at any
zoom level:
1. **Level of detail:** as zoom drops, elements degrade gracefully instead of
   becoming unreadable boxes.
2. **Zoom out past the diagram's edge to see its parent context** — the level
   above, resolved by the app (not stored in the file), akin to
   [epic 0122](0122-open-parent-and-backlinks.md). Depends on it.

## Ideas to prototype (nothing decided)
- Below a threshold: hide icons and edge labels, keep label + highlight colour.
- Above a threshold: show a one-line details summary inside the shape.
- The "level above" view: a dimmed rendering of the parent diagram around the
  current one, with the linking node marked. Read-only, and clearly
  distinguished from the editable diagram.

## Caution (from the discussion)
Easy to over-build. Start with one or two thresholds, nothing like a full LOD
system. Anything shown on the node face is opt-in per diagram/Preference so a
fresh diagram is unchanged ([ADR 0054](../../decisions/0054-progressive-disclosure-for-advanced-features.md)).
A permanent per-node tag/metadata subtitle was considered and **rejected**
(space/overlap with labels; highlights already cover "which tags are where";
where would the what-to-show toggle live?) — the peek card
([epic 0119](0119-details-peek-on-modifier-hold.md)) covers tags on demand.

## Tasks
- [ ] Prototype/mock: what does each zoom band show? (user review)
- [ ] Decide thresholds + where the setting lives
- [ ] Parent-context view (after 0122)
