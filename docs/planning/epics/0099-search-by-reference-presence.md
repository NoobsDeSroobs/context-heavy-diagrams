# 0099: Search / isolate by reference presence

## Status
Implemented 2026-09-20 (as a query language, not a checkbox) on `epic/0099-search-by-reference-presence` ([ADR 0096](../../decisions/0096-search-facets-and-shared-match-predicate.md)); `typecheck`/`lint`/`npm test` clean, **not live-tested** (Electron renderer). Split off [epic 0090](completed/0090-image-element.md) (2026-08-27, [ADR 0069](../../decisions/0069-reference-images.md)).

## Goal
Make "has one or more reference images" (epic 0090) a matchable facet in the search overlay (epic 0062/ADR 0062), combinable with the existing free-text / tag matching — the user's illustrative example: `hasPicture = true & tag=GDPR.PII`. Since search feeds Isolate (epic 0063), this also makes "dim everything except shapes that carry a reference" work for free.

## Relationship to existing work
- Directly parallel to [epic 0094](completed/0094-search-by-icon.md) (search by icon — find every element carrying a given icon). Both extend epic 0062's matcher with a structured/boolean facet rather than pure substring matching. Worth designing the two together — whatever token syntax (`has:references`, `has:icon`, a structured query) is chosen should cover both.

## Design (resolved — see ADR 0096)
The checkbox first built for this was replaced by a small query language in the one search box: ANDed `name:value` terms (`any:`/bare text, `label:`, `id:`, `tag:` incl. `tag:key=value`, `has:references|icon|details|link`). No OR/NOT/grouping. One pure predicate in `search.ts` shared with the future drill-down search (epic 0093). Epic 0094 (search by icon) is shared at the predicate level; its icon control is unchanged.

## Tasks
- [x] Design (ADR 0096)
- [x] Pure parser + `elementMatchesCriteria` + unit tests (`search.test.mjs`)
- [x] Canvas search runs through it; deep search only reads files for nodes passing the in-memory terms
- [x] Overlay: placeholder/tooltip list the terms; problems (bad `has:` value, empty value) shown
- [ ] Live test: `has:references` alone; `has:references tag:gdpr`; `tag:integration` skips a shape merely named Integration but plain `integration` finds it; `customer label:x db`; `tag:owner=alice` needs both on one tag; a typo like `has:banana` shows the hint; Isolate dims the rest; icon search + a term; Deep search with a term; edges only match `tag:`/`label:`/`id:`/free text
- [ ] Later: `details:` scope and cross-diagram behaviour (epic 0093); optional "+ filter" picker inserting terms
