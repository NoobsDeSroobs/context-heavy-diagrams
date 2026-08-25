# Planning: epics & tasks

See [docs/decisions/0002-planning-structure.md](../decisions/0002-planning-structure.md) for why this structure was chosen.

## Epics

One file per epic in `epics/`, named `NNNN-short-title.md`, numbered sequentially in the order they were defined (not necessarily execution order — check status).

**Once an epic is both `Done` and live-tested, rename its file with an `x` prefix** (`x0063-isolate.md`) — see [ADR 0061](../decisions/0061-completed-epic-filename-marker.md). Sorts it to the bottom of a plain alphabetical file listing without changing the epic's own number or how it's referenced in conversation/docs. Not merge status — plenty of epics sit `Done`, not yet merged, for a while; the marker specifically means "confirmed working."

```markdown
# NNNN: Title

## Status
Not Started | In Progress | Done | Blocked

## Goal
One or two sentences: what this epic delivers and why.

## Tasks
- [ ] A concrete, checkable step
- [ ] Another one
- [x] A completed one

## Notes
(optional — only if there's context worth keeping: decisions made mid-epic, things deferred, gotchas hit)
```

## Tasks

Tasks are checklist items inside their epic's file, not separate files. If a task turns out to need its own extended notes or discussion, promote it: give it a `## Task: <name>` subsection in the epic file (or its own file if it's substantial enough), and note the promotion in the epic's `## Notes`.

## Current status

See [PROGRESS.md](../../PROGRESS.md) at the repo root for the current at-a-glance pointer (active epic/task). This folder is the full backlog; `PROGRESS.md` is just "where are we right now."
