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
- **An edge whose handle ids do not exist on its node is not drawn**, in the editor or here, so it cannot be coloured. The gallery's `c4-context.chd` has two such edges (`right`/`left` on a node whose sides only hold custom points), and a hand-made edge with no handle ids has the same problem. The changes list should name edges the canvas cannot draw.
- Dimming strength follows the existing Isolate opacity preference ([ADR 0063](../../decisions/0063-isolate-mode.md)).
- **Not checked yet:** a removed container whose children survive, big diagrams, Linux, any revert.
- **Spike code to keep:** `src/shared/compare/classify.ts` (tested), `CompareView.tsx`, `compare.css`, `flowTypes.ts`, `createCompareWindow`. **To replace:** the `?base=` file path as the baseline, the hover card (field names only, no old/new values), and the launch (an IPC call, no menu entry).

## Open questions
- Can the old Details content be had for the "window's own version" baseline? The window only holds notes it has opened. Git has them; the window does not necessarily.
- Does the changes overview in the compare window and the existing "changes since last save" panel become one thing, with the revert action in both?
- How a revert of an element interacts with its edges, its container and a Details file.

## Tasks
- [x] Spike: the real canvas runs read-only in its own window (see above)
- [ ] Classification engine: old and new values per field (the spike has the four buckets and field names), absolute positions for containers, edges the canvas cannot draw
- [ ] Compare window plumbing (main process: no path registration, no recovery, no close prompt)
- [ ] Colours, badges, dimming, legend, summary, hover details
- [ ] Diagram-level changes strip
- [ ] Baseline from the "changed on disk" banner
- [ ] Git baseline (`git show`), with a missing-`git` message; check on Linux
- [ ] Next/previous navigation and reviewed ticks
- [ ] Id-churn banner and the button-triggered matching
- [ ] Revert per change from the overview
- [ ] Conformance and diagnostics delta (tentative)
- [ ] `chd diff`
- [ ] ADR(s) for what was decided and tested; `docs/` updates (getting-started, comparison)

## Related
[ADR 0102](../../decisions/0102-changes-since-last-save-scope.md), [epic 0117](../completed-epics.md), [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md), [ADR 0131](../../decisions/0131-conformance-profiles.md), [epic 0144](0144-svg-and-command-line-export.md).
