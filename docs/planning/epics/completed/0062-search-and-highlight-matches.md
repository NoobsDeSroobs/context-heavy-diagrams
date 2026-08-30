# 0062: Search — find and highlight matching elements

## Status
Done, live-tested and confirmed working by the user (2026-08-26), on `epic/0062-search-and-highlight-matches` (based off `docs/guiding-pet-peeves`), PR pending. `typecheck`/`lint` clean (same 4 pre-existing baseline errors, no new warnings in the new/touched files). Raised by the user (2026-08-22) after building/navigating the 70-node Meridian Rail landscape, motivated directly by that scale: there's currently no way to locate something in a large diagram without scanning by eye.

## What shipped
Ctrl+F opens `SearchOverlay` (fixed top-right, no anchor button — see the design decisions below); Search button or Enter runs the query. `search.ts`'s `matchesSearchQuery` does the free-text/tag substring match; deep search (toggle, off by default) additionally awaits `window.api.readDetails` per not-yet-matched node with a details path and does a plain substring check. Matches render via `DiagramContext`'s new `searchMatchIds` set: a distinct dashed outline (`.search-match`, `--search-match-color`) on `ShapeNode`/`ContainerNode`/`TextNode`, a `filter: drop-shadow(...)` glow on `LabeledEdge` (an edge has no path-following CSS outline, unlike a node's box). The first match (or whichever the user steps to via next/prev) is selected and framed via `rfInstance.fitView` — an edge match fits on its source/target nodes instead of itself, since fitView has no edge-shaped target. Once a run has live matches, repeated Enter in the query field cycles next/prev (Shift+Enter goes backward) instead of re-submitting — same convention as a browser find bar; editing the query clears the run so Enter goes back to submitting.

## Goal
A search feature: type a query, and any element that matches "in some way" gets highlighted (the user's own framing — deliberately broad, not scoped to one field). Distinct from the existing tag-based highlight system (epics 0026/0036) — this is ad hoc/transient, driven by a live query, not a persisted user-defined highlight group.

## Design decisions (settled 2026-08-26 — see [ADR 0062](../../../decisions/0062-search-scope-and-matching.md))
- **Match fields, V1**: free-text substring match across label text, element ID, and tag key/value — all treated as one combined "matches in some way" search, no per-field syntax yet.
- **Query syntax scoping (e.g. `metadata:*python*` to restrict to one field, plus real AND/OR/include-exclude combining across criteria) — deferred, not V1.** Logged as a future enhancement once the basic free-text search is live and proven useful. Confirmed 2026-08-27, during [epic 0094](0094-search-by-icon.md)'s scoping, that this is also the intended eventual home for combining icon-based matching with other criteria — the user's own call not to build one-off combining logic for that one pair of fields ahead of a real query language.
- **Details-sublayer deep search**: a separate toggle, off by default. When on, each visible node's detail `.md` file is opened and scanned live for the query substring (no indexing — open file, check for at least one match, done). This is explicitly a boolean contains-check, not ranked/highlighted-within-the-file.
- **Query timing**: V1 is submit-to-search — a search button, or pressing Enter, runs the query. Live-as-you-type is a deliberate future enhancement for the free-text/tag fields once proven worth the perf cost at gallery scale; deep search (file reads) should never be live-as-you-type regardless.
- **UI entry point, V1**: `Ctrl+F`-triggered overlay only, no permanent toolbar box. Explicitly provisional — flagged for a placement review once the overall GUI chrome is more mature (see Notes).
- **Scope**: current diagram only. Cross-diagram ("drill-down") search is out of scope here — see [epic 0093](../0093-drill-down-search-across-linked-diagrams.md).
- **Match rendering**: reuse `highlights.ts`'s existing border/fill treatment, but as a visually distinct "search result" style (not indistinguishable from a real user-defined highlight group), and coexisting with active highlights rather than suspending them.
- **Zero-match / clearing**: clearing the query clears all search-result styling; a query with zero matches shows an explicit "no matches" indicator rather than silently highlighting nothing.
- **Fit-to-node/selection folded in**: once a match can be selected, zoom/pan the viewport to frame it — included in this epic's scope per the user's earlier instruction not to split it into its own epic.

## Notes
UI placement (`Ctrl+F` overlay) is a V1-only choice — revisit once the rest of the app's chrome (toolbar, docks, menu bar) has settled, rather than optimizing search placement in isolation now.

**Dependency (resolved by this epic): epic 0063 needs this to ship first.** The batch order decided 2026-08-23 had 0063 (dim mode) before this one, but 0063's real design turned out to depend on this epic's search/tag-matching existing first — the user explicitly deferred 0063 until this ships. See [epic 0063](0063-dim-non-matching-elements-mode.md)'s Notes for the full reasoning.
