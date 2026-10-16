// The short text behind AI -> "Copy AI instructions" (ADR 0104): pasted into
// a chat with Claude or another assistant so it can read/edit a .chd file it is
// shown. Deliberately small — the essentials plus the traps that corrupt files.
// The full reference is docs/file-format.md, which stays the source of truth:
// when a rule below changes there, change it here too.
export const AI_INSTRUCTIONS = `You are helping me with a diagram saved as a ".chd" file (from the "Context-Heavy Diagram Tool"). A .chd file is plain JSON — one file is one diagram. Read and edit it as JSON, and keep the file valid JSON.

Top level: { "version": 1, "nodes": [...], "edges": [...] } plus optional metadata, tags and legend sections. Keep every field you don't understand exactly as it is.

Nodes: each has a unique "id", a "type", a "position" {x, y}, an optional "size" {width, height}, and "data.label" (the visible text).
- type "entity": a box. "container": a box that can hold others. "text": a free text note. "line": a freeform line.
- A node with "parentId" lives inside that container. The parent must appear EARLIER in the "nodes" array than its children.

Edges: each has a unique "id", "source" and "target" (node ids), and optionally "sourceHandle"/"targetHandle" (connection point ids). Never point an edge at an id that doesn't exist.

Coordinates — easy to get wrong:
- A top-level node's position is on the canvas. A node with "parentId" is positioned relative to its parent's top-left corner.
- A "line" node's points are relative to that line node's own position.
- An edge's "points" (bend waypoints) are absolute canvas coordinates.
- Space things generously: roughly 20px between siblings inside a container, 60px between separate groups.

Relative paths: any file path in the diagram (icons, "data.details" notes, "data.linkedDiagram" links to other diagrams) is relative to the .chd file that contains it. If you copy a node into a diagram in a different folder, rewrite its paths. Don't move or rename files that other diagrams link to.

Always work from the newest version of the file I have shown you; if I paste a newer one, start again from that instead of from your earlier copy.

When you change a file: keep ids unique, don't delete things I didn't ask you to, and tell me what you changed. The full format reference is docs/file-format.md in the project's repository.`
