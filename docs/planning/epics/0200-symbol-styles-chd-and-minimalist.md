# 0200: Symbol styles: CHD and minimalist

## Status
Not Started. Logged 2026-11-19. Follows the implementation of [0194](0194-improve-on-the-bpmn-notation.md), whose symbols become the "CHD" style; the first task here can be done before that.

## Goal
Let a person draw and read the Behaviour kinds in one of two styles, **CHD** (the symbols of 0194) and **minimalist** (plain, familiar flowchart-like shapes and marks), chosen to suit themselves and the audience, and compare how people fare with each, as a small user study.

## Decided
- **A preference, not part of the file.** The two styles draw the same kinds from the same file; only the look changes, like the theme or the font. The setting is in Preferences (per person and machine), seeded with a default like every preference.
- **Symbols only, not colours.** The frames and marks differ; both use the same one-shade-per-family colours, so the study compares symbols, and "the icons mean the same" stays true.
- **Export and the command line can choose.** The SVG, PNG and draw.io exports take a symbols option that defaults to the preference, so a deck for one audience is made without changing the setting; the CLI export takes `--symbols chd|minimalist` and defaults to CHD (it has no preferences to read), so a CI pipeline can say which it wants.
- **The names are "CHD" and "minimalist"**; neither refers to another notation.

## Tasks
- [ ] **A mockup set to compare,** like `docs/experiments/behaviour-alternatives.html`: a sheet with the basic shapes of every kind, **CHD on top and minimalist below**, in the same sizes and themes, then **two dark-theme example flows**, one drawn entirely in each style. The minimalist set is designed here: frames (a diamond for a choice fits the square frame, its vertices land on the side midpoints), marks and rings, including how it draws the human action. The sheet is the stimulus for the study and the basis for the rest.
- [x] **A first comparison, for showing people:** [docs/experiments/symbol-styles-comparison.html](../../experiments/symbol-styles-comparison.html), one home healthcare process drawn three ways from one layout, labelled **A = BPMN 2.0, B = minimalist, C = CHD** (the page does not name them; the key is only here). Light and dark, stacked, side by side or one at a time. **The minimalist style is the symbol set the app had before 0194** (the 13 kinds of ADR 0180, in git at `72c90f1~1`): a decision with a cross, an inclusive choice with a ring, a parallel choice with a plus, a start as a plain circle (the play triangle came with 0194), an end as the heavy ring without a tick, the person, gear, sub-flow and loop marks on the steps. Drawn here in today's one-shade-per-family colours so only the symbols differ (the old set also had a green start, a red end and a blue parallel choice). For this process B and C differ only in the decision mark, the start and the end.
- [ ] Decide the minimalist set, and whether the study varies one thing at a time (frames, marks, rings) or compares the two whole sets.
- [ ] ADR: a symbol style is a preference with an export override; symbols only; a second look table keyed by the kind id; what each style promises.
- [ ] The preference (merged over defaults wherever it is received), its place in the Preferences panel, and a test.
- [ ] A second look for each kind in the kinds table and the drawing, the legend, the SVG, PNG and draw.io exports, the export dialogs' option and the CLI flag.
- [ ] The extension and assistant guidance: say which style an assistant's export uses and how to pick it.
- [ ] An example that shows the same flow in both ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)), and `examples/README.md`.
- [ ] The user study: a few people, the same flows in both styles, which they read faster and prefer, why, what they mix up; notes kept here, and the findings feed back into both sets.
- [ ] Changelog.

## Notes
- A new kind needs a look in both styles from then on; that is the standing cost, accepted for the study and the audiences.
- Kind ids and the file format do not change; an older app ignores the setting.
- The cross of a failed end in the CHD style can be taken for the minimalist decision (an X in a diamond). Look at the two side by side in the comparison sheet, and in the study ask whether it is mixed up; the minimalist style may need a different mark for a failed end.
