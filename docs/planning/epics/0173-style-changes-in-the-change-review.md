# 0173: Style changes in the change review

## Status
Built (2026-11-07), awaiting a look in the app. Logged 2026-11-04. ADR: [0153](../../decisions/0153-a-look-that-carries-meaning-is-a-change-in-a-review.md).

## Goal
A change in the look of an element shows up in the review as a change, because the look often carries meaning: a dotted line against a solid one, red against green, a thicker line, a different arrowhead, an animation. Today a restyle is only a faint marker and the element is dimmed like an unchanged one ([ADR 0133](../../decisions/0133-what-counts-as-a-change-in-a-review.md)); this reverses that for the fields that matter.

## Decided
Fixed list of look fields (icons included), a new Restyled class, the cosmetic rest keeps the paint brush. Details and alternatives in the ADR.

## Tasks
- [x] Decide which style fields count, and the category and badge
- [x] A new ADR that replaces the "style is not a change" part of ADR 0133
- [x] The classifier in `src/shared/compare/`: per-field style differences, with the old and new value
- [x] The compare window: colour, badge, legend count and the hover detail; the paint brush stays for the cosmetic fields
- [x] `chd diff` prints the same, with `--json` carrying the changed fields
- [x] The list and revert for a restyle (revert restores the whole element, as for any modified one)
- [x] Diagram-level look: legend entries and direction sets were already listed as changed; a test pins that
- [x] Tests for each counted field, the stored colour, and a restyle plus another change
- [x] Update `docs/architecture/`, the skill's guidance on `chd diff` and an example pair under `examples/review/`
- [ ] Look at it in the compare window on Windows and Linux: the fuchsia colour and badge in both themes, the glow on a restyled edge, the legend count, the paint-brush toggle

## Notes
Raised while using the review on diagrams where colour and line style mean something. An assistant that restyles edges ("make the planned ones dotted") is reviewed the same way, which is another reason to count it.
