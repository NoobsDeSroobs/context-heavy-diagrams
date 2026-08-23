# 0073: Max connection points per side — move to a diagram override, falling back to the user's Settings default

## Status
Not Started — not yet scoped. Raised 2026-08-23 alongside [ADR 0052](../../decisions/0052-settings-ownership-tiers.md), while mid-implementation of epic 0054.

## Goal
`maxConnectionPointsPerSide` (epic 0039) is currently Settings-only — one value, per person, applied everywhere. Per [ADR 0052](../../decisions/0052-settings-ownership-tiers.md), this is a real constraint on what a diagram can contain (how many connection points an element may carry), not just a display preference: two collaborators with different personal limits could produce a diagram one of them can't fully edit. Add a **Diagram override** (a new `DiagramFile` field) that, when present, is the actual limit for that diagram — falling back to the existing Settings value (now the **User default**) when the diagram doesn't specify one.

## Real open questions (deliberately not resolved here)
- Field name/shape on `DiagramFile`, and whether it's optional (absent = use the Settings default, same "absent means default" convention as the rest of `.chd` — ADR 0029) — not designed.
- Where this gets edited — a new control somewhere diagram-wide (View menu? A new Configuration-focused panel, since this is arguably the first *pure* Configuration value with no existing panel of its own to live in — `requiredTags`/`highlights`/`legend`/`gravityPresets` all have one already)?
- What happens to an existing element whose connection points already exceed a newly-lowered diagram override — does it get clamped, left alone until edited, or blocked with a warning? Not decided.
- `.chd` schema version impact — additive field, likely no version bump needed (ADR 0029), but `docs/file-format.md` needs updating regardless once this is designed.

## Notes
Depends on [epic 0054](0054-os-conventional-settings-storage.md) landing first (or at least its `AppSettings` shape being stable) — the Settings half of this (the User default) shouldn't be redesigned mid-migration.
