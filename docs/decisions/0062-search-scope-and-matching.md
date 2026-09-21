# 0062: Search scope, matching, and entry point

## Status
Decided (2026-08-26), implementation starting same session. **Amended by [ADR 0097](0097-deep-search-across-linked-diagrams.md) (2026-09-21):** details notes are now part of the default search, and "Deep search" now means drilling into linked diagrams — the opt-in-notes decision below no longer holds.

## Context

Search was raised 2026-08-22 after navigating the 70-node Meridian Rail landscape with no way to locate an element short of scanning by eye, then deliberately deferred — "log this for later, not build it now." It became blocking once Isolate mode's own design pass (2026-08-25) found Isolate needs precise tag-based match sets to be worth building at all, not just free text. Several real open questions were left unresolved: what fields to match, how matches render, live-vs-submit timing, UI placement, and whether search should reach into linked child diagrams.

## Decision

**Matching, V1**: one combined free-text query, substring-matched across label text, element ID, and tag key/value — no per-field syntax yet. A `metadata:*python*`-style query syntax to scope a search to one field is a real, named future enhancement, deliberately deferred until free-text search is live and its limits are felt in practice rather than guessed at up front.

**Details-sublayer deep search is a separate, off-by-default toggle**, not part of the default match set. When enabled, each visible node's detail `.md` file is opened and scanned live (open, substring-check, discard — no index built or maintained). This is a plain boolean contains-check per file, not a ranked or highlighted-within-file result. Reasoning: unlike label/id/tag data, detail content isn't already loaded into memory the way node data is, so folding it into the default match set would mean either building an index (real, unwarranted cost for V1) or silently doing file I/O on every keystroke.

**Query timing is submit-to-search in V1** (search button or Enter), for both modes. Live-as-you-type is logged as a genuine future direction for the free-text/tag fields once proven worth the cost at gallery scale (70+ nodes) — but deep search must never be live-as-you-type regardless of what happens to the rest, since it means opening files on every keystroke.

**Entry point is a `Ctrl+F`-triggered overlay only, no permanent toolbar search box, in V1.** Explicitly provisional — the user asked this be revisited once the app's overall chrome (toolbar, docks, menu bar) is more settled, rather than committing to permanent UI real estate for it now.

**Scope is the current diagram only.** Reaching into linked child diagrams (the "drill-down tree" that linked diagrams make possible) is real but meaningfully harder — it means loading and parsing files that aren't currently open, not just querying in-memory state — so it's split out as its own follow-up, explicitly excluding deep (details) search even there: the user's reasoning is that anything worth finding in V1 should already surface directly in the details panel or diagram itself, and drill-down search is for locating elements in a large or poorly-maintained tree, not for grepping notes across it.

**Match rendering reuses `highlights.ts`'s existing border/fill mechanics but as a visually distinct "search result" style**, coexisting with any active user-defined highlights rather than suspending them — so turning on search doesn't make it look like the user's own highlight groups changed.

**Fit-to-node/selection is in scope here**, per the user's earlier instruction (logged in the epic doc before this ADR) not to split it into its own epic — once a match is selectable, framing the viewport on it is a small, obvious extension of the same interaction.

## Alternatives considered

- **Structured query language from the start** (field-scoped syntax like `metadata:*python*`) — rejected for V1 as premature: the free-text case needs to exist and be used before it's clear which scoping syntax is actually worth the parser complexity.
- **Indexing details content** so deep search could be live and fast — rejected for V1: real engineering cost (index construction, invalidation on file edit) for a feature explicitly scoped as an occasional, deliberate deep-search toggle, not the default path.
- **Toolbar search box as the V1 entry point** — rejected in favor of `Ctrl+F`, on the basis that permanent UI chrome decisions are premature before the rest of the app's layout has settled; a keyboard-triggered overlay commits to nothing.
- **Reusing highlight styling unmodified** for search matches — rejected: would make search results visually indistinguishable from real user-defined highlight groups, which is confusing given the two systems now coexist.

## Consequences

- No `.chd` schema/version changes — search is transient UI/session state, not persisted diagram data, so this ADR is purely about in-app behavior, not the file format.
- Deep search's per-keystroke-safe design (submit-only, no index) means its performance profile is intentionally decoupled from free-text search's — the two can evolve independently (e.g. free-text going live-as-you-type later without dragging deep search along).
- The search and drill-down-search planning docs carry the scoped/deferred breakdown; this ADR is the record of *why*, not the task list.
