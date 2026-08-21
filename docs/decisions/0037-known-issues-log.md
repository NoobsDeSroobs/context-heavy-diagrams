# 0037: A known-issues log, separate from ADRs and epics

## Status
Accepted

## Context
Requested directly by the user (2026-08-22), right after epic 0039 shipped with an unusually long chain of real bugs (five dated revisions in [ADR 0036](0036-connection-point-count-and-transfer.md) alone). Their framing: "please keep a file somewhere under documentation of previously found bugs and challenges... a record where we can easily find a solution or important info if a similar or the same problem pops up again." Distinct from what already exists:
- **ADRs** (`docs/decisions/`) record a *design decision* — what was chosen, alternatives, why. A bug fix sometimes has real design content (epic 0039's did) and gets an ADR of its own, but plenty of real, hard-won bugs don't involve a design choice at all — just a wrong assumption, a library quirk, a race condition.
- **Epic docs** (`docs/planning/epics/`) track a unit of *planned work* to completion. Bugs found and fixed *during* an epic get folded into that epic's own Notes/Verification section, but epics aren't a lookup surface — finding a specific past bug means remembering which epic it happened under.

Neither is optimized for "does this look familiar?" — a symptom-first, cross-epic lookup.

## Decision
A single file, `docs/known-issues.md`, not a directory of one-per-bug files (unlike ADRs/epics) — bug write-ups here are meant to be short enough that one flat, searchable/greppable file stays usable, and the user asked for "a file," not a directory. Each entry:
- **Status**: `Solved`, `Worked around`, or `Open` (with a documented direction to revisit, not just "known and ignored").
- Symptom, root cause (often the interesting part — many of these turned out not to be what they first looked like), and resolution.
- Links back to the epic/ADR/source file where the real detail lives — this file is a lookup index and summary, not a duplicate of the full investigation.

Populated retroactively at creation time with the real, hard-won bugs from this project's history so far (epic 0013's `updateNodeInternals` gap, epic 0039's five-round chain, epic 0043's drag-and-drop dead zone, epic 0046's reconnect-priority investigation, epic 0040's HSV-to-Oklab revision and its still-open "negative image" feeling) — not started empty, since the user's own framing ("previously found") was explicitly retrospective.

Maintenance is opportunistic, not a checklist item on every epic: add an entry when a bug takes real investigation to track down or reveals a recurring class of failure, not for routine typos/typechecks caught immediately.

## Alternatives considered
- **Fold bug write-ups into ADRs only.** Rejected — plenty of real bugs (the `updateNodeInternals` gap, the drag-and-drop dead zone) have no real design alternative to weigh, so forcing them into an ADR's Decision/Alternatives-considered shape would be awkward. The two document different things: an ADR justifies a choice, this logs a symptom-to-resolution lookup.
- **One file per issue, mirroring the ADR/epic convention.** Rejected — the user asked for "a file," and most entries here are short enough (a few paragraphs) that a directory of one-liners-in-their-own-file would be more overhead than value, unlike ADRs/epics which regularly grow to real length.
- **A GitHub Issues label or external tracker.** Rejected for the same reason [ADR 0002](0002-planning-structure.md) already rejected it for planning: ties recoverability to an external service, which this project's persistence rule is explicitly avoiding.

## Consequences
- `CLAUDE.md`'s persistence-rule file list gains `docs/known-issues.md`.
- No new automated enforcement — like ADR discipline itself, keeping this current is a habit, not something the app or CI checks.
