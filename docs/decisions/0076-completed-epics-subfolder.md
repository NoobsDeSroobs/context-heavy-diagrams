# 0076: Completed epics move to a `completed/` subfolder

## Status
Accepted (2026-08-30). Supersedes the mechanism in
[ADR 0061](0061-completed-epic-filename-marker.md) (the `x` filename prefix);
keeps ADR 0061's *definition* of "completed."

## Context

[ADR 0061](0061-completed-epic-filename-marker.md) decided that a completed epic
gets an `x` prefix on its filename (`x0063-isolate.md`) so it sorts to the
bottom of a flat alphabetical listing, and explicitly **rejected a subfolder**
on the grounds that file-explorer folder-sorting behaviour is inconsistent
(some always float folders to the top).

That rollout never happened — the retroactive sweep was deferred
([epic 0092](../planning/epics/0092-retroactively-mark-completed-epics.md)) and
in practice only one or two epics ever got the `x` prefix. Meanwhile
`docs/planning/epics/` has grown past 100 files, ~70 of them completed. Revisiting
it now, the user's call is that a **`completed/` subfolder is the better trade**:

- The primary consumers of this folder are a text editor's file tree, GitHub's
  web view, and `ls` / `git` — all of which group a subfolder cleanly and
  predictably. The "explorer floats folders to the top" concern ADR 0061 raised
  is real but minor, and "completed work sits in a folder at the top" is a fine
  outcome anyway.
- A prefix on 70 files is 70 renames that each still clutter the same listing;
  a folder is one clean split between "live backlog" and "archive."
- `git mv` into a subfolder reads as an archival action in history; a rename
  prefix reads as a typo-fix.

## Decision

**A completed epic's file moves to `docs/planning/epics/completed/`**, keeping
its exact filename (`0063-isolate.md`, no prefix). The epic number and how it's
referenced in conversation and cross-references are unchanged — only its path.

**"Completed" keeps ADR 0061's meaning:** an epic is completed when it is
`Done` **and confirmed working** (live-tested by the user, or — the practical
proxy, since the user tests before merging — merged to `master`). *Not* merely
`Done, pending live test`. A `Done`-but-unmerged-and-untested epic stays in
`epics/` until it's confirmed. `Retired` / `Superseded` / `Cancelled` epics are
also "completed" for filing purposes — they're closed, no further work — and
move too.

**New epics are always created in `epics/`** and moved to `completed/` when they
reach that state — same going-forward discipline ADR 0061 established, just a
`git mv` into a folder instead of a rename.

**The epic-number namespace stays flat across both folders.** Numbers are
assigned in definition order regardless of location (`epics/0104-…` and
`completed/0103-…` coexist); there is never an `epics/completed/` renumbering.

## Retroactive sweep (done in this same change)

Every currently-completed epic moved in one pass, with all inbound links fixed:
- `git mv` for each (preserves history).
- Links **from** a moved epic to `../../decisions/…`, `../../../PROGRESS.md`,
  etc. gain one `../` level; links to a sibling epic that also moved stay
  relative-in-place; links to an epic that stayed gain `../`.
- Links **to** a moved epic from `PROGRESS.md`, other epics, ADRs,
  `docs/known-issues.md`, `docs/architecture/**`, `CLAUDE.md`,
  `docs/planning/README.md` gain `completed/` (or `epics/completed/`).
- `docs/planning/README.md` and [ADR 0002](0002-planning-structure.md) updated
  to describe the two-folder layout.

## Alternatives considered

- **Keep ADR 0061's `x` prefix and just do the sweep** — the status quo the
  decision was, minus inertia. Rejected per the Context above: 70 prefixed files
  in one flat folder is barely more legible than 70 unprefixed ones.
- **A `done/` vs `completed/` vs `archive/` name** — `completed/` chosen as the
  plainest match for the `Done` status value and ADR 0061's existing
  "completed-epic" vocabulary.
- **Separate the closed-without-shipping epics** (`Retired`/`Superseded`/
  `Cancelled`) into their own folder — over-structuring. They're not live
  backlog; `completed/` with their own status line saying why is enough.
- **Move ADR files the same way** — out of scope. ADRs are referenced far more
  densely and rarely go stale the way an epic does; leave them flat.

## Consequences

- One-time large diff (this change): ~70 file moves plus link fixes across the
  docs tree. After it, the split is self-maintaining with a single `git mv` per
  completion.
- `epics/` becomes a readable live-backlog view — roughly 30 files, all
  `Not Started` / `In Progress` / `Blocked` / `Done-pending-confirmation`.
- Any external bookmark to a raw epic-file URL breaks. Acceptable — this repo
  isn't published and the files are found by number, not URL.
- [ADR 0061](0061-completed-epic-filename-marker.md) is now
  "Superseded by 0076" for its *mechanism*; its rationale for having a marker at
  all, and its definition of "completed," still stand.
