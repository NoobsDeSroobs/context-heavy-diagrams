# 0036: Key-level highlight scales

## Status
Not Started — logged for later at the user's request while designing epic 0026, deliberately not designed yet. The user wants to think about this one themselves before it gets scoped.

## Goal
Raised as a natural extension of [epic 0026](0026-tagging-and-overlay-visualization.md)'s highlight mechanism, once that lands: right now a highlight matches one exact `key = value` pair (e.g. `GDPR = Sensitive`) and gets one color. The user wants a *macro* filter instead — highlight on the **key alone** (`GDPR`, not `GDPR = Sensitive`), with a whole value→color mapping defined at once. Example given: `irrelevant` → white, `pseudonym` → yellow, `PII` → orange, `sensitive PII` → red, all under one `GDPR` highlight rather than four separate key=value highlights.

## Notes
The user's own framing, verbatim in spirit: this doesn't seem like an easy thing to properly implement, and they haven't found a design they're happy with yet. Explicitly not to be designed or scoped by Claude proactively — wait for the user to bring their own thinking back to this before turning it into a real design conversation.

A few things worth having in mind whenever that conversation happens, purely as starting context, not pre-decisions:
- This is a distinct concept from epic 0026's per-value highlight, not a variant of it — a key-level highlight needs its own value→color mapping UI, separate from (or layered on top of) the single-color-per-highlight model 0026 ships with.
- Interacts with 0026's still-open "multiple matches on one element" question in a new way: an element could match a key-level highlight's mapping AND a separate exact-value highlight at the same time — worth working out once both mechanisms actually exist to test against, not on paper.
- Depends on epic 0026 existing first (the underlying tag/metadata matching primitives), but is not part of 0026's own scope.
