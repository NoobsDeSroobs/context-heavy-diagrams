# 0124: Feature toggles, and beta features

## Status
Not Started. An idea since 2026-09-19, wanted again on 2026-11-21: the app now has several optional features (stories, visibility sets, the security matrix, behaviours, the minimap). A design pass first, after 0191.

## Goal
Let each person turn advanced or rarely-used features on and off (Preferences tier, see the [glossary](../../architecture/glossary.md)), so the base app stays lean for everyone and heavy features (security matrix, isolate, stories, outline view, …) do not add noise for people who never use them. Extends [ADR 0054](../../decisions/0054-progressive-disclosure-for-advanced-features.md) from "a fresh diagram never gets harder" to "the *app chrome* never gets harder either."

## Beta features (decided 2026-11-21)
A toggle is also how a person opts in to a beta feature, until enough testing has been gathered to justify a proper release. It may end in a release, or in deleting the feature. Beta may be rough, and says so, but that only works with discipline, so the rules are written before the first one:
- A beta feature is marked beta in the list of toggles, is off by default, and is opt-in.
- Its epic or ADR says what testing would promote it, what would delete it, and when it is looked at again.
- A feature that is off never loses data: what it wrote still opens and round-trips, and a deleted beta leaves its fields in the file ignored and kept, like any field this version does not know ([epic 0115](../completed-epics.md#0115-fileapp-version-compatibility-and-data-loss-safety)).
- Each toggle has a test for its off state.

## Open questions
- What is a "feature": a menu entry, a dock panel, a toolbar button, a mode, a palette category? Leaning: one registry entry names all of those that belong to it.
- Off means hidden UI only, never inert data (leaning, and the rule above).
- Registry-based (features declare themselves) versus scattered `if (pref)` checks. Leaning registry, the same idea as [epic 0120](../completed-epics.md#0120-help--keyboard-shortcuts--gestures-page).
- New features default on, a beta off. Which of today's features are the first toggles.
- Where the list lives: a screen in Preferences, grouped, with beta marked.
- Related: the outline and table view ([0125](later/0125-outline-and-table-view.md)) was to sit behind this.
