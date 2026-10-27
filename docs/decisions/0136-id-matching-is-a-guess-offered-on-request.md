# 0136: Id matching is a guess, offered on request

## Status
Accepted (2026-10-27)
Supersedes: none
Superseded by: none

## Context
The comparison pairs elements by id ([ADR 0133](0133-what-counts-as-a-change-in-a-review.md)). An assistant that rewrites a whole diagram can give every element a new id, and then everything reads as removed and added, which is useless to review. Pairing elements by what they look like instead is a guess, and a quadratic one.

## Decision
**A cheap check always runs; the guess runs only when asked.** One pass with a map suspects a rewrite when at least three removed elements, and at least a quarter of them, have an added element of the same type and name. The window then shows a banner ("many elements look replaced, not edited") with **Match them up**. Only that button runs the matching (`src/shared/compare/match.ts`), after the button has shown "Matching…".

**How it pairs.** Pass 1 pairs the same type and name (duplicates by nearest place). Pass 2, the quadratic one, scores what is left on name similarity (edit distance, with a containment rule so "Passenger" matches "Passenger (mobile app user)") and nearness, best pair first. Connections follow by their mapped ends and label. Because pass 2 is quadratic it is bounded: skipped above 4 million pairs and stopped after 2.5 s, each with a note on the banner, so a very large diagram gets the closer matches and not a frozen window.

**A guess says so.** A matched element says on hover that its id differs and it was matched by name and place; the banner says to check them. **Undo matching** returns to the plain comparison. The earlier version is rewritten with the matched ids, so the comparison and a revert ([ADR 0135](0135-a-revert-from-a-review-is-made-in-the-editor-window.md)) see the same elements; the pairs travel with the revert request. `chd diff --match` does the same ([ADR 0137](0137-chd-diff-the-same-review-without-the-app.md)), with a hint when it looks needed.

## Alternatives considered
- **Always match.** Costs time on every comparison, and a wrong pair would pass as an edit without anyone choosing it.
- **A three-way match** (the version before, the assistant's, the current). Would sit behind the same button; not built.

## Consequences
- A wrong pair shows as a modification, not as a removal and an addition. The reviewer can see that on hover and undo it.
- Matching is per comparison and never saved: closing the window drops the pairs.
