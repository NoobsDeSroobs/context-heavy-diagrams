# 0071: Highlight group priority (full recolor vs. dot) when multiple groups match

## Status
Not Started — not yet scoped, explicitly for later. Raised by the user (2026-08-23) mid-conversation about an unrelated epic (0054); logged so it isn't lost, not to be designed or built now.

## Goal
Today, when an element matches highlights from 2+ different groups (keys) at once, every one of them falls back to a small color chip — `ShapeNode.tsx`: `highlightMatches.length >= 2` always renders `HighlightChips` instead of a full border recolor, regardless of which groups are involved (a single match, by contrast, does get the full-border treatment). The user wants to be able to mark one highlight group as priority, so that group's color still gets the full recolor treatment even when another group also matches — the other group's color demotes to a small dot alongside it, instead of every matching group losing the full-color treatment the moment there's more than one.

**Example from the user:** two active highlight groups, "Team Color" and a GDPR data-classification group. Team Color marked as priority. An element tagged with both a team and a GDPR classification would show its full border in the team's color, with a small GDPR-colored dot next to it — not two small dots and no full-color border, which is what happens today.

## Relevant existing behavior
- `matchingHighlights()` (`src/renderer/src/highlights.ts`) returns every enabled highlight whose `key = value` exactly matches an element's metadata.
- `ShapeNode.tsx` (and presumably `ContainerNode.tsx`/edges — not checked): fewer than 2 matches → the single match recolors the border directly; 2+ matches → all render as small chips via `HighlightChips`, no per-group precedence exists today.
- Since a `HighlightDefinition` is an exact `key = value` match and an element carries at most one value per metadata key, at most one highlight can ever match a given element *within* a single group already — the ambiguity this epic is about only arises *across* different groups/keys, not within one.

## Real open questions (deliberately not resolved here)
- **How a group gets marked priority** — likely a control on the group header in `HighlightsPanel` (e.g. a pin/star icon next to the group title), not designed.
- **More than one group marked priority at once** — allowed (multiple full-recolor groups layered somehow) or enforced single-priority (picking a new one un-picks the old)? Not decided.
- **Persistence** — a highlight's *enabled* state is deliberately session-only, never saved (`HighlightDefinition`'s own comment, `shared/diagram.ts`); whether "priority" should follow that same session-only treatment or be saved as part of the highlight catalog itself isn't decided.
- **Interaction with `HighlightChips`/entity-highlight styling** — the exact visual treatment for the non-priority group's dot, and whether the priority group's full recolor looks any different from today's single-match case, isn't designed.

## Notes
Not scheduled into any current batch — flagged here purely so the idea isn't lost. Likely touches the same rendering code as epics 0026 (tagging/overlay visualization) and 0036 (grouped highlights).
