# 0058: An implicit "None" value for required tags

## Status
Done (2026-08-22)

## Goal
Every required tag should have an implicit "not applicable" value available — the user's own framing: "None should not have to be added to the list of options for it to be there, but it should be there such that the highlights and dropdowns can select and target those entities." Two parts:
1. Always-available, without needing to be added to `allowedValues`.
2. The default value for a freshly-created tag, unless the user deliberately sets something else.

## Decisions made
Full reasoning in [ADR 0046](../../decisions/0046-implicit-none-for-required-tags.md). Short version: canonical representation is JSON `null` (not a literal `"None"` string) — reuses the schema's existing "`defaultValue` absent means `null`" slot rather than a competing sentinel. Universal, no per-tag opt-out. `"None"` is a display-only label; the stored value is always real `null`.

Turned out smaller than the epic's own open questions suggested once traced through the actual code:
- **Goal #2 was already true.** `seedMetadata` already falls back to `def.defaultValue ?? null` — a freshly created tag with no explicit default was already seeding elements with `null`. Nothing to build there.
- **The only real gap**: `isValidForTag` rejected any non-string value whenever `allowedValues` was set, including `null` — so a deliberately-`null` element on a tag with both a real `defaultValue` and `allowedValues` got silently reset back to the real default on the next sync. That's exactly the scenario that forced the user's original manual `"None"`-string workaround on the Meridian Rail landscape.
- **`lockedStatic` needed no change** — it never went through `isValidForTag` in the first place.

## Tasks
- [x] `Canvas.tsx`'s `isValidForTag` — `null` always valid, checked before `allowedValues`.
- [x] `MetadataSection.tsx` — every `allowedValues` dropdown always includes a `None` option (`value="null"`, round-trips through the existing `stringifyValue`/`parseValue` pair unchanged); new file-local `displayValue` helper renders `null` as "None" in the dropdown, the `lockedStatic` span, and the free-text fallback.
- [x] `HighlightsPanel.tsx`'s existing `stringifyValue` renders `null` as "None" — no other change needed, highlight matching already worked off raw `JsonValue` equality.
- [x] `RequiredTagsPanel.tsx` hint text mentions the implicit None value.
- [x] `docs/file-format.md`'s Required tags section documents the always-valid-`null` rule as a real format contract.
- [x] `npm run typecheck` clean; `npm run lint` shows the same 4 pre-existing errors (epic 0028), zero new ones.

## Notes
Not independently verified in the running app — same Electron-only-`window.api` limitation as recent epics. Worth a look: a `lockedEditable` tag with both `allowedValues` and a real `defaultValue` set, picking "None" from an element's dropdown, then reloading the diagram (or editing the template) to confirm it survives sync instead of resetting back to the real default. Also worth checking whether the Meridian Rail landscape's existing manual `"None"`-string workaround (epic 0022's 13th round) is worth migrating to real `null` now that this exists properly — not done as part of this epic, flagged for a separate pass since it's gallery content, not an app feature.

Directly sets up [epic 0055](0055-required-tags-allowed-values-list-editor.md)'s planned default-value dropdown — once built, it should offer this same `None` option without it being a real row in the allowed-values list underneath.
