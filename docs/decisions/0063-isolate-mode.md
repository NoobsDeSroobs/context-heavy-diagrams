# 0063: Isolate — trigger, UI, and rendering

## Status
Decided and implemented (2026-08-26), revised same day after a live-testing follow-up (see Addendum below).

## Context

Isolate was scoped via a real design conversation on 2026-08-25 that reframed it from a highlight-coupled "dim mode" into "Isolate": a general-purpose, session-only mechanism that dims every element outside a given working set, deliberately decoupled from the highlight system. That conversation left four real questions open on purpose, to be answered once search actually shipped and its shape was known: what triggers Isolate, where its control lives in the UI, what rendering treatment to use, and whether edges get the same treatment as nodes.

## Decision

**Trigger: search-driven only, no manual-selection trigger.** Matches the final framing and the user's confirmed choice — adding a manual "select some elements, Isolate them" path back in would reintroduce the complexity the user explicitly deferred away from during the original scoping ("I think we should defer til after this is implemented now that I think about it").

**UI: two separate buttons, not one combined toggle.** The original assumption (a single checkbox inside the search overlay, doubling as both "run search" and "apply Isolate") was rejected by the user in favor of a distinct **Isolate** button next to **Search** in `SearchOverlay`. This means running a search and applying Isolate are two independent explicit actions: Isolate can be toggled on/off without re-running the query, and a new search always requires re-arming Isolate (see Consequences) rather than silently continuing to apply a stale match set. The Isolate button is disabled until a search has actually run with at least one match — there's nothing to isolate down to otherwise.

**Rendering: opacity, 50% default, exposed as a Setting (`isolateOpacity`).** The design conversation had assumed reduced opacity throughout but never pinned a number; the user picked 50% but asked for it to be adjustable rather than hardcoded — global, not per-diagram, same tier as `edgeStraightSegmentLength`/zoom limits/etc. in `AppPreferences`.

**Edges get the same treatment as nodes, exactly as predicted** ("very likely yes, structurally trivial") — `searchMatchIds` already covered both node and edge ids from the search work, so this needed no new plumbing.

## Implementation

- `search.ts`'s new `isolateStyle(id, isolateActive, searchMatchIds, isolateOpacity)` is the one shared computation every node/edge component calls into its own inline `style` — avoids four near-identical copies of the same three lines. Returns `{}` (no opacity, no transition) whenever Isolate is off entirely, so turning it off snaps back instantly rather than fading; a matched element gets an explicit `opacity: 1` (not an absent property) so it still carries the transition while *other* elements around it fade in/out.
- `DiagramContext` gained `isolateActive: boolean` and `isolateOpacity: number`, same threading convention as every other global-setting/session-state field already there.
- `Canvas.tsx`'s `clearSearchResults` (already the shared reset point for a cleared/changed query, and for closing the overlay) now also resets `isolateActive` — Isolate has no meaning once its underlying match set is gone, so it's cleared at exactly the same points searchMatchIds is.
- `LineNode`/`AnchorNode` are not wired into either `searchMatchIds` matching-display or `isolateStyle` — same pre-existing gap search shipped with (only Shape/Container/Text/edges got the `.search-match` treatment), not something this work expands. A `'line'` node can still technically end up in `searchMatchIds` if its id/label/metadata matches a query, but nothing currently renders that fact.

## Alternatives considered

- **One combined Search+Isolate toggle** — rejected per the user's own pushback; see Decision above.
- **Manual-selection trigger alongside search** — rejected, for the same reasons it was deferred earlier.
- **Hardcoded opacity constant** — rejected; the user explicitly asked for a Setting instead.

## Consequences

- Editing the search query or closing the overlay clears Isolate along with the match set (`clearSearchResults`) — the user must explicitly re-press Isolate after every new search, by design (see Decision). This was a deliberate simplicity choice, not evaluated against an alternative "Isolate persists across re-search" behavior; revisit only if that turns out to be annoying in practice.
- No `.chd` schema change — Isolate is session-only UI state, same as search itself (ADR 0062).

## Addendum (2026-08-26): Isolate is its own trigger, not gated on Search

The initial implementation disabled the Isolate button until a Search had already run with matches — reasoned as "there's nothing to isolate down to otherwise." The user's follow-up rejected that coupling directly: **Isolate should be available from the start and run its own matching**, not depend on Search having been pressed first. The two buttons remain independent actions (per the original Decision above), but "independent" turned out to mean *each* can be the first thing pressed, not that Isolate is downstream of Search.

This also surfaced a second, more important distinction the original design hadn't separated: **the two buttons' viewport behavior differs, not just their dimming behavior.** Search jumps the viewport to one matched element (`focusSearchMatch`, unchanged). Isolate frames the *bounding box of every match at once* (`fitAllMatches`, new) — the natural fit for "scope the view down to a working set," which a single-node jump doesn't serve.

Implementation: the matching computation (free-text/tag + optional deep search) was extracted from `runSearch` into a shared `computeAndSetMatches()`, called by both `runSearch` (then `focusSearchMatch`s the first result) and the new `runIsolate` (then `fitAllMatches` and `setIsolateActive(true)`). `runIsolate` toggles off with no recompute if Isolate is already active — a second click is a plain deactivate, not a re-run. The Isolate button's enabled condition changed from `searchRun && matchCount > 0` to `isolateActive || query.trim().length > 0` (always togglable off; requires a non-empty query to turn on, same bar as the Search button itself).
