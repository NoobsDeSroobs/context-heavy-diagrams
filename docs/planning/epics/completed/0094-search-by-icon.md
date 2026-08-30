# 0094: Search by icon

## Status
Implemented (2026-08-28), on `epic/0094-search-by-icon`. `typecheck`/`lint` clean (0 errors). Live test in Electron pending (custom-icon browsing + IPC need the real app). See [ADR 0072](../../../decisions/0072-search-by-icon.md).

## What shipped
- `IconBrowser` component — the search box + built-in/custom icon grids, extracted from `IconPicker`. `IconPicker` now wraps it with its corner selector + assign/remove actions; `SearchOverlay` wraps it bare in a small popup.
- `SearchOverlay`: an icon button between the query field and Search. Picking an icon clears the text box + makes it read-only (still focusable, so Enter / Shift+Enter cycle matches), shows the icon in the button (active state), auto-runs the search, and frames the first hit. A ✕ on the button clears back to text search.
- `search.ts`: `iconRefKey` + `nodeHasIcon` — exact `(source, id|path)` identity match against a node's up-to-4 icon slots. Nodes only (edges carry no icons); no deep search.
- Icon matches use the existing search-match styling; next/prev, Isolate, Enter-to-cycle all work over the icon match set unchanged.
- CSS: shared inner classes `.icon-picker-{search,scroll,grid,label}` → `.icon-browser-*`; new `.icon-search-popup`, `.search-overlay-icon*`.

## Resolved open questions (from earlier drafts below)
- **Picked-icon presentation**: icon button with an active state + a ✕ to clear (per the user's pick, 2026-08-28).
- **Icon vs text/tag match styling**: folded into the one undifferentiated search-match treatment — only one criterion runs at a time in V1.
- **Text-based icon-name matching**: dropped. The picker resolves the real use case; building both isn't worth it.

## Design direction (2026-08-27 follow-up): a picker, not a typed name

## Goal
Extend [epic 0062](0062-search-and-highlight-matches.md)'s search to match on icon identity, not just label/id/tag/details. The user's own framing: "I know we are using a database of type x, so find all shapes using the database x icon" — given an icon already placed somewhere in the diagram, quickly find every other element carrying that same icon.

## Design direction (2026-08-27 follow-up): a picker, not a typed name

The user's follow-up resolved the main open question below in favor of **identity-based matching via a visual picker, not free-text name matching**: a small icon button at the end of `SearchOverlay`'s query input, opening the same `IconPicker` component already used for "Add icon" on a node (`DiagramContext.openIconPicker`) — browse/select a built-in or custom icon exactly the way you'd add one, except the result drives a search instead of an assignment. This matches the original framing much more directly than typing a name: "we are using *the* database x icon" means pointing at a known icon, not recalling what it's called.

Every icon slot on a node stores either a built-in icon's id or a custom-uploaded icon's relative asset path (`IconRef`, `src/shared/diagram.ts`) — both plain strings, so matching is a straightforward exact-id/path comparison against every node's icon slots once one is picked, no fuzzy text matching needed.

## Resolved (2026-08-27, second follow-up)
- **Auto-run on pick: yes.** Picking an icon runs the search immediately, consistent with `IconPicker`'s existing "Add icon" flow closing itself on pick.
- **No combining logic for V1.** The user's own reasoning: don't build "icon AND label text" (or any include/exclude combination) now — that's explicitly deferred until there's a real structured query language, at which point it'd cover this the same way it'd cover everything else. This is the same deferred idea already logged in [epic 0062](0062-search-and-highlight-matches.md)'s own Design decisions (`metadata:*python*`-style scoping, "deferred, not V1") — that future syntax is now understood to eventually cover icon criteria too, not just metadata fields. Until it exists, picking an icon is presumably its own simple one-dimension search (most likely replacing whatever's in the text box, to avoid an implicit and undesigned AND/OR between the two) rather than a hand-rolled special case of combining just this one pair of criteria.

## Real open questions (as drafted — all resolved, see "Resolved open questions" above)
- How is a picked icon shown once set — a small thumbnail in place of/next to the text input, a chip, something else — and how is it cleared back to a plain text search?
- Should a match be visually distinguished as "matched via icon" vs. "matched via label/tag," or is it fine to fold into the same undifferentiated search-match treatment?
- Text-based icon-name matching (the originally-drafted approach, matching a typed word against built-in icon ids) is now likely unnecessary given the picker resolves the real use case more directly — probably drop it rather than build both, but not explicitly decided either way yet.

## Notes
Raised by the user 2026-08-27, alongside [epic 0090](0090-image-element.md) being re-raised the same day (see that epic's own Notes) — logged without further design discussion initially. Two same-day follow-ups resolved the trigger mechanism (picker, not typed text) and the auto-run/no-combining question — see Design direction and Resolved above — the remaining open questions are cosmetic/presentation details, not real design forks.
