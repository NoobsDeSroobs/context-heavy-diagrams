# 0072: Search by icon

## Status
Decided and implemented (2026-08-28), on `epic/0094-search-by-icon`. Extends [ADR 0062](0062-search-scope-and-matching.md)'s search. Live test in Electron pending.

## Context

[ADR 0062](0062-search-scope-and-matching.md)'s search matches free text against label / id / tag / (optionally) detail notes. It has no way to answer the question the user actually kept hitting on the 70-node Meridian Rail landscape: *"I know we're using database X — find every shape that carries the database-X icon."* Icons are a primary visual channel in these diagrams (up to four per node, built-in or custom-uploaded), and nothing searched them.

Two same-day follow-ups during scoping (2026-08-27) settled the shape of it before this ADR: match on **icon identity via a visual picker**, not a typed icon name; **auto-run on pick**; **no combining** with the text query in V1.

## Decision

**Trigger: a visual picker, not free-text name matching.** An icon button sits in `SearchOverlay` between the query field and the Search button. Clicking it opens the same icon-browsing UI used to add an icon to a node — browse/search the built-in set and this diagram's custom icons, click one. This mirrors the user's own framing ("*the* database X icon" = point at a known icon) far more directly than recalling what an icon is named, and it sidesteps the built-in-vs-custom asymmetry entirely (a custom icon has no meaningful "name" to type).

**Matching is exact identity.** Every icon slot stores either a built-in id or a custom icon's relative asset path (`IconRef`, both plain strings). "Same icon" is exact equality on the `(source, id | path)` pair against each node's up-to-four slots — no fuzzy text matching, no name lookup. `iconRefKey` / `nodeHasIcon` in `search.ts`.

**Icon search is its own one-dimension search — it replaces the text query, doesn't combine with it.** Picking an icon clears the text box and makes it read-only (read-only, not disabled, so it stays focusable — Enter / Shift+Enter must keep cycling through matches the same as a text search); clearing the icon (the ✕ on the button) makes it editable again. No implicit AND/OR between "icon X" and "label contains Y". Per [ADR 0062](0062-search-scope-and-matching.md), all criteria-combining is deferred to a future real query language, which is now understood to eventually cover icon criteria the same way it'll cover `metadata:*python*`-style field scoping — rather than hand-rolling a combiner for this one pair now.

**Auto-run on pick.** Choosing an icon immediately runs the search and frames the first hit, consistent with the node "Add icon" flow closing itself on pick. The Search button and Enter still re-run; next/prev, Isolate, and match styling all work unchanged over the resulting match set.

**Nodes only.** Edges carry no icons (only nodes' `data.icons`), so icon search skips edges and deep (details-file) search — neither applies.

**Match rendering folds into the existing search-match treatment** (same dashed outline / edge glow), not a distinct "matched via icon" style. Since only one criterion runs at a time, there's nothing to disambiguate.

**Shared component: `IconBrowser`.** The search box + built-in grid + custom-icon grid are extracted from `IconPicker` into `IconBrowser`. `IconPicker` wraps it with the corner selector and assign/remove actions; `SearchOverlay`'s popup wraps it bare. CSS for the shared inner parts renamed `.icon-picker-*` → `.icon-browser-*`; `.icon-picker` (shell), `.icon-picker-actions`, and `.corner-picker*` stay on `IconPicker`.

## Alternatives considered

- **Type an icon name** (match a typed word against built-in icon ids) — the originally-drafted approach. Dropped: only works for built-ins, requires recalling ids, and the picker resolves the real use case more directly. Not worth building both.
- **Add a `mode` prop to `IconPicker`** instead of extracting `IconBrowser` — rejected: `IconPicker` would grow two personalities (corner selector shown/hidden, two different action rows) for no gain over a clean subcomponent split.
- **A distinct match style for icon matches** — rejected as premature: meaningful only once icon and text criteria can be combined, which is explicitly deferred.
- **Combine icon + text into one match set** (`icon AND label`) — rejected per [ADR 0062](0062-search-scope-and-matching.md); this is the future query language's job, not a one-off special case.

## Consequences

- No `.chd` schema/version changes — icon search is transient session state, identical to [ADR 0062](0062-search-scope-and-matching.md) in that respect. `docs/file-format.md` unaffected.
- `IconBrowser` is now the place to change icon-browsing behavior (grid size, custom-icon loading, search) for both callers at once.
- The future query-language enhancement logged in [ADR 0062](0062-search-scope-and-matching.md) now explicitly owns icon-criteria combining too.
