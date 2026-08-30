# 0008: Detail sublayer

## Status
Done

## Goal
Right-click → "See details" opens a fixed right-side panel with a Markdown editor/preview, backed by a per-node `.md` file — data on the node, never a second draggable canvas object.

## Tasks
- [x] Schema: `data.details?: string` on `DiagramNode` — relative path to the detail file, additive per ADR 0003
- [x] Extend the right-click context menu (epic 0007) with "See details" — on both `ShapeNode` and `TextNode` (`TextNode` didn't have a context menu at all yet; added one, "See details" only, no "Add icon" since icons are shape-only)
- [x] Fixed right-side panel (`src/renderer/src/components/DetailsPanel.tsx`, not a modal): top taskbar with an edit/preview mode toggle, plus basic Markdown formatting buttons (bold, italic, heading, bullet list) shown only in edit mode
- [x] Preview rendering via `react-markdown`
- [x] Draft state: editing a node's details doesn't write to disk immediately. Lifted to `Canvas` (`detailsDrafts`, keyed by node id), flushed to disk as part of the *main* save flow — not its own save action, not save-on-panel-close
- [x] Wire up Ctrl/Cmd+S as an actual keyboard shortcut for save
- [x] Main-process IPC (`src/main/details.ts`): read by relative path, write by node id
- [x] Diagram-not-yet-saved handling ended up simpler than icons: since details now flush *inside* the save flow itself, hitting Save/Ctrl+S on an unsaved diagram just triggers the normal Save-As prompt first, then flushes using that new path — no separate blocking alert needed the way custom icon upload needed one
- [x] Lightweight hover tooltip: native `title` attribute (`useDetailsTooltip` hook, shared by both node types) showing the first line of the detail content, when present
- [x] Update `docs/file-format.md` with the new `details` field
- [x] Manual test: edit/preview toggle, close/reopen, hover tooltip — confirmed working

## Notes
Save behavior explicitly decided against auto-save-on-close: "It is easy enough to hit two buttons once you have written something and you know you want to save." A real autosave/crash-recovery mechanism and a proper unsaved-changes-on-close prompt are wanted eventually but explicitly deferred — see epic [0020](0020-autosave-and-crash-recovery.md).

The hover tooltip is intentionally just "first line" for now. Richer tooltips driven by parsed YAML frontmatter (already anticipated as a future addition in the brief itself) are epic [0021](0021-detail-frontmatter.md), not this one.
