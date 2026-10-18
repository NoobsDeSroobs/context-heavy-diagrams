# 0046: Implicit "None" value for required tags

## Status
Accepted

## Context
Every required tag should have an implicit "not applicable" value, always available without being added to `allowedValues`, so an element genuinely outside a tag's scope (the motivating case: a data-flow edge has no owning team or business domain the way a service does) can say so — targetable by highlights and dropdowns, not just left showing a misleading real default. The user's own workaround before this existed: manually adding the literal string `"None"` to affected tags' `allowedValues` on the Meridian Rail landscape.

Two things already existed in the schema/code that turned out to make this much smaller than it first looked:
- `defaultValue`, when absent, was already documented as "treated as `null`" (`docs/file-format.md`), and `seedMetadata`/`syncElementMetadata` (`Canvas.tsx`) already fell back to `def.defaultValue ?? null` — so a freshly created tag with no explicit default already seeds every element with `null` today. The second goal ("the default for a freshly-created tag is None unless deliberately set otherwise") was **already true**, structurally, before this work touched anything.
- The actual gap was narrower than the original open questions suggested: `isValidForTag` (`Canvas.tsx`) rejects any non-string value whenever `allowedValues` is set — including `null` — so the *only* broken case was a `lockedEditable` tag with both a real `defaultValue` and `allowedValues` set, where a deliberately-`null` element got silently reset back to the real default on the next sync pass. That's exactly the scenario that forced the user's manual `"None"`-string workaround.

## Decision
- **Canonical representation: JSON `null`, not a literal `"None"` string.** `null` was already the schema's existing "no value" slot (`defaultValue` absent → `null`) — reusing it unifies "no default was ever set" and "deliberately marked not-applicable" into the same on-disk value, rather than introducing a second, competing sentinel. It also can't collide with a real tag value someone types as the word "none," which a literal string risks.
- **`isValidForTag` now treats `value === null` as always valid**, before checking `allowedValues` at all. This is the one real fix — everything else asked for either already worked (defaulting) or was a display/UI gap (below).
- **Universal, no per-tag opt-out.** Matches the user's own framing ("many tags... not applicable to all entities no matter what") — no new schema field for a case nobody has actually asked for yet.
- **`lockedStatic` needed no change.** Its reconciliation path (`syncElementMetadata`) never calls `isValidForTag` at all — a `lockedStatic` entry always just takes the template's own `defaultValue` outright, which already supports `null` today via the exact same `?? null` fallback. "None as a default" already just works there; there's no separate per-element choice to make valid in the first place.
- **Display, not schema, for the "None" label.** The stored value is always real `null`; `"None"` only ever appears as rendered text (`MetadataSection.tsx`'s new `displayValue` helper, `HighlightsPanel.tsx`'s existing `stringifyValue`) or as a dropdown `<option>`'s human-readable label. The `<select>`'s underlying `value`/`onChange` round-trip still runs through the existing `stringifyValue`/`parseValue` pair unchanged (`JSON.stringify(null) === "null"`, and `JSON.parse("null") === null`) — the new `<option value="null">None</option>` needed no special-cased parsing logic of its own.
- **`docs/file-format.md` updated** to state the always-valid-`null` rule explicitly, since it's now a real contract a third-party importer/exporter needs to replicate, not just an implementation detail.

## Alternatives considered
- **Literal string `"None"`.** Rejected — see Decision; risks colliding with a real value, and duplicates a concept (`null`) the schema already had.
- **A new schema field to opt a specific tag out of the implicit None.** Rejected — no real, motivating case for it yet; YAGNI.
- **Reworking `lockedStatic` to also route through `isValidForTag`.** Rejected — it already correctly supports a `null` default without going through that function; adding the indirection would be a pure refactor with no behavior change.

## Consequences
- `Canvas.tsx`'s `isValidForTag` short-circuits on `null` before the `allowedValues` check.
- `MetadataSection.tsx`: every `lockedEditable` dropdown (built when `allowedValues` is set) always includes a `None` option; the `lockedStatic` display span and the free-text `EditableLabel` fallback both render `null` as "None" via a new small `displayValue` helper (kept file-local, matching this codebase's existing "small independent copy per file" convention for this exact stringify pattern rather than a shared util).
- `HighlightsPanel.tsx`'s existing `stringifyValue` now renders `null` as "None" everywhere it's already used (highlight row labels, the add-tag picker) — no other change needed, since highlight matching/identity already worked correctly off raw `JsonValue` equality (`highlightId`, `matchingHighlights`) with no string-typed assumption anywhere in that path.
- `RequiredTagsPanel.tsx`'s hint text now mentions the implicit None value.
- `docs/file-format.md`'s Required tags section documents the rule.
- Directly usable by the allowed-values list editor once that's built — its planned default-value dropdown should offer this same `None` option without it needing to be a real row in the underlying allowed-values list.
