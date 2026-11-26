# 0208: ADR cleanup: keep the decisions that set direction

## Status
In progress. Logged 2026-11-26. 15 removed first, then the whole remove list (110) after the maintainer's go (2026-11-26): 200 ADRs became 47 (0053, 0126, 0128 and 0147 came back after a second look, 0126, 0128 and 0147 reworded as principles; 0128 then folded into the first merge, below). The merges and the trimming of 0188 are left.

## Goal
The ADRs have grown to 200 with many small, reversible choices (a handle size, a menu item, a gesture). Keep the ones that are hard to reverse or set the design direction, drop the history and the tweaks, and merge the ones that are one decision spread over several files.

## The bar (the maintainer, 2026-11-26)
An ADR holds a principle, a foundational philosophy, a choice that was hard to make (such as the BPMN ones) or a critical decision that sets the direction of the application as a whole. Good: "the app is offline and private by default"; "the person is the focus and the tool exists to help them". Bad: "a label position is a number from 0 to 1"; "the tool may not query a server" (that is how the principle is enforced, not the principle). The file format spec ([docs/file-format.md](../../file-format.md)) already decides what can be designed, so a field, a gesture, a preference or a rule of how a feature behaves is not an ADR; it lives in the spec, the completed-epics entry, the changelog or the code comment. An amendment is folded into the ADR it amends.

This is stricter than a first pass that would keep anything security, offline or format related. Under this bar even those need a second look: keep the principle (offline, private, the person decides, the format is open), fold the enforcement into it.

## Done
- **Removed, small or replaced (15):** 0003, 0007, 0009, 0015, 0038, 0041, 0042, 0058, 0061, 0065, 0070, 0076, 0087, 0129, 0152. Citations in code and docs repointed or dropped; the Electron postinstall note moved to known-issues.

## Plan (a draft for the maintainer, from titles, first lines and where each is cited; 184 ADRs are left)
- **Keep (41, plus the merged 0040):** 0005 0008 0011 0012 0016 0017 0018 0019 0022 0023 0025 0029 0031 0033 0052 0053 0054 0055 0080 0082 0086 0103 0106 0109 0110 0111 0112 0113 0115 0118 0120 0124 0125 0126 0142 0147 0151 0169 0175 0179 0188. Decided with the maintainer (2026-11-26): 0019 is rewritten as the principle that the canvas is an infinite, unstructured, flat surface and an element is only relative to other elements (snap-to-shape follows from it); 0033 as the principle that a diagram must be legible without its author, so the legend carries how to read it inside the file; 0120 stays because it sets how the repository's work is kept over time; 0179 stays and says it is kept for transparency; 0188 is cut down to its decision core (feature detail moves to docs/icon-packs.md); 0017 stays as it is.
- **Merge, each group into one ADR (36 into 9):**
  - ~~change detection and unsaved work: 0040, 0091, 0092, 0128, 0159~~ done (2026-11-26): one ADR under 0040
  - ~~assistant tooling: 0138, 0148, 0150, 0161, 0171, 0172, 0174, 0177, 0182, 0187, 0199~~ done (2026-11-26): one ADR under 0138
  - ~~review of changes: 0132 to 0137, 0153~~ done (2026-11-26): one ADR under 0132
  - ~~diagram metamodel: 0131, 0143, 0144, 0145~~ done (2026-11-26): one ADR under 0131
  - ~~visibility sets and stories: 0194, 0195~~ done (2026-11-26): one ADR under 0194
  - ~~BPMN family: 0193, 0198, into 0080~~ done (2026-11-26): one ADR under 0080, with 0180 folded in (it was on the remove list; the maintainer ruled it is the same principle: behaviours are verbs, entities nouns)
  - ~~releases: 0139, 0162, 0165, 0166~~ done (2026-11-26): one ADR under 0139
  - ~~tags and highlights: 0026, into 0025~~ done (2026-11-26): one ADR under 0025
  - ~~containers: 0075, into 0012~~ done (2026-11-26): one ADR under 0012
