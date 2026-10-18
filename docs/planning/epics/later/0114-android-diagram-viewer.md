# 0114: Android diagram viewer (read-only, on the move)

## Status

Not Started — parked ("much later"). Logged 2026-09-07 from a user ask:
a way to open a `.chd` file on Android, pan around, toggle highlights, and
long-press (hold to "right-click") a shape to see its details — for
referring to a diagram away from the PC.

## Goal

A **read-only** mobile viewer for `.chd` diagrams: open a file, pan/zoom,
toggle highlight groups, long-press an element for its details / metadata,
follow linked child diagrams. No editing, no security matrix, no export.

## Feasibility assessment (2026-09-07)

**Moderate.** Not a research project and not a weekend — a few weeks of
real work, most of it not on the mobile side at all. The touch
interactions the user asked for are the cheap part.

### Basically free

- **Pan / zoom / pinch** — React Flow (`@xyflow/react`) has touch support
  built in.
- **Highlight-group toggles** — already pure view state, no filesystem, no
  Electron.
- **Long-press → context menu / details sheet** — React Flow exposes
  `onNodeContextMenu`; a touch long-press maps to it. The Details panel is
  already a self-contained React component rendering Markdown.
- **Read-only rendering** — the whole styling/layout/edge-routing layer is
  renderer-side React with no main-process dependency.

### The actual work

1. **Decouple the renderer from Electron IPC.** The canvas currently
   reaches disk through IPC: `icons:readAsDataUrl`, details `.md` reads,
   `linkedDiagram` resolution, `resources:checkExist` (see
   [epic 0108](../../completed-epics.md#0108-diagnostics--list-missing-referenced-files)). A mobile build needs
   all of that behind a small `DiagramResourceProvider`-style interface
   with a non-Electron implementation. **This is the bulk of the effort**
   — and it's worth doing regardless, because it also unlocks a
   browser-based viewer.
2. **File access on Android.** A `.chd` is a single JSON file, but a real
   diagram references sibling files in its colocation folder — custom
   icons, details `.md`, reference images, linked child diagrams. Options:
   - Android Storage Access Framework: user grants access to the *folder*,
     app resolves siblings within it.
   - A "pack for mobile" export (zip the colocation folder into one
     portable bundle) — overlaps with any future portable-export idea.
   - Opening a bare `.chd` with no folder grant still renders geometry +
     labels + highlights + edges; icons/details/links come up "missing"
     (the epic 0108 machinery already models exactly this state).
3. **Packaging.** Wrap the read-only web build with **Capacitor**
   (WebView + an SAF/file plugin), or ship a TWA / installable PWA.
   **React Native is the wrong tool** — React Flow is DOM-only; RN would
   mean reimplementing the entire canvas.

### First-version scope (if ever picked up)

Single `.chd` + its colocation folder via SAF · read-only · pan/zoom/pinch
· highlight-group toggles · long-press → details bottom-sheet · tap a
linked shape to open its child diagram · back-stack navigation. Nothing
else.

## Notes

Real value beyond the mobile use case: step 1 (a renderer with no Electron
dependency) is the same prerequisite a web/browser viewer would need, so
this epic's groundwork is not throwaway even if the Android app itself
never ships. Windows + Linux desktop remain the only supported *editing*
platforms ([docs/project-brief.md](../../../project-brief.md)).
