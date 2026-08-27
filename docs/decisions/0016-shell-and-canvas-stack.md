# 0016: Shell and canvas stack — Electron + React + TypeScript + React Flow

## Status
Accepted

## Context
This is the author's first GUI/desktop project (experienced backend/server developer, no prior frontend experience) and needed to be cross-platform (Linux + Windows) from day one, offline, with no server component. A shell and canvas-rendering approach had to be picked before feature work could start — [ADR 0001](0001-build-tooling.md) (electron-vite vs. forge vs. manual tooling) already presupposes this choice; it never itself got written down as its own decision, despite being the more fundamental, harder-to-reverse one.

## Decision
**Electron + React + TypeScript, with React Flow (`@xyflow/react`) as the canvas/diagram engine.** Electron for the desktop shell (mature, huge ecosystem, prior art in this exact space — draw.io's own desktop app uses the same approach). React Flow specifically because it handles infinite pan/zoom, node dragging, edge routing/auto-reconnection, and multi-selection out of the box, and — critically for a frontend-inexperienced author — every node is a real React component: icon slots, resize handles, custom styling are normal component work, not custom canvas-drawing code (`<canvas>`/WebGL) that would need to be built from scratch.

## Alternatives considered
- **Tauri instead of Electron**: explicitly named and deferred, not rejected outright. Leaner (smaller binaries, no bundled Chromium), but adds a Rust toolchain dependency on top of an already-first-time GUI learning curve — judged not worth taking on for a first GUI project. Worth revisiting later if Electron's resource footprint becomes a real problem in practice.
- **Hand-rolled canvas rendering** (raw `<canvas>` or a lower-level rendering library instead of React Flow): not seriously considered — would mean building pan/zoom, drag, edge-routing, and hit-testing from scratch, all with no prior frontend experience to draw on. React Flow's node-as-component model was the specific feature that made the rest of the stack tractable.

## Consequences
- Every custom node/edge (`ShapeNode`, `TextNode`, `ContainerNode`, `AnchorNode`, `LabeledEdge`) is a plain React component — this is *why* features like icon slots, editable labels, and per-node context menus were straightforward additions rather than custom-render code.
- Containers ([ADR 0012](0012-container-node-design.md)) build directly on React Flow's native parent/child node relationships rather than a bespoke grouping mechanism.
- Persistence is plain files via Electron's `fs`/native dialogs — no database, no server, consistent with the brief's explicit non-goals.
- Ties the project to Electron's packaging/update story (`electron-builder`, code signing eventually) and to whatever React Flow does/doesn't support going forward (e.g. rotated-node edge-attachment math, [ADR 0004](0004-shape-text-node-split.md)) — a real constraint every subsequent node-type decision has had to design around.