- **Decided with the maintainer (2026-11-26):** the 12 that were open are placed above: kept 0017, 0019 (rewritten), 0033 (rewritten), 0120, 0179, 0188 (cut down); merged 0040 and 0161 into groups; removed 0001, 0114, 0121 (its one lasting note moves to 0111) and 0167 (its mapping table and loss list move to a doc page).
- **Remove (105), a feature rule, a gesture, a preference or history:** 0001 0002 0004 0006 0010 0013 0014 0020 0021 0024 0027 0028 0030 0032 0034 0035 0036 0037 0039 0043 0044 0045 0046 0047 0048 0049 0050 0051 0056 0057 0059 0060 0062 0063 0064 0066 0067 0068 0069 0071 0072 0073 0074 0077 0078 0079 0081 0083 0084 0085 0088 0089 0090 0093 0094 0095 0096 0097 0098 0099 0100 0101 0102 0104 0105 0107 0108 0114 0116 0117 0119 0121 0122 0123 0127 0130 0140 0141 0146 0149 0154 0155 0156 0157 0158 0160 0163 0164 0167 0168 0170 0173 0176 0178 0181 0183 0184 0185 0186 0189 0190 0191 0192 0196 0197.
- A few of these keep a short reason somewhere else first: 0099 and 0164 (Alt on Linux) are already in known-issues; 0163 (a transparent highlight leaves an element out) and 0181 (file names cut by bytes) go into docs/file-format.md before they go.
- After the merges about 51 ADRs would be left, from 200.

## Method
- A code comment cites an ADR by number ([CLAUDE.md](../../../CLAUDE.md)). Before an ADR goes, search `src/`, `extension/`, the CLI, the docs and the skill for its number and repoint each citation to the ADR that carries the decision, or drop the comment where it only restates the code. The script that drops markdown links to a removed ADR and tidies the sentence is throwaway; read its diff.
- A decision that goes but still explains something odd moves to [known-issues](../../known-issues.md) or the changelog, in a line.
- Do the removals first (no merging), then the merges one group at a time, so each commit is small.
- **Numbering (decided 2026-11-26): leave the gaps.** Numbers are permanent: not compacted (2,199 citations, 72 changelog links and 259 commit messages use them) and not reused (an old reference would silently point at a different decision). A merged ADR keeps the lowest number of its group. No list of removed ADRs; `docs/decisions/README.md` says how to find one in git. Before each batch, check `CHANGELOG.md` for links to the ADRs going and drop the link, keeping the sentence.

## Open questions
- Change the CLAUDE.md line "a change that makes a real design choice gets an ADR, not only the big ones" and the intro of docs/decisions/README.md to the bar above. It is the maintainer's rule; to be decided with him.
- ~~Whether a merged ADR keeps the old numbers in its text.~~ Decided (2026-11-26): one line naming what it replaces, no more.

## Tasks
- [x] Decide the bar. [x] The CLAUDE.md wording: the `docs/decisions/` line and the first sentence of "Decision records" now state the bar (the "propose and wait for a yes" rule stays private, in CLAUDE.local.md).
- [x] Read the ADRs the first pass only judged by title and fix the lists (0085, 0099, 0155, 0156, 0163, 0164, 0181: all remove).
- [x] Remove the first 15, repointing citations.
- [x] The maintainer reviews the plan above (keep, merge, decide, remove): the 12 open ones were decided together, the rest went through as listed.
- [x] Remove the rest, repointing citations: links and "(ADR NNNN)" parentheses dropped from code comments (comment-only commit), the changelog, docs, epics and the AI skill files; where a comment only pointed at the ADR the sentence now stands on its own. 0001, 0114, 0121 and 0167 had their facts moved first (0111, `docs/architecture/export.md`).
- [x] Merge the groups, one at a time (change detection and unsaved work is done, as 0040, assistant tooling, as 0138, review of changes, as 0132, the diagram metamodel, as 0131, visibility sets and stories, as 0194, the BPMN family, as 0080, releases, as 0139, tags and highlights, as 0025, and containers, as 0012; all nine groups done).
- [x] Update `docs/decisions/README.md` (the bar, and what is not an ADR).
