# 0093: Drill-down search across linked diagrams

## Status
Implemented on `epic/0093-drill-down-search-across-linked-diagrams` (2026-09-21), `typecheck`/`lint`/`npm test` clean (82 tests), **not live-tested** (Electron renderer) — checklist below. See [ADR 0097](../../decisions/0097-deep-search-across-linked-diagrams.md).

## Goal
Extend [epic 0062](completed/0062-search-and-highlight-matches.md)'s search to reach into linked child diagrams (epic 0009's linked-diagram navigation), not just the currently-open one — useful when a diagram tree is large or not well-maintained enough for the user to already know where something lives.

## Design (settled with the user 2026-09-21)
- **Search** = the open diagram and its attached files (id, label, tags **and each element's details `.md`**). **Deep search** (the existing checkbox) = additionally every diagram reachable through links, recursively, and their notes — as deep as it goes.
- The result is **a match on the linking shape in the current diagram** (highlighted, counted, cyclable, isolatable like any other match) — no result list, no separate toggle. The user's example: Server links to a diagram with a component whose note mentions OAuth; Client doesn't → searching "OAuth" highlights Server.
- Descendants only. No cap for now; if a real tree is slow, add a max-depth setting where `0` = unlimited.
- Reverses this epic's original scope note ("excludes details-sublayer deep search"): notes are searched, because they're fast and the search terms already narrow scope.

## Tasks
- [x] Move the pure search model to `src/shared/search.ts` (renderer `search.ts` re-exports it, keeps `isolateStyle`); tests moved with it
- [x] `elementMatchesWithDetails` — the details-aware predicate, shared by the open diagram and linked ones (+ tests)
- [x] `src/shared/linkedSearch.ts` — per-link depth-first walk, visited set, first-match short-circuit, unreadable-link reporting (+ 6 tests)
- [x] `search:linkedDiagrams` IPC (`src/main/linkedSearch.ts`, preload) — reads via `openDiagramAtPath`, never records recents
- [x] `Canvas.tsx`: one `computeMatchIds` for text + icon search; notes always read (unsaved note edits from the in-memory copy); Deep search adds linked-subtree matches onto linking nodes
- [x] Overlay: Deep search tooltip/enablement reworded; placeholder/tooltip mention notes; "N linked diagrams couldn't be read" indicator
- [x] ADR 0097; ADR 0062/0096 cross-references; architecture overview
- [ ] Live-test (checklist below) — the user's

## Live-test checklist (Windows; Linux unverified — path handling uses `resolveLinkPath`/`path.resolve` only)
1. Plain search for text that appears only in a shape's details note → the shape matches (no checkbox needed).
2. A note edited in the Details panel but not yet saved → searching for the new text matches.
3. Two-level tree: Server links to a diagram whose component's note (or label/tag) has "OAuth"; Client links to one without. Deep search off → nothing; on → Server only, cyclable, Isolate frames it.
4. Icon search with Deep search on → shapes whose linked subtree contains that built-in icon.
5. A cycle (child links back to the parent) and a diamond (two shapes link the same child) → terminate, both diamond shapes match.
6. A link to a missing file → "1 linked diagram couldn't be read", other links still searched.
7. Deep search checkbox disabled on an unsaved diagram.
8. `has:link`, `label:`, `tag:` terms behave the same inside linked diagrams.

## Notes
Logged 2026-08-26, during epic 0062's design pass. The first implementation (a separate "Linked diagrams" toggle plus a per-diagram result list that opened windows) was built and discarded the same day after the user clarified that search answers in the current window; ADR 0097 records why.
