# 0132: The compare window is a read-only canvas with its own bridge

## Status
Accepted (2026-10-27)
Supersedes: none
Superseded by: none

## Context
A person reviewing what changed in a diagram, most of all after an AI assistant edited it, needs the picture, not only a JSON diff: the later version on the real canvas, the changed elements marked, the rest dimmed. The editor's own bridge to the main process has 58 methods, many of which write to disk, so a window that only looks must not simply inherit it.

## Decision
**A separate window that never mounts the editor.** It is not registered under the diagram's path (opening the diagram must not focus it), has no close guard, and starts no autosave or recovery, because the `Canvas` component that owns those is never mounted. What is left to switch off is small: a `DiagramContext` whose actions are all no-ops, React Flow's own interaction props, and `pointer-events: none` inside nodes, which stops label editing, handles, resizers and context menus while a node still gets the hover. The node and edge components, the Isolate dimming strength ([ADR 0063](0063-isolate-mode.md)) and the Ctrl/Cmd-hover peek card are reused.

**It draws the later version plus a dashed ghost of each removed element.** The merged model is safe only because the window cannot save.

**Every edge is drawn, from a copy.** An edge that names a connection point its node lacks is silently not drawn by the editor ([known issues](../known-issues.md)); a review that loses edges loses the overview. The window draws a copy in which such an end sits at the nearest point the node has, says how many it moved, and leaves the comparison itself untouched. An edge whose end node does not exist cannot be drawn; the window counts those.

**The two versions are held by the main process** under an id in the window's URL, checked with `parseDiagram` on the way in and dropped when the window closes.

**A second, narrow preload** (`src/preload/compare.ts`, a second entry in the build): the compare window gets 5 methods (`getCompareSession`, `revertFromCompare`, `readPreferences`, `onPreferencesChanged`, `readIconAsDataUrl`) and no raw IPC, in the sandboxed window of [ADR 0112](0112-electron-hardening-sandbox-and-navigation.md). The set is what the window's code can reach. Its preferences hook could save and migrate, so the window has a read-only twin (`useReadOnlyPreferences`). A guard test keeps the bridge exactly equal to what the window's code can reach, on the editor's channels and with no write-style names, so adding a write method or dropping a needed one fails it.

## Alternatives considered
- **Mount the editor `Canvas` with a read-only flag.** One missed write path (save, autosave, recovery, a shortcut) would write from a window that is meant to only look. Not mounting it removes the paths instead of guarding each.
- **A picture diff** (pixels or an exported image). Noisy, and says nothing about which element changed.

## Consequences
- The node and edge components must keep working with a no-op context (25 fields); a new context field needs a no-op here.
- There is a second preload to build and keep equal to what the window uses; the guard test does the checking.
- The window can show an edge the editor does not draw. That difference is deliberate, and goes away if the editor is fixed.
