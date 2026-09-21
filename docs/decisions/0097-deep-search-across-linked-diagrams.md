# 0097: Notes are searched by default; "Deep search" now means drill down into linked diagrams, and the match lands on the linking shape

## Status
Decided and implemented (2026-09-21). Typecheck/lint/unit tests pass; not live-tested (Electron renderer). Amends [ADR 0062](0062-search-scope-and-matching.md) (details search was an opt-in "Deep search") and follows up [ADR 0096](0096-search-facets-and-shared-match-predicate.md) (which said the linked-diagram search would reuse its predicate and left "does bare text read notes in linked diagrams" open).

## Context

Search covered the open diagram only, and reading an element's details `.md` file was an opt-in "Deep search" because those files aren't in memory. On a large or poorly-maintained diagram tree the user often doesn't know *where* something lives, so search needs to reach into the diagrams the open one links to (linked-diagram navigation, [ADR 0005](0005-diagram-identity-and-linking.md), [ADR 0023](0023-multi-window-diagram-model.md)).

A first cut added a separate "Linked diagrams" toggle and a result list grouped per diagram, where clicking a result opened that diagram's window. That was the wrong shape: the user's model is that search always answers *in the current window*. If a diagram tree has a Server shape whose linked diagram has a component that mentions OAuth, and a Client shape that doesn't, a search for "OAuth" should highlight **the Server shape here** — cyclable with next/prev, isolatable — with no custom dropdown.

## Decision

**Two depths, one checkbox.**

| | Searches |
|---|---|
| **Search** (default) | The open diagram *and its attached files* — id, label, tags, and each element's details `.md` note. |
| **Search + Deep search** | The above, **plus every diagram reachable through the open diagram's links, recursively, and their notes — as deep as the links go.** |

- **Notes are now part of the default search.** Reading a note is fast, and the terms already let the user narrow it (`label:`, `tag:`, `has:` — [ADR 0096](0096-search-facets-and-shared-match-predicate.md)); the earlier reason for keeping it opt-in (avoiding an index or per-keystroke file I/O) doesn't apply because search is still submit-to-run, not live. A note edited in the Details panel but not yet saved is searched from its in-memory copy, not the stale file on disk.
- **The match lands on the linking shape.** With Deep search on, a node in the open diagram that has a `linkedDiagram` also matches when *anything* in its linked subtree does (a node or edge, on the same predicate, with that diagram's notes read relative to that diagram). So results are ordinary matches on the open canvas — highlighted, counted, cycled with next/prev, framed, isolated — and there is no separate result list. Finding the exact element inside is the next step: open the link (Ctrl/Cmd+click) and search there.
- **Same predicate as the open diagram.** The pure match model moved from `src/renderer/src/search.ts` to `src/shared/search.ts` (like the security math), so the main process runs the identical `elementMatchesWithDetails` over parsed linked files and only "which links matched" crosses IPC. Term semantics, `has:` facets and the icon criterion apply unchanged in linked diagrams (a *custom* icon is identified by its path relative to its own diagram, so it effectively only matches within one diagram's asset folder; built-ins match everywhere).
- **Walk** (`src/shared/linkedSearch.ts`, I/O injected, unit-tested): per link of the open diagram, depth-first, stops at the first match; a visited set per link (pre-seeded with the open diagram) makes cycles, links back to the open diagram, and diamonds terminate; each diagram is parsed once per search. A linking node that already matches on its own isn't walked. **Cheapest work first, at every level:** the open diagram is searched (in memory, then notes) before any linked diagram is touched, and inside a linked diagram all nodes/edges are checked in memory, then notes are read, and only then are child diagrams loaded — so the first hit ends the work before the next, costlier step (a further file read, and one day a URL fetch).
- **The links come from the open diagram's in-memory state**, so a link added since the last save is searched; everything below it is read from disk.
- **A linked diagram that can't be read is reported** in the overlay ("N linked diagrams couldn't be read", paths in the tooltip), never silently treated as "no match".
- **No cap or cancel for now.** Local JSON parsing is fast. If a real tree proves slow, add a max-depth setting where `0` means unlimited.
- Deep search needs a saved diagram (links and notes resolve relative to the file); the checkbox is disabled until then.

## Alternatives considered

- **Breadth-first instead of depth-first:** rejected. Terms are largely defined by the layer a diagram sits on, and sibling diagrams on one layer share a term pool — so if the first child misses, its siblings probably do too, and the next new terms are more likely one level down. Depth-first is at least as fast, often faster.
- **A separate result list of matches in other diagrams** (the first cut): rejected by the user — it breaks "search answers in this window" and makes cycling/isolate second-class.
- **Keep notes opt-in under a "Deep search" box and add a second toggle for linked diagrams:** two switches for one intuitive idea of depth; the user wants one.
- **Exclude notes in linked diagrams** (the original epic scope, to keep this to locating elements): dropped — the user's example searches notes, and notes are cheap.
- **Ancestors / whole colocation folder:** only descendants are reached; links are stored on the parent, so "up" needs a reverse index, and the whole folder is a project grep rather than a drill-down.
- **Read linked diagrams in the renderer:** would send whole diagrams over IPC just to test them; matching in main keeps the payload to a list of node ids.
- **Live state of other open windows:** other windows' unsaved edits are not seen (files are read from disk). Accepted; the open diagram, which is what the user is editing, is always live.

## Consequences

- Search does file I/O on every run now (notes), not only under Deep search. Fine at current scale; revisit with an index only if it isn't.
- A match on a linking shape doesn't say *which* linked element matched. If that hurts, a later addition could annotate the shape or offer "open where it matched"; deliberately not built.
- The pure search model is shared between main and renderer; `isolateStyle` (React-only) stays in the renderer's `search.ts`, which re-exports the shared module.
- `Deep search`'s label is unchanged but its meaning moved from "read notes" to "drill down"; its tooltip and the search box's placeholder/tooltip say so.
- No `.chd` schema change.
