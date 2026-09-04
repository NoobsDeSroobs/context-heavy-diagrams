# 0084: Diagnostics — a "missing files" section

## Status

Accepted (2026-09-04). Builds on
[ADR 0005](0005-diagram-identity-and-linking.md) (linked diagrams),
[ADR 0006](0006-icon-storage-model.md) (icon / details colocation),
[ADR 0069](0069-reference-images.md) (reference images) and the Diagnostics
panel (a session-only, recomputed-not-logged list of diagram-health
notices).

## Context

A diagram element can reference several files that live outside the `.chd`,
all under the diagram's sibling colocation folder, all stored as a path
relative to the diagram file's own directory:

- a node's `data.linkedDiagram` — another `.chd`
- a node's `data.icons[slot]` where `source === 'custom'` — an SVG/PNG in
  `assets/`
- a node's `data.references[]` — images in `assets/references/`
- a node's `data.details` — a `.md` in `details/`
- a legend entry's custom `icon`

When any of these goes missing (the file moved, the folder was renamed, a
hand-edited path is wrong) the failure today is scattered and quiet: a
linked diagram is a one-off `alert()` only when followed; a missing icon is
an uncaught `icons:readAsDataUrl` rejection in the console; a missing
details file silently reads as empty. There's no one place to see what a
diagram is missing, and no in-place way to clear a dead reference.

The ask (initially framed as "broken links", then widened by the user to
"ALL externally linked resources"): a Diagnostics section listing every
element that points at a file which no longer resolves — owner label +
type, click-to-reveal, the failing path, a remove button.

## Decision

### One bulk existence check, run at load and on "Recheck"

