# 0037: Diagram legend

## Status
Not Started — not yet scoped. Raised by the user (2026-08-20) while reviewing the first real gallery diagram ([epic 0022](0022-example-diagram-gallery.md)'s C4 context example) — the diagram uses fill color to distinguish the in-scope system from actors from external systems, and a dashed edge to flag a transitional/being-retired relationship, with nothing in the diagram explaining what those visual conventions mean. Deliberately not designed here, just captured so it isn't lost, same as epics 0024/0026/0030.

## Goal
A legend capability: a way to explain what a diagram's colors, edge styles (line style, markers), and icons mean, without relying on the reader already knowing the convention or the diagram author explaining it out of band. Surfaced directly by dogfooding — this is exactly the kind of gap epic 0022 exists to find.

## Decided
- **Structured, not freeform — a legend is a first-class UI element in its own right.** Explicitly not "place a shape and a text node and hope for the best" (which is what the epic 0022 gallery is doing as a stopgap right now). Real UI to build one: dropdowns to pick what a color/line-style/icon means, an "add entry" button to build up the list — an editing experience, not hand-typed prose standing in for one.
- **Toggleable.** The legend isn't always rendered on canvas — visibility is a switchable state, in the same spirit as highlights being toggled on/off per session (epics 0026/0036), though whether it reuses that exact toggle mechanism or gets its own is still open below.

## Real open questions (deliberately not resolved here)
- **Scope: colors, edge styles, icons — one mechanism or several?** Fill/border color is the most obviously reusable case, but icons already carry some self-explanation (a recognizable symbol) that a plain color swatch doesn't — may not need the same treatment.
- **Where it renders when toggled on** — a corner panel, something pinned regardless of pan/zoom, or still a canvas-positioned element (just a structured one instead of freeform)?
- **Relates to, but is distinct from, [epics 0026/0036](0026-tagging-and-overlay-visualization.md)'s highlight system** — highlights already have a color-to-tag-value mapping (`{ key, value, color }` in `requiredTags`/`highlights`), which is arguably legend data for *that* mechanism specifically. Does a legend auto-populate entries from the highlights catalog and let the user add further entries (edge styles, icons) on top, or is it a wholly separate structured catalog that duplicates highlight data if you want it listed? Don't build two unrelated color-labeling mechanisms if one can serve both.
- **Persistence — new file-format field.** Now that it's decided to be structured rather than freeform canvas primitives, this almost certainly needs a real schema addition to `docs/file-format.md` (a top-level `legend` array, shape TBD, likely similar in spirit to how `highlights` is modeled) rather than being expressible with existing shapes/text/containers alone.
- **Toggle mechanism specifics** — where the on/off control lives (toolbar button, per-diagram setting, keyboard shortcut), and whether toggle state is saved to the file or is session-local UI state like highlight enablement is (see `docs/file-format.md`'s Highlights section for that precedent). [Epic 0048](0048-left-tool-sidebar.md) (also unscoped) proposes a left-side tool sidebar as a plausible home for this toggle, alongside zoom/fit/lock — worth resolving together rather than this epic inventing its own toggle location independently.

## Notes
Not scheduled into the current batch (see [PROGRESS.md](../../../PROGRESS.md)) — flagged here so it's on the backlog and not lost, not because it's next up. Until this is designed and built, gallery diagrams that need to explain a color/line convention should do so in their existing in-canvas blurb text node (see epic 0022's Notes) as a known-temporary stopgap, not a model for what a real legend should look like.
