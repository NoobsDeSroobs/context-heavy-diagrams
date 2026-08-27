# 0061: Completed-epic filename marker

## Status
Accepted

## Context
`docs/planning/epics/` is a flat, growing folder — 90+ files at time of writing, numbered sequentially by when each was *defined*, not by execution order or status (see [ADR 0002](0002-planning-structure.md)). A plain file-explorer view of the folder mixes finished epics in with active/backlog ones with no visual triage possible without opening each file to read its `## Status` header.

## Decision
A completed epic's filename gets an `x` prefix — `xNNNN-title.md` rather than `NNNN-title.md` — once it is **both `Done` and live-tested** by the user. Not merge status: this repo's own convention already distinguishes "Done" (implemented, `typecheck`/`lint` clean) from "merged to master," and plenty of epics sit in a `Done, not yet live-tested/merged` state for a while. The marker specifically means "confirmed working, nothing left to check" — which in practice tends to line up closely with merge in this project's actual workflow (the user typically tests before merging), but the rule is stated against *tested*, not *merged*, since those aren't always the same moment.

The epic number itself is unchanged — `xNNNN-title.md` is still "epic NNNN" in conversation and cross-references, exactly as before. Only the filename (and therefore every link to it) changes.

**Mechanism**: a plain ASCII prefix, not a subfolder. `x` sorts after every digit in a standard alphabetical file listing, so `x`-prefixed files cleanly fall after every still-numbered one — confirmed to actually achieve "sorts to the bottom" in a typical explorer view. A `done/` subfolder was considered and rejected: folder-grouping behavior varies by explorer/view settings (some always float folders to the top regardless of name), so it doesn't reliably land where wanted the way a pure alphabetical prefix does.

## Rollout
**Going forward only, for now** — newly-completed epics get the `x` prefix as they land. Applying this *retroactively* to the ~30-40 already-completed epics is wanted eventually but is its own bulk operation (rename + fix every inbound link across `PROGRESS.md`, other epics' Notes, ADRs, `known-issues.md`) — logged as its own deferred task, not done now.

## References
[ADR 0002](0002-planning-structure.md) (the epics-folder structure this amends), [docs/planning/README.md](../planning/README.md).
