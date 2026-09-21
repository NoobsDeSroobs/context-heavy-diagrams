# 0096: A small search query language — ANDed `name:value` terms — over one shared match predicate

## Status
Decided and implemented (2026-09-20). Typecheck/lint/unit tests pass; not live-tested (Electron renderer).

## Context

Search (ADR 0062) matched one free-text substring across id, label and tags; icon search (ADR 0072) was a separate, mutually exclusive mode, and combining criteria was deferred to "a future query language". Reference images (ADR 0069) needed a "has one or more" facet, motivated by a combination: *has a picture AND is tagged GDPR.PII*. And free text can't express "only if it is a **tag**" — a shape merely *named* "Integration", or one whose details file mentions it, matches `integration` but should not match a search for the integration tag. A drill-down search across linked diagrams must apply the very same rules to elements parsed from files that aren't open.

A first cut added a "Has reference images" checkbox; that was rejected because every further facet would be another checkbox.

## Decision

**One search box, whitespace-separated terms, all ANDed.** An element must satisfy every term. There is deliberately **no OR, NOT or grouping** — that is what turns a search box into an expression evaluator; "X or Y" is two searches for now.

| Term | Meaning |
|---|---|
| bare text, or `any:text` | id, label or a tag key/value contains it (everywhere in the element) |
| `label:text` / `id:text` | that field only |
| `tag:text` | a tag's key **or** value contains it |
| `tag:key=value` | one tag whose key contains `key` **and** value contains `value` |
| `has:references`, `has:icon`, `has:details`, `has:link` | the element carries one (aliases such as `has:refs`, `has:notes`) |

- **Free text is unchanged for the plain case.** A run of consecutive bare words is *one* `any` term matched as a single substring — `web server` is a phrase, as before. A `name:value` term ends the run, so `customer label:x db` is three terms (`any:customer`, `label:x`, `any:db`).
- Values may be quoted to contain spaces (`tag:"data class"=pii`). Names are case-insensitive.
- **Unknown `word:` prefixes stay plain text** (a label like "Note: x" still searches). An empty value (`tag:`, `label:""`) or an unknown `has:` value is reported as a problem in the overlay instead of silently matching nothing.
- Substring, case-insensitive matching throughout — including `tag:`. Exact key=value matching stays highlights' job.
- The picked icon (ADR 0072) is still its own control and ANDs with the terms; `has:icon` is the separate "carries any icon".
- Edges have no icons, references, details or links, so `has:` terms and icon criteria exclude them; `tag:`, `label:`, `id:` and free text apply to them.

**One pure predicate.** `search.ts`: `parseSearchQuery` → `SearchCriteria` → `elementMatchesCriteria(criteria, element)`; an empty criteria set matches nothing. `matchesStructuredCriteria` is everything except the `any` terms, so **Deep search** (still the existing checkbox, details of the open diagram) only reads a details file for a node that already passes every in-memory term, and matches when the file supplies each `any` term the node is missing. The drill-down search will call the same function on parsed linked-diagram elements, so a term added here reaches both.

## Alternatives considered

- **A checkbox per facet:** discoverable, but ten facets is ten checkboxes (the point that killed the first cut).
- **A full expression language** (AND/OR/NOT, parentheses, precedence): far more than the need; the simple all-AND rule covers "narrow down", and OR can be added later on top of the same term list if it ever bites.
- **Free text as all-words AND:** order-insensitive and arguably friendlier, but changes today's phrase behaviour; quoted phrases would be needed. Kept the phrase rule.
- **`tag:key:value` with a colon:** collides with the `name:value` separator; `=` matches how highlights write key=value.
- **A scope for "search everywhere except X":** no current need.

## Consequences

- No `.chd` schema change; everything reads existing `data` fields.
- The search logic now has unit tests (`search.test.mjs`) — before, only the UI exercised it.
- Discoverability: the input's placeholder and tooltip list the terms, and a bad `has:` value shows a hint; a "+ filter" picker that inserts terms is a possible later addition on top of the same syntax.
- `details:` (search only details files) is not built; it belongs with the drill-down epic, where the question of whether bare text also reads details files when searching linked diagrams gets decided. In the open diagram, details remain opt-in through Deep search, because unlike id/label/tags they are not in memory (ADR 0062).
- A literal search for the text `has:references` (or another recognised `name:`) needs quoting tricks or isn't possible; accepted.
- Behaviour change: an icon search now also honours any terms typed in the box, and the read-only-box behaviour in icon mode is unchanged.
