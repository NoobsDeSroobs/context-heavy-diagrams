# 0021: YAML frontmatter for detail files

## Status
Not Started

## Goal
Parse optional YAML frontmatter in detail `.md` files for semi-structured fields (integration type, inputs/outputs, technical vs. functional, or whatever ends up useful) — the brief explicitly anticipated this as a deliberately-deferred, zero-migration-cost addition ("no frontmatter present" and "frontmatter not yet parsed" are indistinguishable to a parser). Raised again during epic 0008 design discussion as a way to make the hover tooltip (epic 0008) richer than just "first line of the file."

## Tasks
(Not broken down yet — revisit when this epic starts.)
- [ ] Decide the actual field set worth having (type of info, technical vs. functional, etc. — genuinely undecided, needs its own discussion)
- [ ] Frontmatter parsing on read, without requiring it to be present
- [ ] Surface parsed fields in the hover tooltip instead of (or alongside) the first line
- [ ] Surface parsed fields in the detail panel UI itself, not just the tooltip

## Notes
No schema change needed to get started — frontmatter lives inside the `.md` file content itself, not in `diagram.chd`'s JSON.
