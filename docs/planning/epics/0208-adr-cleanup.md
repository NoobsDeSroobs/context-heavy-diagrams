# 0208: ADR cleanup: keep the decisions that set direction

## Status
In progress. Logged 2026-11-26. First batch of 15 removed (2026-11-26); the plan below waits for the maintainer's look before the next removals.

## Goal
The ADRs have grown to 200 with many small, reversible choices (a handle size, a menu item, a gesture). Keep the ones that are hard to reverse or set the design direction, drop the history and the tweaks, and merge the ones that are one decision spread over several files.

## The bar (the maintainer, 2026-11-26)
An ADR holds a principle, a foundational philosophy, a choice that was hard to make (such as the BPMN ones) or a critical decision that sets the direction of the application as a whole. Good: "the app is offline and private by default"; "the person is the focus and the tool exists to help them". Bad: "a label position is a number from 0 to 1"; "the tool may not query a server" (that is how the principle is enforced, not the principle). The file format spec ([docs/file-format.md](../../file-format.md)) already decides what can be designed, so a field, a gesture, a preference or a rule of how a feature behaves is not an ADR; it lives in the spec, the completed-epics entry, the changelog or the code comment. An amendment is folded into the ADR it amends.

This is stricter than a first pass that would keep anything security, offline or format related. Under this bar even those need a second look: keep the principle (offline, private, the person decides, the format is open), fold the enforcement into it.

## Done
- **Removed, small or replaced (15):** 0003, 0007, 0009, 0015, 0038, 0041, 0042, 0058, 0061, 0065, 0070, 0076, 0087, 0129, 0152. Citations in code and docs repointed or dropped; the Electron postinstall note moved to known-issues.

## Plan (a draft for the maintainer, from titles, first lines and where each is cited; 184 ADRs are left)
- **Keep (32):** 0005 0008 0011 0012 0016 0018 0022 0023 0025 0029 0031 0052 0054 0055 0080 0082 0086 0103 0106 0109 0110 0111 0112 0113 0115 0118 0124 0125 0142 0151 0169 0175.
- **Merge, each group into one ADR (34 into 9):**
  - change detection: 0091, 0092, 0159
  - assistant tooling: 0138, 0148, 0150, 0171, 0172, 0174, 0177, 0182, 0187, 0199
  - review of changes: 0132 to 0137, 0153
  - diagram metamodel: 0131, 0143, 0144, 0145
  - visibility sets and stories: 0194, 0195
  - BPMN family: 0193, 0198, into 0080
  - releases: 0139, 0162, 0165, 0166
  - tags and highlights: 0026, into 0025
  - containers: 0075, into 0012
- **Decide with the maintainer (12):** 0001 build tooling, 0017 node as one draggable entity, 0019 snap to shape, 0033 legend design, 0040 dirty tracking and autosave, 0114 product name, 0120 completed epics index, 0121 history rewrite (CLAUDE.local.md cites it), 0161 layout check judges edges as drawn, 0167 draw.io export, 0179 React Flow credit, 0188 icon packs.
- **Remove (106), a feature rule, a gesture, a preference or history:** 0002 0004 0006 0010 0013 0014 0020 0021 0024 0027 0028 0030 0032 0034 0035 0036 0037 0039 0043 0044 0045 0046 0047 0048 0049 0050 0051 0053 0056 0057 0059 0060 0062 0063 0064 0066 0067 0068 0069 0071 0072 0073 0074 0077 0078 0079 0081 0083 0084 0085 0088 0089 0090 0093 0094 0095 0096 0097 0098 0099 0100 0101 0102 0104 0105 0107 0108 0116 0117 0119 0122 0123 0126 0127 0128 0130 0140 0141 0146 0147 0149 0154 0155 0156 0157 0158 0160 0163 0164 0168 0170 0173 0176 0178 0180 0181 0183 0184 0185 0186 0189 0190 0191 0192 0196 0197.
- A few of these keep a short reason somewhere else first: 0099 and 0164 (Alt on Linux) are already in known-issues; 0163 (a transparent highlight leaves an element out) and 0181 (file names cut by bytes) go into docs/file-format.md before they go.
- After the merges about 41 ADRs would be left, from 200.

## Method
- A code comment cites an ADR by number ([CLAUDE.md](../../../CLAUDE.md)). Before an ADR goes, search `src/`, `extension/`, the CLI, the docs and the skill for its number and repoint each citation to the ADR that carries the decision, or drop the comment where it only restates the code. The script that drops markdown links to a removed ADR and tidies the sentence is throwaway; read its diff.
- A decision that goes but still explains something odd moves to [known-issues](../../known-issues.md) or the changelog, in a line.
- Do the removals first (no merging), then the merges one group at a time, so each commit is small.

## Open questions
- Change the CLAUDE.md line "a change that makes a real design choice gets an ADR, not only the big ones" and the intro of docs/decisions/README.md to the bar above. It is the maintainer's rule; to be decided with him.
- Whether a merged ADR keeps the old numbers in its text ("replaces 0132 to 0137") or starts clean. Leaning: one line naming what it replaces, no more.

## Tasks
- [ ] Decide the bar and the CLAUDE.md wording.
- [x] Read the ADRs the first pass only judged by title and fix the lists (0085, 0099, 0155, 0156, 0163, 0164, 0181: all remove).
- [x] Remove the first 15, repointing citations.
- [ ] The maintainer reviews the plan above (keep, merge, decide, remove).
- [ ] Remove the rest, in batches, repointing citations.
- [ ] Merge the groups, one at a time.
- [ ] Update `docs/decisions/README.md`.
