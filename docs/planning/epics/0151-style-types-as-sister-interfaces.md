# 0151: Style types as sister interfaces

## Status
Done on its branch, to be confirmed after the merge (ADR [0170](../../decisions/0170-style-types-are-sister-parts.md)). Follows [0143](../completed-epics.md#0143-package-the-code-by-feature).

## Goal
`NodeStyle` and `EdgeStyle` both `extend FontStyle`, which reads as a parent type and is named after one of its parts (and collides with CSS `font-style`). Make the parts sisters, `TextStyle`, `FillStyle`, `StrokeStyle` and `LineEndsStyle`, and compose the two styles from them by intersection. Names are provisional; check each field's real use first.

## Tasks
- [x] Map each field of `FontStyle`, `NodeStyle` and `EdgeStyle` to a part
- [x] Define the parts in `shared/styling/schema.ts` and recompose `NodeStyle` and `EdgeStyle`
- [x] Update the users; update `docs/file-format.md` only if the wording changes

## Notes
The JSON stays flat (`fontSize`, `fill`, ...), so there is no format change. Nesting the fields (`style.text.fontSize`) would be a format change and its own decision.
