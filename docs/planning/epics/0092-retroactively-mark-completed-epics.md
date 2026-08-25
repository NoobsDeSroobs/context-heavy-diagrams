# 0092: Retroactively mark completed epics with the `x` prefix

## Status
Not Started — deliberately deferred, logged as a TODO

## Goal
[ADR 0061](../../decisions/0061-completed-epic-filename-marker.md) established a `x`-prefix filename convention for epics that are both `Done` and live-tested, applied going forward from 2026-08-25. This epic is the deferred retroactive sweep: apply it to every epic already in that state — the ~30-40 completed epics that predate the convention.

## Tasks
- [ ] Enumerate every epic file whose `## Status` reads `Done` and is confirmed live-tested (not just implemented) — per ADR 0061, that's the actual trigger, not merge status, though in practice most/all merged epics should already qualify
- [ ] Rename each: `NNNN-title.md` → `xNNNN-title.md`
- [ ] Fix every inbound link across the repo to each renamed file — `PROGRESS.md`, other epics' own `## Notes`/cross-references, ADRs, `docs/known-issues.md`, `docs/architecture/*` — a plain path-string find/replace per renamed file should cover it, but needs a full grep pass to confirm nothing's missed, not just the obvious spots
- [ ] Spot-check a handful of renamed files' links actually resolve after the pass

## Notes
Logged 2026-08-25 per the user's own framing — wants this done eventually, explicitly not now. The user also stated a standing expectation while discussing this: **there should be no old epic sitting around marked `Done` that hasn't actually been properly tested** — i.e. this sweep is expected to be close to "every `Done` epic qualifies," not a case where most of them need to be excluded. Worth a quick actual check when this gets picked up rather than assuming that's true, but it's the stated expectation going in.
