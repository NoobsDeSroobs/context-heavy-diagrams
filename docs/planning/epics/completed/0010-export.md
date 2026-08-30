# 0010: SVG/PNG export

## Status
Done (2026-08-23), on `epic/0010-export`, pending PR/merge. PNG export (padding, transparent background, background color override, and a Legend/highlights legend) live-tested and confirmed working by the user across several rounds of fixes — see Notes. SVG export and export-everything-vs-selection-only are deliberately deferred, not blocking; see Notes. Raised as part of a batch decided 2026-08-23 (see [PROGRESS.md](../../../../PROGRESS.md)), motivated by uploading diagram views into Confluence.

## Goal
Export the current diagram to SVG/PNG with a configurable margin, for sharing a view outside this app (e.g. embedding it in Confluence).

## Tasks
- [x] Compute bounding box of diagram content + configurable padding (`getNodesBounds`, `src/renderer/src/export/exportPng.ts`)
- [ ] Export to SVG — deferred, see Notes: must be true vector, a separate design/build pass
- [x] Export to PNG — `File → Export as PNG…` opens `ExportPngDialog` (padding, transparent background, background color override), settings only remember the last-used values
- [x] Legend in the export — diagram Legend entries + one row per enabled highlight, auto-placed in a user-chosen corner (`exportLegendItems.ts`/`exportLegendDom.ts`/`exportLegendPlacement.ts`, ADR 0051 addendum)
- [ ] Export everything vs. export selection only — deferred, see Notes

## Notes
**2026-08-23: scoped down to PNG only for this pass; SVG deferred and re-scoped to true vector.** See [ADR 0051](../../../decisions/0051-png-export.md) for the full reasoning — the common rasterized-snapshot-wrapped-in-SVG shortcut (`html-to-image`'s `toSvg()`) was rejected because the user wants real vector output eventually (editable in Illustrator/Inkscape elsewhere), which is a substantially larger, separate serializer to build against the diagram model directly, not a variant of the PNG path. When SVG is picked up for real, it needs its own design pass, not an assumption that it reuses PNG's capture mechanism at all.

**2026-08-23: first pass corrected the same day after live testing.** Two real problems found: (1) padding/transparent-background were global `AppSettings` fields edited only in the Settings panel, not a per-export dialog as the user expected — reversed; `ExportPngDialog` is now the actual place these get set (plus a new background-color-override field), with settings just remembering the last-used values so the dialog reopens prefilled. (2) exported PNGs had no visible arrowheads at all — root-caused to `EdgeMarkerDefs`' `<marker>` definitions living outside the DOM subtree PNG export captures; see [known-issues.md](../../../known-issues.md#exported-pngs-had-no-visible-arrowheads-on-any-edge) and [ADR 0051](../../../decisions/0051-png-export.md)'s addendum for both.

**2026-08-23: legend added, combining diagram Legend entries and enabled highlights.** Raised once color/arrow fidelity worked; the user's example (GDPR classification highlights → four colored rows) confirmed the label convention should exactly match `HighlightsPanel`'s own (group label only when a highlight is the sole enabled member of its key). Auto-placement only, corner selectable in the dialog (default bottom-left), legend size never shrunk to fit — occupied corners get the canvas extended instead, per the user's own "make sure the legend grows to make the content readable... extending is fine, but wasteful if [the corner is already free]." Manual placement explicitly deferred, same pattern as the base PNG case. Full reasoning and a documented known limitation (edge-obstacle detection is a coarse endpoint-box approximation, not the real rendered path) in [ADR 0051](../../../decisions/0051-png-export.md)'s addendum.

**2026-08-23: export scope (everything vs. selection) raised, deliberately deferred.** The user wants an "export everything" vs. "export selection only" choice, but explicitly said to get the base case working first — not scoped or built in this pass, just captured here so it isn't lost.

**2026-08-23: the user separately floated a general cleanup pass** ("remove a lot of noise and minor issues") to do once this epic wraps — not scoped to anything specific yet; the newly-found repo-wide CRLF lint-warning issue ([known-issues.md](../../../known-issues.md#npm-run-lint-reports-10000-crlf-warnings-repo-wide)) is one concrete candidate, epic 0028 is the existing home for lint cleanup specifically, but the user's framing sounded broader than just lint. Worth a real scoping conversation when picked up rather than assuming it's just epic 0028.
