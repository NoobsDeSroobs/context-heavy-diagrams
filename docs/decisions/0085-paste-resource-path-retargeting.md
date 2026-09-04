# 0085: Cross-diagram paste of resource paths — relabel, never repair

## Status

Accepted (2026-09-04). Builds on [ADR 0084](0084-diagnostics-missing-files.md)
(the Diagnostics "missing files" check) and [ADR 0075](0075-container-hierarchy-integrity.md)
(`remapForPaste`'s existing id/position remapping).

## Context

A node's `icons[slot].path`, `details`, `linkedDiagram`, and each entry of
`references` are all stored as paths relative to *the diagram file that
owns them* (`docs/file-format.md`'s "Linking and file organization"). The
clipboard copy/paste path (`buildClipboardPayload` / `remapForPaste` /
`parseClipboardPayload` in `src/renderer/src/clipboard.ts`) is explicitly
designed to work across diagrams — this app is one `BrowserWindow` per
diagram (ADR 0023), and paste uses the real OS clipboard specifically so it
works across windows.

`remapForPaste` already regenerates node/edge ids and repositions pasted
nodes for exactly this cross-diagram case, but it left the four resource
path fields completely untouched — copied verbatim into the pasted node's
`data`. Since those paths are diagram-relative, a node pasted into a
diagram at a different location or directory depth than the one it was
copied from ends up with resource paths that no longer point at the right
place. Separately, `pasteFromClipboard` never triggered a Diagnostics
rescan (`scanMissingFiles`) — only diagram load and the panel's manual
Recheck did — so a paste that broke a reference gave no signal at all until
the next reload.

The design question: what, if anything, should paste do about these paths?

## Decision

**Relabel, never repair — and always rescan immediately after paste.**

If a resource path's leading segment matches the *source* diagram's own
file name — this app's standing default for where a diagram's own
resources live (`<diagram-name>/assets/...`, `<diagram-name>/details/...`,
a freshly created `<diagram-name>/<child>.chd`; see `linkPaths.ts` /
`links.ts` / `icons.ts` / `details.ts`) — that leading segment is relabeled
to the *destination* diagram's own name on paste. Any path that doesn't
match (hand-relinked, absolute, or an intentional pointer at some unrelated
diagram elsewhere on disk) is left completely untouched.

This is deliberately *not* a repair: the underlying file is never moved or
copied, so a relabeled path is exactly as unresolved as the original one
was — Diagnostics still reports it as missing either way. What it changes
is *which* equally-broken path gets reported. `pasteFromClipboard` also now
calls `scanMissingFiles` right after applying a paste, so a broken
reference is flagged the moment it's introduced rather than waiting on the
next load or a manual Recheck — the same "surface it immediately, decide
nothing automatically" stance as a compiler flagging an unresolved import.

The user's own reasoning, argued through in review against two rejected
alternatives (see below): *"Only the user knows if this is a carbon copy,
a move, or a copy-then-modify operation"* — the app has no way to tell
which of those a given paste means, so it must never silently act as if it
knows. But the relabel is safe precisely because it can't accidentally
guess right in a way that matters: if the user's intent was to copy the
referenced files over (the common case, matching this app's own
colocation-folder convention), the relabeled path is already correct the
moment they do that — no separate manual Relink needed on top. If the
intent was to start fresh without the linked resources, nothing is lost —
it was a broken path before, it's an equally broken (differently labeled)
path after, still caught by Diagnostics, still requiring the same Relink /
Remove / Dismiss decision.

## Alternatives considered

- **Auto-copy the referenced file into the destination's own colocation
  folder, then point the pasted node at the copy** (icons/details/
  references), **and fully recompute `linkedDiagram` via `path.relative()`
  against the same target file** (since a linked diagram is allowed to live
  anywhere, no colocation requirement). Both are provably always-correct
  operations — no naming heuristic, no leftover breakage. Rejected by the
  user: this tool is explicitly meant to be git-diffable and hand-editable,
  the same discipline expected of source code — copying an import's file
  along with copied code, or silently re-binding a copy to the same file
  the original still points at, is a decision only the person doing the
  paste can make correctly. Auto-copying also assumes the paste is meant to
  fork a self-contained copy of the asset; auto-recomputing `linkedDiagram`
  assumes the opposite, that the two diagrams should stay bound to the same
  child file. Neither assumption is safe to make on the app's behalf, and
  guessing wrong in the recompute case is worse than staying broken: it
  produces a *resolving* link the user didn't ask for, silently coupling
  two diagrams together.
- **A manual find/replace paste dialog** (user types an old/new path
  prefix, applied across the pasted selection). Rejected: still requires
  the user to separately go move/copy the actual files for anything to
  work, so it doesn't reduce the manual work the relabel doesn't already
  save for free in the common case — it just relocates the typing from a
  Diagnostics Relink action to a paste-time dialog.
- **Do nothing to the path strings, only add the rescan.** Considered as
  the purely-compiler-analogy-consistent option (never touch data, only
  report). Not chosen over the relabel because the relabel doesn't weaken
  that stance — see Decision above, it's provably neutral-or-better, not a
  repair — so there was no real tradeoff being given up by also doing it.

## Consequences

- `src/renderer/src/clipboard.ts`: `ClipboardPayload` gains
  `sourceDiagramBaseName: string | null` (set at copy time from the source
  diagram's own path). New `diagramBaseName()` helper (manual `path.basename`
  equivalent — this renderer doesn't import Node's `path` module elsewhere).
  New `retargetResourcePath()` / `retargetNodeData()`; `remapForPaste` takes
  the destination diagram's path as a new parameter and applies the relabel
  to every pasted node's `data`.
- `src/renderer/src/Canvas.tsx`: `copySelection` passes `currentPath` into
  `buildClipboardPayload`; `pasteFromClipboard` passes `currentPath` into
  `remapForPaste` and calls `scanMissingFiles` on the applied result
  immediately after paste.
- `duplicateSelected` (the separate, clipboard-free in-place clone
  shortcut) is untouched — it never leaves the source diagram, so no
  relabeling or rescan is needed there.
- No `.chd` schema change — this only affects what a fresh paste writes
  into in-memory node `data` before the next save; the file format's own
  path-resolution rule (`docs/file-format.md`) is unchanged.
- A separate, unconfirmed report that Diagnostics didn't flag a broken path
  in a real diagram is logged independently, not resolved by this decision
  — see [known-issues.md](../known-issues.md#diagnostics-missing-files-check-didnt-flag-a-reported-broken-relative-path-in-real-diagram-data).
