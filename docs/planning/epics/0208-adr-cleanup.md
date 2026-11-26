# 0208: ADR cleanup: keep the decisions that set direction

## Status
Not Started. Logged 2026-11-26. Next, once the portals branch is merged.

## Goal
The ADRs have grown to 200 with many small, reversible choices (a handle size, a menu item, a gesture). Keep the ones that are hard to reverse or set the design direction, drop the history and the tweaks, and merge the ones that are one decision spread over several files.

## The bar
An ADR is for a choice that would cost a file-format change, a migration or a rethink to reverse: file format, security, architecture, licence, external contracts, rules the whole project follows. Small reversible choices live in the completed-epics entry, the changelog and the code comment. An ADR is written at the end of an epic, once, per feature; an amendment is folded into the ADR it amends.

## First pass (from titles, status lines, size and where each is cited; about a dozen read in full, the rest to be read before anything goes)
- **Remove, small or one tweak:** 0007 (Electron bump), 0038 (resize handle size), 0041 (cancelled sidebar: one line in 0039), 0042 (selected-edge colour), 0058 (align and distribute), 0065 (select all of type), 0087 (reverse direction on a selection), 0129 (handle minimum size), 0152 (drag a number label), 0070 (now a rule in CLAUDE.md).
- **Remove, replaced and kept "for history":** 0003, 0009, 0015, and 0061 and 0076 (epic filename handling that [0120](../../decisions/0120-completed-epics-collapse-into-an-index.md) replaced; 0120 keeps the definition of "completed").
- **Merge:**
  - change detection: 0091, 0092, 0159
  - assistant tooling: 0148, 0171, 0172, 0182, 0199, and 0174 with 0177
  - review of changes: 0132 to 0137 and 0153
  - metamodel: 0131, 0143, 0144, 0145
  - labels: 0183, 0184
  - visibility sets and stories: 0194, 0195
  - releases: 0139, 0162, 0165, 0166
  - portals: 0200, replaced by the one ADR of the portals epic
- **Read first, then decide:** 0085 (1000 words, cited nowhere), 0099, 0155, 0156, 0163, 0164, 0181.
- **Keep:** the foundations (0005, 0016, 0011), security and offline (0055, 0082, 0109, 0112, 0113, 0115), file-format guarantees (0029, 0086, 0118), 0169, and the standing rules 0151 and 0054.

## Method
- A code comment cites an ADR by number ([CLAUDE.md](../../../CLAUDE.md)). Before an ADR goes, search `src/`, `extension/`, the CLI, the docs and the skill for its number and repoint each citation to the ADR that carries the decision, or drop the comment where it only restates the code.
- A decision that goes but still explains something odd (the Electron postinstall step, for one) moves to [known-issues](../../known-issues.md) or the changelog, in a line.
- Do the removals first (no merging), then the merges one group at a time, so each commit is small.

## Open questions
- Change the CLAUDE.md line "a change that makes a real design choice gets an ADR, not only the big ones" to the bar above. It is the maintainer's rule; to be decided with him.
- Whether a merged ADR keeps the old numbers in its text ("replaces 0132 to 0137") or starts clean. Leaning: one line naming what it replaces, no more.

## Tasks
- [ ] Decide the bar and the CLAUDE.md wording.
- [ ] Read the ADRs the first pass only judged by title and fix the lists above.
- [ ] Remove the small and the replaced ones, repointing citations.
- [ ] Merge the groups, one at a time.
- [ ] Update the ADR list in `docs/decisions/README.md` if it names any removed one.
