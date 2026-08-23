# 0076: Rename "Shape" to something like "Concept"

## Status
Not Started, and deliberately held there — the user explicitly chose glossary-only documentation over an actual rename for now, and separately wants to defer the replacement-name decision itself ("I wanna defer this decision because it is quite important"). Raised by the user (2026-08-24) alongside epic 0060 design work, but unrelated to it.

## Goal
The user's own framing: a Shape and a Container remain conceptually different things even if every style property is set identically between them — a Container represents grouping/boundary, a Shape represents a standalone entity. "Shape" undersells that distinction, reading as a purely geometric/visual term rather than a semantic category. Something like "Concept" (or another name capturing "a distinct thing in the system," independent of how it's styled) might fit better.

## Why this is bigger than a label change
- `'shape'` is a literal stored string in `DiagramNode.type` in every existing `.chd` file, not just a UI label — renaming it is a real file-format change, not a cosmetic one.
- Backward compatibility: [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md) requires old files to keep loading correctly — needs either an alias (`'shape'` still accepted on read, written as the new name going forward) or a real migration, not a silent breaking rename. (Less of a hard blocker than it would normally be — the user pointed out the app is pre-beta with them as the only user right now, so there's no real installed base of other people's files to protect. That removed the main objection to doing the rename *now*, but the user still chose not to.)

## Decided 2026-08-24: hold at documentation only, for now
Given three options (keep the internal name and only change the displayed label; document the distinction in the glossary without renaming anything; do the real rename now, leveraging the pre-beta/single-user situation), the user chose **documentation only**: no code or file-format change at all right now. [docs/architecture/glossary.md](../../architecture/glossary.md) now has a "Shape vs. Container" entry explaining the semantic distinction independent of whatever the type ends up being called.

The replacement name itself ("Concept" was only the user's first offering) is explicitly deferred as its own decision, described as "quite important" — not to be rushed alongside this smaller documentation step.

## Real open questions (deliberately not resolved here)
- The actual replacement word.
- Alias-on-read vs. a real `.chd` schema version bump for the migration, if/when the real rename happens.
- Whether this is worth doing before or after the product naming question (epic 0027) settles, given both are "what do we call things" work happening around the same time.

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.
