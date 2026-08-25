# 0062: Search — find and highlight matching elements

## Status
Not Started — not yet scoped. Raised by the user (2026-08-22) after building/navigating the 70-node Meridian Rail landscape, motivated directly by that scale: there's currently no way to locate something in a large diagram without scanning by eye. **Explicitly told to log this for later, not build it now.**

## Goal
A search feature: type a query, and any element that matches "in some way" gets highlighted (the user's own framing — deliberately broad, not yet scoped to specific fields). Distinct from the existing tag-based highlight system (epics 0026/0036) — this is ad hoc/transient, driven by a live query, not a persisted user-defined highlight group.

## Real open questions (deliberately not resolved here)
- **What counts as a match?** Node/edge label text is the obvious minimum. Also candidates: element id, tag values (both key and value), details-sublayer markdown content, legend entries. The user's "matches in some way" phrasing suggests broad intent, but the exact field list needs a real design pass — searching details content in particular has cost (markdown isn't loaded/indexed today the way node data is). **Confirmed during [epic 0063](0063-dim-non-matching-elements-mode.md)'s design conversation (2026-08-25): this needs to support both a free-text query *and* explicit tag-based matching (key=value, usually one tag)** — not just free text — since tag-matching is what makes the result set precise enough to drive epic 0063's "Isolate" feature (dim everything outside the match set) as a genuinely separate dimension from highlighting.
- **How matches are shown.** Reuse the existing highlight rendering (`highlights.ts`, border/fill treatment) for consistency, or a visually distinct "search result" treatment so it doesn't get confused with real user-defined highlights? Does it coexist with active highlights, or temporarily suspend them?
- **Live-as-you-type vs. submit-to-search** — performance matters more at gallery scale (70+ nodes); worth checking cost before committing to live filtering.
- **Scope** — current diagram only, or does it reach into linked child diagrams? Linked-diagram navigation (epic 0009) makes "search across the whole drill-down tree" a real, if harder, possibility.
- **Where it lives in the UI** — a toolbar search box, a popup like Legend/Highlights, or a keyboard-shortcut-triggered overlay (`Ctrl+F`-style)?
- **Zero-match / clearing behavior.**

## Related, logged here rather than as its own epic
**Fit-to-node/selection** (zoom/pan the viewport to frame a node or the current selection) was raised in the same conversation as a natural pairing — once search can select a match, jumping the viewport to it is the obvious next step. The user called it a genuine nice-to-have but explicitly did not want a separate epic file for it; whoever scopes this epic should fold it in as an optional related task rather than treating it as out of scope by default.

## Notes
Not scheduled into any current batch — flagged here so it isn't lost, not because it's next up.

**Dependency discovered 2026-08-25, during epic 0063's design conversation: build this epic *before* epic 0063.** The batch order decided 2026-08-23 had 0063 (dim mode) before this one, but 0063's real design turned out to depend on this epic's search/tag-matching existing first — the user explicitly deferred 0063 until this ships. See [epic 0063](0063-dim-non-matching-elements-mode.md)'s Notes for the full reasoning.
