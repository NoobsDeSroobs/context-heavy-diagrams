# 0029: New features must not break loading of old files, as a standing rule

## Status
Accepted

## Context
While reviewing the gallery diagrams, the user asked whether a `.chd` file predating the tag/metadata system would still load correctly today. Tracing the code confirmed it does — `parseDiagram` only ever required `version === 1` plus `nodes`/`edges` arrays, `fromDiagramFile` falls every newer field back to an empty value, and `syncElementMetadata` handles `undefined` metadata safely. `examples/hello-world.chd`, predating nearly every feature this app now has, is a live proof of this already sitting in the repo.

The user's follow-up made clear the metadata example was illustrative, not the actual scope: the real ask is a **general rule** — every future feature must be built so that a file created before that feature existed still loads, without requiring the user to migrate, edit, or discard old work. This has held true so far by consistent habit (every optional field in `docs/file-format.md` documents "Absent means...") but was never written down as a deliberate constraint future epics are expected to satisfy. Habits erode under time pressure in a way written rules don't.

## Decision
**Loading an old `.chd` file must not fail or silently corrupt data just because it predates a feature, wherever avoidable.** Concretely, for anyone scoping or implementing a new epic that adds a field to the file format:

1. Every new optional field must have a defined, sensible "absent" behavior — decided and written into `docs/file-format.md`'s field table as part of that epic, not left implicit or deferred.
2. The loading/parsing code path must actually implement that fallback (the `?? []` / `?? {}` / conditional-spread pattern already used throughout `fromDiagramFile` and `parseDiagram` is the established idiom — new fields should follow it, not invent a new convention per feature).
3. `parseDiagram` itself stays minimally validating (`version`, `nodes`, `edges` only, a prior decision from the tag/metadata work) — new fields are never added to its required set. A field being *present but malformed* can still misbehave; only a field's *absence* is guaranteed graceful.
4. Before calling a file-format-touching epic done, sanity-check it against an old-style fixture — `examples/hello-world.chd` is the natural default check, being the oldest, most feature-sparse file in the repo — to confirm the new feature doesn't assume the old file has something it doesn't. This is a manual check for now, not a required automated test (see Consequences).

"Wherever avoidable" is deliberate: this is a strong default, not an absolute promise. A future change to an *existing* field's meaning (as opposed to adding a new one) is already covered by `docs/file-format.md`'s own Versioning section — that's what bumping `version` is for, and remains the escape hatch when true backward compatibility isn't achievable.

## Alternatives considered
- **Bump `version` on every new field.** Already implicitly rejected by existing practice — `docs/file-format.md`'s Versioning section already documents years of additive fields with `version` staying at `1` throughout. Revisiting this would mean discarding a convention that's worked, not adopting a new one.
- **Require explicit migration/upgrade tooling for old files.** Heavier than this format needs — `.chd` is a plain-JSON, no-database, no-server format specifically so files stay simple and durable (project brief, `docs/architecture/overview.md`). A "your file needs upgrading" step would work against that. Rejected.
- **Leave it as an unwritten convention.** What was actually happening before this ADR — real, and it held up under a real test (the tag/metadata fields), but nothing forced the next feature to notice it was expected to keep holding up. Rejected per the user's explicit ask for a formal record.

## Consequences
- Every future file-format-touching piece of work inherits an explicit checklist item: define the absent-default, implement it, document it, sanity-check against `hello-world.chd`. Several currently-unscoped features already imply new fields (a diagram legend, a connection-point-count generator if it ends up persisting anything beyond ordinary `ConnectionPoint` entries, edge label position) — whoever scopes those should treat this ADR as a constraint on the design, not an afterthought once building starts.
- `docs/file-format.md`'s Versioning section now cross-references this ADR, so a reader of the format spec — third-party or otherwise — can find the reasoning behind "always additive," not just the observation that it's been true so far.
- This is a manual discipline, not an enforced one — no automated regression suite currently loads old fixtures against new code on every change. Whether that's worth building (a small test harness that loads every file in `examples/` and asserts no throw) is a legitimate follow-up, deliberately left open here rather than scope-creeping this decision into a testing-infrastructure epic.
