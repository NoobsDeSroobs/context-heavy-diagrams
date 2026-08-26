# 0063: "Isolate" — de-emphasize elements outside a working set

## Status
Done, implemented (2026-08-26), on `epic/0063-isolate-mode`, pending live test/merge. `typecheck`/`lint` clean (same 4 pre-existing baseline errors, no new warnings in touched/new files). Originally scoped via a real design conversation (2026-08-25) that deliberately left the trigger/UI/rendering questions open until [epic 0062](0062-search-and-highlight-matches.md) (search) shipped — now resolved, see [ADR 0063](../../decisions/0063-isolate-mode.md).

## What shipped
Search-driven only, per the Decision section of ADR 0063 (no manual-selection trigger). A dedicated **Isolate** button sits next to **Search** in `SearchOverlay` — two independent actions, not one combined toggle, per the user's own pushback on the original single-checkbox assumption, and each can be the first one pressed (see the ADR's Addendum): Isolate runs its own matching against whatever query is typed rather than depending on Search having run first. The two also differ in viewport behavior — Search jumps to one matched element, Isolate frames the bounding box of every match at once. Rendering is reduced opacity, defaulting to 50%, exposed as a new global Setting (`isolateOpacity`) rather than hardcoded. Edges get the same treatment as nodes, as predicted. `search.ts`'s `isolateStyle()` is the one shared per-element computation every node/edge component's inline style calls into.

## Goal (revised — this is a different shape than the epic's original framing)
Originally framed as a "dim mode" tied to the highlight system. After a real design conversation, reframed as **"Isolate"**: a general-purpose, session-only mechanism — de-emphasize (most likely reduced opacity) every element *outside* a given working set, whatever produced that set. Deliberately **decoupled from the highlight system**, not built on top of it or living inside it:

- **Highlighting stays purely about color.** Unchanged by this epic.
- **Isolate is a separate primitive**: hand it a set of element ids, everything not in that set dims. It doesn't know or care where the set came from.
- **The intended real trigger is [epic 0062](0062-search-and-highlight-matches.md)'s search** — free text, or matching on a specific tag (usually one), living next to the highlight feature in the UI. This is *why* it's deferred: the user's own stated real use case is running Isolate and a highlight simultaneously, on two *independent* dimensions — e.g. highlight (color) everything matching a GDPR tag, while Isolate (dim everything else) scopes the view down to one owning team, so the same diagram can be re-scoped live to whichever team's in the room without losing the GDPR emphasis. That only becomes real once search's tag-matching exists to drive it.
- **A manual-selection-only trigger** ("select some elements, Isolate them") was discussed and initially favored as a buildable-today v1, but the user reconsidered — see Notes — and asked to defer the whole thing until search lands, rather than ship a manual-only version now.

## Naming
**"Isolate"** — chosen by the user from a shortlist (Focus / Accentuate / Isolate) during the design conversation. Use this term in any future UI copy/menu labels for this feature.

## Real open questions, still not resolved (deliberately — wait for epic 0062 first)
- Exact UI: where "next to the highlight feature" actually means (same popup? a sibling panel? a shared search bar that also feeds highlighting?) — depends on how epic 0062 itself ends up shaped.
- Whether Isolate ever gets a manual-selection trigger *in addition to* the search-driven one, once search exists, or stays search-only.
- Rendering treatment: reduced opacity was assumed throughout this conversation but never explicitly pinned down as final.
- Whether edges get the same treatment as nodes (very likely yes, structurally trivial — the existing `matchingHighlights()`/highlight-rendering machinery already treats both uniformly, and there's no reason Isolate's own filtering would need to differ).

## Notes
Original scoping conversation (2026-08-22) intentionally left this unscoped, flagging real open questions rather than guessing. Picked up 2026-08-25 for a real design pass. Four questions were asked and answered:
1. **Layering vs. replacing existing highlight color** — the user's answer reframed the whole premise: highlighting and dimming should be two *separate* mechanisms, not one mode with two behaviors. This is what led to the "Isolate" reframing above.
2. **Whether the toggle should live in/depend on the Highlights popup** — the user pushed back on this coupling ("doing the same job twice"), reinforcing point 1.
3. **Per-group vs. global scope** — answered somewhat provisionally in favor of something living near the highlights panel, but superseded once the search-driven framing emerged.
4. **Persistence tier** — settled: session-only, no persistence at all (not a Setting, not diagram content) — ephemeral UI state, same tier as `selected`.

A follow-up round then asked what should trigger Isolate for a buildable-today v1 (search doesn't exist yet) and what to call it. Naming settled on "Isolate." The trigger question is where the deferral came from: **the user's own words, reconsidering mid-conversation — "I think we should defer til after this is implemented now that I think about it,"** referring to search (epic 0062). Their fuller reasoning: "the true power comes once we have a 'search' feature... free text search, or define a series of tags to match on... enables me to turn on highlighting of one dimension... while accentuating another... I think we should defer."

**Practical consequence: build [epic 0062](0062-search-and-highlight-matches.md) (search) first.** This epic stays logged and scoped, but not started, until that lands.
