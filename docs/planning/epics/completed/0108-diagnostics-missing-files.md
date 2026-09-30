# 0108: Diagnostics — list missing referenced files

## Status

Done — implemented, `typecheck`/`lint`/`build` clean, live-tested and
confirmed working by the user (2026-09-04), including the paste-retargeting
follow-up (ADR 0085). Merged (#87).

## Goal

A "Missing files" section in the Diagnostics panel listing every diagram
element that references a file on disk which no longer resolves — a linked
diagram, a custom icon, a reference image, a details `.md`, or a legend
entry's custom icon. Each row: the owner's label + resource kind (clickable
to select and frame the element on the canvas, for node owners), the failing
path, and a button to remove that one reference from the element.

Started as "broken linked diagrams only"; the user widened it to **all
externally linked resources** after hitting an uncaught
`icons:readAsDataUrl` ENOENT in the console.

## Design — see [ADR 0084](../../decisions/0084-diagnostics-missing-files.md)

- All five reference kinds resolve the same way → shared
  `src/main/linkPaths.ts` `resolveLinkPath` (extracted from windows.ts /
  requiredTags.ts, plus the `\`→`/` split the icon reader already did).
- New IPC `resources:checkExist(diagramPath, relativePaths[])` — bulk
  `fs.access`, deduped by the renderer.
- Scan runs on diagram load + on the panel's existing generic "Recheck"
  button. Async → result in `Canvas` state, stale-guarded, never persisted.
- **Nothing is automatic and a removal reaches disk only on save** (user
  requirement). Per row, three choices: **Dismiss** (session-hide),
  **Relink…** (file picker — `linkedDiagram` / `icon` only), **Remove**
  (*stages* the removal — no mutation; applied in `persistDiagram` on
  save; shown in a "Staged for removal on save" sub-list with Undo).
- `DiagnosticsPanel` gains a typed section above the generic
  `entries: string[]` list. Reveal reuses the select-and-`fitView` helper
  (`revealReferenceOwner` → `revealNode`).
- The View-menu "Diagnostics (N)" count includes undecided missing files +
  staged removals (dismissed excluded).

## Tasks

- [x] `src/main/linkPaths.ts` (shared, separator-normalising
      `resolveLinkPath`); dedupe windows.ts / requiredTags.ts / links.ts.
- [x] `resources:checkExist` IPC + preload `checkResourceFiles`.
- [x] `DiagnosticsPanel`: `MissingFileEntry` type, section, callbacks.
- [x] `Canvas`: `collectResourceRefs` (nodes: linkedDiagram / details /
      custom icons / references; legend: custom icons) +
      `applyMissingFileRemoval`; `missingFiles` / `stagedFileRemovals` /
      `dismissedFileKeys` state + `scanMissingFiles` (stale-guarded);
      `stage`/`unstage`/`dismiss`/`relink` handlers; `persistDiagram`
      applies staged removals on save; load + Recheck wiring;
      `revealReferenceOwner` → `revealNode`; menu count.
- [x] `IconSlotView` swallows a missing-custom-icon read (was an uncaught
      rejection) — the section is where it's surfaced now.
- [x] CSS for the missing-file rows + actions + staged sub-list.
- [x] ADR 0084.
- [x] Paste-time resource-path retarget + rescan-on-paste (2026-09-04
      follow-up, see Notes).
- [x] Live test (Electron renderer — user). Confirmed working 2026-09-04.

## Notes

No `.chd` schema change — reads existing fields only.

Deferred / not done: no filesystem watch or per-edit rescan (Recheck is the
refresh). A missing `details` file is flagged even though `details:read`
already degrades to empty — losing written notes is worth surfacing.
Relink is only wired for the two kinds with a picker; reference/details are
fixed by restoring the file + Recheck.

**2026-09-04 follow-up** — see [ADR 0085](../../decisions/0085-paste-resource-path-retargeting.md)
for the design record; summary here. Found while the user live-tested this
epic against a real project: a diagram in the user's own "Project Overview"
project (outside this repo) had resource paths that looked copy-pasted from
a sibling diagram without adjustment, and Diagnostics didn't flag them when
checked live. Root cause not confirmed (real files weren't available this
session) — logged as its own open item rather than chased blind, see
[known-issues.md](../../known-issues.md#diagnostics-missing-files-check-didnt-flag-a-reported-broken-relative-path-in-real-diagram-data).

Independent of that report, code-reading confirmed a real gap: `remapForPaste`
(`src/renderer/src/clipboard.ts`) regenerates node/edge ids and positions on
paste but always left `icons[slot].path`/`details`/`linkedDiagram`/
`references` untouched, and neither paste nor save triggered a Diagnostics
rescan — only load and the panel's manual Recheck did. So a cross-diagram
paste could silently carry a stale path with nothing telling the user until
the next reload.

Claude's first two proposed fixes — auto-copy the referenced file into the
destination diagram's own colocation folder, and a full path recompute for
`linkedDiagram` (since it can legitimately point anywhere) — were both
rejected by the user: this tool is meant to be git-diffable and
hand-editable, and only the user knows whether a paste is meant to share
files with the source diagram, fork them, or start clean without them.
Auto-copying or auto-relinking bakes in an assumption about which of those
the user meant, the same thing a compiler doesn't do with an unresolved
import — it flags the break and lets the developer decide.

**Landed instead — the user's own proposal, argued through to a design
neither side had first proposed:** relabel, never repair. A resource path
whose leading segment matches the *source* diagram's own file name (this
app's standing colocation-folder default — see `docs/file-format.md`'s
Linking section) gets that segment relabeled to the *destination*
diagram's name on paste; anything else (hand-relinked, absolute, or an
intentional pointer at some unrelated diagram) is left untouched. The key
property that makes this safe rather than presumptuous: it never turns a
broken reference into a resolving one by itself, since the underlying file
is never moved or copied — it only changes *which* equally-broken path
Diagnostics reports. That means it strictly helps the "user copies the
referenced files over to match the convention" case (the path is already
correct once they do, no separate manual Relink needed) while being
completely neutral for "start fresh, don't want the old files" (still
flagged, nothing silently connected either way) — argued through as: if the
intent was to copy the files, this fix removes the need to *also* relink;
if the intent wasn't, nothing is lost since both the old and new label are
equally unresolved.

New `ClipboardPayload.sourceDiagramBaseName` (set at copy time) +
`retargetResourcePath`/`retargetNodeData` (`clipboard.ts`); `remapForPaste`
takes the destination diagram's path and applies the relabel per node.
`pasteFromClipboard` (`Canvas.tsx`) now calls `scanMissingFiles` right after
applying a paste, so a still-broken reference is flagged immediately rather
than waiting on the next load or a manual Recheck. `typecheck`/`lint`
clean. Not live-tested.
