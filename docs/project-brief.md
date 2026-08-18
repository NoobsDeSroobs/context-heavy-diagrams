# Project Brief: Offline Architecture Diagramming Tool

## Purpose

A local, offline desktop diagramming tool for IT architecture work, filling a gap between restrictive commercial tools and generic box-and-arrow editors (like Draw.io). Cross-platform (Linux + Windows). Author is an experienced backend/server developer with no prior GUI/frontend experience but is comfortable learning.

Intended to be open source eventually. Code signing is not a concern for now.

## Core requirements

1. Standard diagramming primitives: boxes/shapes, containers, arrows, text.
2. Shapes and containers must be resizable and rotatable via direct mouse interaction (drag handles), not just programmatically.
3. Per-shape icon slots (e.g. one per corner), supporting both built-in icon sets and user-uploaded custom SVG/PNG icons.
4. A **hidden detail sublayer** per node/shape, opened via **right-click → "See details"**, containing rich (Markdown) content — purpose, integration type, inputs/outputs, notes, etc. This must NOT be implemented as a second draggable/overlapping object. It is data attached to the node, rendered in a side panel/modal, so it never needs independent repositioning, doesn't break when the node moves, and isn't tangled up in grouping.
5. A **linked-diagram** capability per node, opened via **Ctrl/Cmd+click**, that navigates into a separate diagram file representing a drill-down (e.g., a "Order Service" box in a high-level view links to its own detailed architecture diagram). Distinct trigger from the details sublayer — both can exist on the same node simultaneously.
6. Infinite/unbounded pan-and-zoom canvas.
7. Dark mode and light mode.
8. Manual styling controls per shape/edge: line type, thickness, colour, fill, etc., via a properties panel when an element is selected.
9. Undo/redo (a reasonable number of steps is fine — doesn't need to be unlimited/branching for v1).
10. Nice-to-have: SVG/PNG export with configurable margin.

## Explicit non-goals

- No Draw.io feature parity needed.
- No web hosting / server component — this is a local desktop app only.
- No requirement for real-time collaboration.

## Interaction model (important — avoids known failure modes in existing tools)

The user has tried multiple existing diagramming tools and found they all fail in one of these ways, which this project must explicitly avoid:
- Requiring multiple overlapping objects to be moved together manually.
- Arrows/edges not dynamically re-routing when connected shapes are moved.
- Grouping mechanisms that make it hard to edit individual elements independently afterward.

Design principle: a node is a single draggable entity. Detail content and linked-diagram references are **data fields on that node**, never separate canvas objects. Edges must always be logically bound to node connection points so they auto-update on move/resize — never manually re-drawn.

Click semantics on a node:
- **Plain click** → select (for move/resize/style).
- **Plain drag** → move.
- **Right-click** → context menu → "See details" → opens Markdown detail panel.
- **Ctrl/Cmd+click** → navigate into linked diagram (if one is set on that node).

## Recommended technology stack

- **Shell**: Electron (mature, huge ecosystem, draw.io's own desktop app uses this approach). Tauri is a leaner alternative worth revisiting later, but adds Rust toolchain overhead not worth taking on for a first GUI project.
- **UI**: React + TypeScript.
- **Diagram/canvas engine**: **React Flow (`@xyflow/react`)** — handles infinite pan/zoom canvas, node dragging, edge routing/auto-reconnection, multi-selection, and custom node/edge rendering (every node is a real React component, so icon slots, resize handles, etc. are just normal component work, not custom canvas rendering code).
  - `<NodeResizer>` component (from `@xyflow/react` / `@reactflow/node-resizer`) provides drag-to-resize handles out of the box.
  - Rotation via CSS transform on custom nodes is a documented React Flow pattern (see their "Rotatable Node" example).
  - Containers should be implemented using React Flow's parent/child (sub-flow) node relationships, so child nodes move together with their container automatically.
- **Persistence**: plain files on disk via Electron's native `fs` and file dialogs. No database, no server.

## File format & storage design (git-friendly, human-debuggable)

Reject "one giant JSON file for the whole architecture." Instead, use one self-contained folder per diagram:

```
service-platform/
  diagram.json           # nodes, edges, viewport, styles — THIS diagram only
  assets/                 # icons/images used by this diagram's nodes
    aws-icon.svg
  details/                # one markdown file per node that has a detail sublayer
    node-a1b2.md
    node-c3d4.md
```

Key principles:
- Each `diagram.json` should stay small and scoped to one view — no cross-diagram indexing/manifest file needed. The folder tree itself is the drill-down hierarchy.
- **Never embed binary data (base64 icons, images) inline in the JSON.** Store as separate files in `assets/`, referenced by relative path. Keeps diffs clean and binary blobs out of JSON history.
- Detail sublayer content is stored as **separate plain `.md` files** (not inline strings in the JSON), referenced from the node by relative path. This lets users edit detail content in any external editor, and keeps the JSON diff small when only prose changes.
- A **linked diagram** reference is just a relative path from one node to another folder's `diagram.json` — no special resolution mechanism needed beyond relative file paths.
- Serialize JSON deterministically (stable key ordering, fixed indentation) on every save, so no-op edits don't produce spurious git diffs.
- Detail markdown files: plain Markdown for now. Optional **YAML frontmatter** (for semi-structured fields like `integration_type`, `inputs`, `outputs`) is a deliberately deferred feature — confirmed to be a zero-migration-cost addition later, since "no frontmatter present" and "frontmatter not yet parsed" are indistinguishable to a parser. Don't build for it now, just don't preclude it (i.e., keep detail content as external `.md` files, not a rigid inline JSON structure).

### Example node schema (current draft, not final)

```json
{
  "id": "node-a1b2",
  "type": "container",
  "position": { "x": 240, "y": 80 },
  "size": { "width": 180, "height": 100 },
  "rotation": 0,
  "style": { "stroke": "#333", "strokeWidth": 2, "fill": "#fff" },
  "data": {
    "label": "Order Service",
    "icons": { "topRight": "assets/aws-icon.svg" },
    "details": "details/node-a1b2.md",
    "linkedDiagram": "../service-platform-detail/diagram.json"
  }
}
```

Edge schema still needs to be drafted (line type, thickness, colour, arrowhead style, endpoint binding to node connection points) — not yet finalized.

## Detail sublayer UX

- Right-click → "See details" is the deliberate, explicit way to open the full Markdown panel (side panel or modal).
- A lightweight hover tooltip (showing e.g. first line of markdown or a short summary) is acceptable for at-a-glance scanning, but hovering should NOT open the full detail panel — with an infinite pannable canvas, hover-triggered heavy UI would fire constantly and unintentionally during normal pan/zoom use.
- Internal Markdown editing only needs to be minimal: a plain textarea bound to the file content plus a rendered-preview toggle. It does not need to be a rich WYSIWYG editor — the expectation is that most substantial edits happen in the user's external editor of choice, since the files are plain `.md` on disk.

## Suggested build phases

1. Bare Electron + React shell; embed React Flow; basic node/edge creation, drag, pan/zoom; save/load a single `diagram.json` to/from disk.
2. Resize (`NodeResizer`) and rotate on custom nodes.
3. Styling: properties panel driving per-node/per-edge `style` fields (stroke, fill, thickness, line type, arrowhead).
4. Containers via parent/child node relationships.
5. Dark/light mode (React Flow `colorMode` + app-wide CSS variables).
6. Undo/redo via a simple state-snapshot stack over `{nodes, edges}`.
7. Icon slots on custom nodes (built-in icon set + user-uploaded custom SVG/PNG, stored in `assets/`).
8. Detail sublayer: right-click context menu, external `.md` file per node, minimal in-app textarea+preview editor.
9. Linked-diagram navigation via Ctrl/Cmd+click, resolving relative paths to other `diagram.json` folders.
10. Nice-to-have: SVG/PNG export with configurable margin (compute bounding box + padding).

## Open items to resolve during implementation

- Finalize edge schema (styling fields, arrowhead types, connection point binding).
- Decide exact set of "few shapes" for v1 (e.g. rectangle, rounded rectangle, ellipse — keep minimal, expand later).
- Decide icon set source for built-in icons (e.g. a permissively-licensed SVG icon set) and how custom-uploaded icons get copied into a diagram's `assets/` folder.
- Undo/redo scope: confirm snapshot-per-completed-action (not per-pixel-drag) to keep history usable and memory-bounded.