All five reference kinds resolve identically — `resolveLinkPath` (absolute-
aware, separator-normalised `join(dirname(diagramPath), …)`). That function
was copy-pasted in `windows.ts` and `requiredTags.ts`; extracted to
**`src/main/linkPaths.ts`** (and given the `\`→`/` split the icon reader
already did by hand, so a Windows-authored path resolves on Linux).

New handler **`resources:checkExist(diagramPath, relativePaths[])`** →
`{ relativePath, resolvedPath, found }[]`, same `fs.access` as
`windows:openLinked`, over a deduped list. The renderer collects every
`(owner, resourceKind, relativePath)` tuple, dedups by path, calls, and
keeps the tuples whose path came back `found: false`.

The scan is **async**, so its result lives in `Canvas` state
(`missingFiles: MissingFileEntry[]`), recomputed:

- on `loadDiagramIntoCanvas` (against the freshly-loaded nodes + legend), and
- on the Diagnostics panel's existing generic **"Recheck"** button.

Not on every edit (matches the panel's "recheck is a button" model), not
persisted, stale-result guarded (a fast load-then-reload can't leave the
previous diagram's list showing). No `currentPath` (unsaved) → reports
none.

### Panel: a structured section, the text list untouched

`DiagnosticsPanel`'s `entries: string[]` stays as-is. The new block sits
above it:

```ts
export interface MissingFileEntry {
  key: string                 // stable, for React + the remove dispatch
  ownerKind: 'node' | 'legend'
  ownerId: string
  ownerLabel: string
  ownerType: string           // 'shape' | 'container' | … | 'legend'
  resourceKind: 'linkedDiagram' | 'icon' | 'reference' | 'details'
  relativePath: string
  resolvedPath: string
  iconSlot?: string            // resourceKind === 'icon' on a node
}
```

Each row: `<resource kind> <ownerType> "<label>"` (a button → reveal, for a
node owner; plain text for a legend owner — a legend entry isn't on the
canvas), then "not found: `<relativePath>`" with `resolvedPath` as the hover
title, then a row of actions — one per path the user might take.

### Three choices per element, and removal is *staged*

The user's requirement: nothing is automatic, and a removal reaches disk
**only on save**. So the panel is a review surface, not an action list —
each row offers:

1. **Dismiss** — hide the row for the session ("I know this is fine right
   now"). It comes back on the next Recheck / reload. A
   `dismissedFileKeys: Set<string>` in `Canvas`, filtered out of the
   displayed list and the menu count.
2. **Relink…** — for the two kinds with a file-picker flow
   (`linkedDiagram` → `pickExistingLinkedDiagram`, `icon` →
   `pickAndCopyCustomIcon`); the others are fixed by restoring the file and
   hitting Recheck. Relink is an ordinary in-memory edit
   (`pushSnapshot()`, dirties, needs a save) — the same as re-linking from
   the element's own UI.
3. **Remove** — moves the entry into `stagedFileRemovals`. **No mutation.**
   The staged rows show in a "Staged for removal on save" sub-list with an
   **Undo**. They are applied — to `nodes` / `legend`, via
   `applyMissingFileRemoval` (clear `linkedDiagram`/`details`; drop the
   `icons` slot; filter `references`; drop the legend entry) — inside
   `persistDiagram`, the one place a diagram reaches disk, then
   `stagedFileRemovals` is cleared. Staging marks the document dirty so
   Save is offered and the close-without-save prompt fires; closing without
   saving discards the staged decisions, as required.

`stagedFileRemovals` and `dismissedFileKeys` both reset on the next scan
(load / Recheck).

- **Reveal** (node owners) reuses the select-one-node-and-`fitView` helper
  that backs the References inventory panel. Renamed `revealReferenceOwner`
  → `revealNode`.

### Count

The View-menu "Diagnostics (N)" label counts `displayedDiagnostics.length`
+ undecided missing files (dismissed excluded) + staged removals (a nudge
to save).

## Alternatives considered

- **Linked diagrams only** (the first cut). The user's own console error
  was a missing *icon*, and "ALL externally linked resources" was
  explicit — a diagrams-only check would miss the common case.
- **"Remove" mutates immediately (undoable via Ctrl+Z), needs save to
  persist** (the second cut). Technically already "needs a save", but the
  row vanished on click — no review surface, and Ctrl+Z is a blunt
  instrument that also reverts unrelated edits. The user asked for a
  deliberate per-element decision, so removal is now *staged* with its own
  Undo.
- **Fully stage everything, apply on save, nothing dirties until save.**
  Then Save wouldn't be offered / the close prompt wouldn't fire for a
  diagram whose only change is staged removals. Staging marks dirty
  instead.
- **Compute synchronously during render**, like the legend-empty advisory.
  Impossible — a filesystem check is async and main-only.
- **One string per missing file in the text `entries` list.** Loses
  click-to-reveal and the per-row actions — the core of the request.
- **Re-scan on every reference add/remove / on a filesystem watch.**
  Over-built; inputs change rarely and refresh is one button.
- **A dedicated "Resources" dock panel.** Missing files are a health
  signal, not a working surface; Diagnostics is where the user already
  looks.
- **Treat a missing `details` file as "fine, it'll self-heal".** It
  self-heals as *empty* — written notes are gone; worth surfacing.

## Consequences

- `src/main/linkPaths.ts` (new, shared `resolveLinkPath`) +
  `resources:checkExist` handler in `links.ts`; `windows.ts` /
  `requiredTags.ts` lose their local copies.
- `preload`: `checkResourceFiles(diagramPath, relativePaths)` + `.d.ts`.
- `DiagnosticsPanel.tsx`: `MissingFileEntry`; the section (undecided list +
  a staged sub-list); `onRevealNode` / `onRelink` / `onDismiss` /
  `onStageRemoval` / `onUnstageRemoval`.
- `Canvas.tsx`: module-level `collectResourceRefs` + `applyMissingFileRemoval`;
  `missingFiles` / `stagedFileRemovals` / `dismissedFileKeys` state;
  `scanMissingFiles` (stale-guarded, resets staged + dismissed);
  `stageMissingFileRemoval` / `unstageMissingFileRemoval` /
  `dismissMissingFile` / `relinkMissingFile`; `persistDiagram` applies
  staged removals before serialising; load + Recheck wiring; `revealNode`
  rename; `IconSlotView` swallows a missing-custom-icon read.
- CSS: `.diagnostics-missing-file*`.
- No `.chd` schema change; no `docs/file-format.md` change.
