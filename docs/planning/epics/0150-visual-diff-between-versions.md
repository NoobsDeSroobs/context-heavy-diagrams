# 0150: Review changes between two versions of a diagram

## Status
In Progress (design started 2026-10-25, branch `epic/0150-visual-diff-between-versions`). Logged 2026-10-21 from the [comparison with other tools](../../comparison.md). No ADR until the end of the epic: an ADR records tested results and hard decisions, not hypotheses.

## Goal
Let a human review what changed in a diagram, most of all after an AI assistant edited it, so they check the change instead of gambling on it. A new window shows the later version on the real canvas, dims everything that did not change and colours what did. Version-control history is the usual source of the older version; the window's own pre-change version is the other.

## Why
A `.chd` file diffs as text, but the JSON diff of an AI edit is hard to read, and the picture is not in it. Several tools compare diagram versions (iGrafx, LeanIX, Camunda, Figma branches), all inside their own cloud or proprietary product. A plain-file, offline, git-native review, with a command for CI, is what this tool can add. The semantic side (tags, security, links, conformance) is the part a picture of moved boxes cannot give.

## Design (hypotheses, to be tested)

### Colours
Classification is per element, one colour each, strongest first:

| Colour | Meaning |
|---|---|
| Green | Added |
| Red | Removed (a dashed ghost at its old place) |
| Orange | A link string changed, was added or removed (`linkedDiagram`, `details`, reference images), or the Details file's content changed, was added or removed. Easy to miss, often important context: check it in git |
| Yellow | Label, tags, security, edge source or target, connection points, parent container, direction sets or type changed |
| Dimmed, uncoloured | Only position, size, rotation, layer order or style changed (not tracked for now; position can carry meaning in a map, so keep it in mind) |

Each coloured element also gets a badge (+, −, ~, link glyph), because red/green and yellow/orange are easy to confuse. A legend in the window says what the colours mean.

### The window
- A new window, one per diagram path, opened from a menu command and the command palette, and from the "changed on disk" banner.
- Real canvas, read-only. It reuses the node and edge components, the focus-search dimming ([ADR 0063](../../decisions/0063-isolate-mode.md)) and the Ctrl/Cmd-hover peek card pattern for the field-level details (tags added/removed, label old → new, edge target old → new, security).
- It never saves, autosaves, writes recovery files or asks to save on close, and it is not registered as the window for that path.
- Removed elements are not in the later file, so the window loads a merged model: the later elements plus ghosts of the removed ones. Safe only because the window cannot save.
- A "diagram-level changes" strip, styled to stand out, for what the canvas cannot colour: legend, highlights, required tags, gravity presets, security catalog, direction sets, metadata, max connection points. Coarse: which collection changed and what was added or removed.
- A summary ("2 orange · 3 yellow · 4 green · 1 red"), next/previous navigation (security first), a list of changes and a session-only "reviewed" tick.
- **Revert this change** per row of the changes overview: the compare window sends the revert to the editor window, which applies it as an ordinary undoable edit (so the stale-edit rule and Ctrl+Z behave as for any edit). Details files are the hard case.

### Where the older version comes from
- **The window's own version before the change**, offered from the "changed on disk" banner: the version this window loaded against the file on disk now. Needs no git and is exact for "what did the assistant just change", where `HEAD` is wrong when there was uncommitted work first. Only while the window has no unsaved edits of its own.
- **A git revision** (default `HEAD`, a typed revision such as `main` for review). Git only supplies the older bytes, with `git show <rev>:./file.chd` in the diagram's folder (and the same for a Details file); the comparison is the id-keyed diff over two whole files, never a parse of a unified diff. `execFile` with an argument array, no shell, a revision starting with `-` refused, and only `show`/`cat-file` (commands that refresh the index can run a repository's `core.fsmonitor`).
- A link is compared by its stored string only. Whether the linked diagram itself changed is found when it is opened or closed, not here.

### Guarding against bad matches
- **Id churn:** if many elements are removed and re-added with the same type and label, a banner says N elements look replaced, not edited. The matching that pairs them runs only when the user presses a button (it is quadratic, and only worth it when the user does not already know). A later three-way merge would sit behind the same trigger.

### Later in the epic
- **Conformance and diagnostics delta:** run the conformance check on both versions and report findings the change introduced or resolved. Tentative: only if it can be made stable and fast, and a profile is only applied (not stored in the file), so it needs one chosen.
- **`chd diff old.chd new.chd`:** the same classification as text or `--json`, with an exit-code option. For CI, a PR comment, and an AI skill that ends by reporting what it changed. An SVG image is a possible follow-up.

### Left out on purpose
Pixel diff (noisy, says nothing about which element changed); diffing inside linked diagrams; a text diff of Details notes in the app (git does it, orange points there); auto-opening a window after an AI write; a file-picker baseline; moved/resized/restyled tracking.

