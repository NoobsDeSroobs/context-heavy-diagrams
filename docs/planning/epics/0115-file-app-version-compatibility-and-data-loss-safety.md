# 0115: File/app version compatibility and data-loss safety

## Status
Not Started — logged 2026-09-08 at the user's request. Nothing is broken
today (format is still `version: 1`, every change so far additive, and there
is no external user base), but this must be solid **before** `.chd` files
written by one app version are opened by another in someone else's hands —
i.e. before the first real public release ([epic 0053](later/0053-installable-distribution.md)
Phase 2 / [epic 0070](later/0070-public-release-under-new-identity.md)).

## Goal
When a `.chd` file and the app opening it are version-mismatched badly enough
that a correct round-trip can't be guaranteed, the user must:
1. be told **clearly and specifically** (not a generic parse error),
2. be told **which app version to download**, and
3. **never** have the app silently drop or mangle data it didn't understand.

Plus a **fallback that keeps the original file intact** when a load looks risky.

## The two mismatch directions

1. **Newer app, older file** — the safe direction today. [ADR 0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)
   and [ADR 0086](../decisions/0086-fail-safe-default-resolution.md) make it a
   standing rule; `examples/hello-world.chd` is a live proof. This epic's job
   here is mostly *keeping* it working — a regression guard, and confirming
   ADR 0086's "resolve to the full default path" holds for every field.

2. **Older app, newer file** — the dangerous direction:
   - **(a) Additive-only newer file** (format `version` still `1`). The old app
     opens it, doesn't know the new fields, the user edits and saves → **the new
     fields are silently gone.** Invisible. This is the core hazard.
   - **(b) Breaking newer file** (format `version` bumped). The old
     `parseDiagram` rejects `version !== 1` outright → the file won't open at
     all, with a generic message and no guidance on what to do.

## Candidate mechanisms (not decided — for the design pass)

- **Stamp the writing app version** in the file (`savedWith` / `generator`,
  e.g. `"context-heavy-diagram-tool 0.4.2"`). Cost: churns the file (and its git
  diff) on every save. Mitigation to weigh: only rewrite it when it actually
  changed since the last load, vs. accept the churn as the price of traceability.
- **A `minAppVersion` field** the writer sets when it uses a feature older apps
  can't safely round-trip. An old app reading a file whose `minAppVersion`
  exceeds its own version knows to warn even when the format `version` still
  matches.
- **Tie format `version` to app-version ranges** — a compatibility table in
  `docs/file-format.md` mapping each format version to the first app version that
  reads it, so "download ≥ X.Y" is always derivable.
- **Preserve-unknown-fields round-trip** — the strongest anti-data-loss measure
  for additive changes: `parseDiagram` keeps a bag of keys it didn't recognise,
  `serializeDiagram` writes them back untouched. An old app then round-trips a
  newer additive file losslessly despite not rendering the new content. Tension
  with the "plain deterministic JSON, fixed key order" rule (`docs/file-format.md`
  Determinism) — where do unknown keys sort? Bigger change, high value.
- **Risky-load backup** — before the first save over a file that triggered any
  mismatch warning, copy the original to a backup (`<name>.chd.bak` or
  timestamped). Or open such a file read-only until the user explicitly
  acknowledges.
- **"Which version to download" surface** — the app is offline, so there's no
  live release feed. Options: the warning dialog shows the required version
  string plus a docs/releases pointer; or a short bundled compatibility note.
  Ties into distribution ([epic 0053](later/0053-installable-distribution.md)).

## Proposed rules (the user's ask — to be firmed up into an ADR)

1. **Never silently drop data on load+save.** If the app opens a file containing
   structure it doesn't understand, it either preserves that structure verbatim
   on the next save, or it refuses to overwrite the original without an explicit,
   informed user choice.
2. **A version mismatch that risks data loss produces a clear, specific
   message** — naming the app version that wrote the file (or the minimum needed
   to open it correctly) and where to get it. Never a bare parse error.
3. **The original file stays recoverable** — a risky load makes a backup before
   the first overwrite.
4. **Format `version` bumps are rare and deliberate** — only for a breaking
   change to an existing field's meaning; additive fields never bump it (existing
   convention, `docs/file-format.md`). Every bump updates the compatibility table
   and ships with load-time guidance for older apps.

## Relationship to existing decisions
- **Extends [ADR 0029](../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)**
  with the forward (older-app / newer-file) direction it doesn't cover.
- **Applies [ADR 0086](../decisions/0086-fail-safe-default-resolution.md)**'s
  "fail-safe, not fail-different" lens to the version-mismatch case.
- Rewrites `docs/file-format.md`'s Versioning section once designed.
- Produces its own ADR and likely a CLAUDE.md rule.
- [ADR 0044](../decisions/0044-app-versioning-scheme.md) already gives a real
  semver + `app:getVersion` to stamp with.

## Tasks
- [ ] Design pass + ADR: which mechanisms (version stamp / `minAppVersion` /
      preserve-unknowns / backup / read-only-on-mismatch), and the exact rules.
- [ ] Implement the load-time mismatch detection + specific user-facing message.
- [ ] Implement the chosen data-preservation mechanism (preserve-unknowns and/or
      refuse-overwrite and/or backup).
- [ ] Regression guard for the newer-app/older-file direction (open every
      `examples/*.chd` + a pre-feature fixture, assert lossless round-trip).
- [ ] Rewrite `docs/file-format.md` Versioning; add the compatibility table.
- [ ] CLAUDE.md rule if the design warrants a standing one.

## Notes
Not scheduled. The single most important property: **no accidental, silent data
destruction on a version mismatch, and always an obvious path to the right app
version.**