## Spike result (2026-10-25)
A compare window on the real canvas works. `?compare=<later>&base=<earlier>` (files, for now) opens a window that classifies both versions, builds the merged model and draws it with the editor's own node and edge components. Checked in the dev app on Windows with a modified copy of the C4 gallery diagram: green, red, orange and yellow outlines with badges, unchanged elements dimmed, a Ctrl-hover card, a legend with counts; double-click, right-click and selection do nothing.
- **Read-only was cheap.** The window mounts no `Canvas`, so there is no save, autosave, recovery, close prompt, menu or keyboard shortcut to switch off. What is left is a `DiagramContext` with every action a no-op (25 fields), React Flow's own interaction props, and `pointer-events: none` on everything inside a node, which stops label editing, handles, resizers and context menus while the node still gets the hover.
- **Main process:** a separate `createCompareWindow`, not registered under a path, with no close guard.
- **Needed in shared code:** `nodeTypes`, `edgeTypes` and the default edge options moved to `canvas/flowTypes.ts`; the diff engine's field specs exported; `LabeledEdge` puts `data.compareClass` on its label chip, since the chip is drawn outside the edge's own element and would not dim otherwise.
- **Trap:** without `connectionMode={ConnectionMode.Loose}` every edge is silently dropped (all handles are `source`).
- **An edge whose handle ids do not exist on its node is not drawn**, in the editor or here ([known-issues](../../known-issues.md)). Decided with the maintainer: the review must show every edge, or the overview is lost. The engine builds a drawable copy for the window (`drawable.ts`, an end moved to the nearest point the node has, the comparison itself untouched) and the window says how many it moved. Only an edge whose end node does not exist cannot be drawn; the window counts those.
- Dimming strength follows the existing Isolate opacity preference ([ADR 0063](../../decisions/0063-isolate-mode.md)).
- **Not checked yet:** a removed container whose children survive, big diagrams, Linux, any revert.
- **Spike code to keep:** `src/shared/compare/classify.ts` (tested), `CompareView.tsx`, `compare.css`, `flowTypes.ts`, `createCompareWindow`. **To replace:** the `?base=` file path as the baseline, the hover card (field names only, no old/new values), and the launch (an IPC call, no menu entry).

## Blind test (2026-10-26)
Seven random edits to the Meridian Rail landscape diagram (81 nodes, 83 edges), made without telling the maintainer, who then reviewed them in the compare window. All six changes the view tracks were found (a deleted entity, an edge label, an edited required tag, a removed tag, a renamed entity, a changed tag value), with the old and new tag values read from the hover card. The seventh item, layout-only (four moved entities, one restyled), is dimmed by design; the maintainer reported the restyle (as a move) and missed the four moves. Findings:
- The engine's colour for every checkable edit matched the log, and the first run showed the drawable repair was too broad (54 edges, all with no point named, which the canvas already draws); it now moves only an end that names a point the node lacks.
- **Edge changes have no hover detail** (the card is node-only), so the reviewer knew an edge changed but not how. Add it.
- **"Removed (5)" for one deleted entity** counts its four connections as separate removals. Count elements and connections apart.
- **A restyle is invisible in the view but visible in the editor**, so a reviewer may find it unprompted. Whether a faint marker (off by default) for moved, resized and restyled elements earns its place is still open; moves stay untracked either way.

## Open questions
- The banner baseline cannot say a note's *content* changed (the window only holds notes it has opened); it still flags a changed note *link*. Git covers the content, so this stays as it is unless it is missed.
- Does the changes overview in the compare window and the existing "changes since last save" panel become one thing, with the revert action in both?
- How a revert of an element interacts with its edges, its container and a Details file.

## Tasks
- [x] Spike: the real canvas runs read-only in its own window (see above)
- [x] Classification engine (`src/shared/compare/`): the four colours, what changed in words per field (tags, label, security cells, links, edge ends), a review order (security, links, content, removed, added), counts, the diagram-level collections, every edge drawable, an input for Details files the caller found changed. 12 tests, and a check that its field list matches "changes since last save". Absolute container positions are not needed while position is not tracked.
- [ ] Restricted preload for the compare window: it needs `getCompareSession` and the icon readers, not the editor's whole bridge ([ADR 0112](../../decisions/0112-electron-hardening-sandbox-and-navigation.md)). The real separation between the read-only view and the diagram and its files, since the window has the same `window.api` as the editor today. Needs a second preload entry in the build.
- [ ] Compare window plumbing (main process: no path registration, no recovery, no close prompt)
- [x] Colours, badges, dimming, legend with counts (elements and connections apart), hover details for nodes and edges, a paint-brush marker for restyled elements (a legend toggle, on by default), the editor's zoom limits so a big diagram fits
- [ ] Summary and next/previous navigation (the review order exists in the engine)
- [x] Diagram-level changes strip (plain list for now)
- [x] Baseline from the "changed on disk" banner: **Review changes** opens the window with this window's version as the earlier one and the file on disk as the later one. The editor hands both versions to the main process, which holds them under the id in the window's URL (`src/main/compare/compareWindow.ts`, checked with `parseDiagram` on the way in). Tried live on a scratch copy of the Meridian diagram: banner, button, window, counts and hover. Still open: the old Details content for this baseline, and a menu command and palette entry.
- [x] Git baseline: **Compare with git revision…** (View menu and command palette) asks for a revision (default `HEAD`) and compares the file on disk with the file at that revision. Only `git show <revision>:./<path>`, no shell, a revision that could be an option refused, `core.fsmonitor` off, a Windows fallback for git's default folder. A changed note (Details file) turns its element orange with a few lines of what changed (`textPreview.ts`; line endings alone are not a change). Notes are read a few at a time; a note path that leaves the diagram's folder is never read. Tests: a real temporary repository, end to end. Tried live through the real menu and palette on a scratch repository. Not checked: Linux and macOS, a very large number of notes (one `git` process each).
- [x] A **Review changes on disk** command beside it, for the same action as the banner button
- [ ] Next/previous navigation and reviewed ticks
- [ ] Id-churn banner and the button-triggered matching
- [ ] Revert per change from the overview
- [ ] Conformance and diagnostics delta (tentative)
- [ ] `chd diff`
- [ ] ADR(s) for what was decided and tested; `docs/` updates (getting-started, comparison)

## Related
[ADR 0102](../../decisions/0102-changes-since-last-save-scope.md), [epic 0117](../completed-epics.md), [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md), [ADR 0131](../../decisions/0131-conformance-profiles.md), [epic 0144](0144-svg-and-command-line-export.md).
