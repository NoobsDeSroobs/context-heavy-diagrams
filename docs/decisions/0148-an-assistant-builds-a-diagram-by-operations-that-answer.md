# 0148: An assistant builds a diagram by operations that answer with what they made

## Status
Accepted (2026-11-06) for a first, small set of operations; a proof of concept.

## Context
Assistants asked to draw a large diagram wrote their own generator scripts, about a thousand lines each, to get ids, parent order, connection points and positions right. A script needs a runtime the machine may not have, and Claude Desktop with the extension has no shell at all.

## Decision
- **The assistant works the way a person does, in small steps, and each step answers with what it made.** The operations are add an entity, container, text or line; connect two elements; add a connection point; move, resize, relabel, restyle, nest and remove. They are plain data (`{ "op": "move", "id": "api", "x": 200, "y": 0 }`).
- **The assistant decides all layout.** The tool never places anything for it. It answers questions instead: how much room two connected elements need for a label ([ADR 0146](0146-elements-joined-by-an-edge-keep-a-gap-for-the-label.md)), the elements as they stand, and what is wrong with the layout so far (a label without room, overlapping elements, an element sticking out of its container, an edge running over an element).
- **One pure core in shared code,** `src/shared/edit/`: a function from a diagram and a list of operations to a new diagram and an answer per operation. A batch is all or nothing and an error names the operation. Coordinates are absolute in operations; the parent-relative form the file stores stays inside the core. The caller supplies the id generator, so the core stays free of Node.
- **The first executor works on the file, through the Claude Desktop extension's MCP tools** `edit_diagram`, `inspect_diagram` and `room_for_label`, so no shell is needed. `edit_diagram` creates the file if it does not exist; for a file that exists it needs the fingerprint of the last answer ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)) and writes through the same validated, atomic write as `create_file` and `update_file`. A diagram the server made in the current session may be edited again without the setting that allows changing existing files; any other existing file still needs that setting.
- **Because the operations are data and the core is pure,** the open window can later run the same operations on its live diagram as one undoable step; the questions already take a diagram and not a path.
- **Not in the first set:** tags, notes, links, icons, edge points and the security matrix. They go through the raw file tools until they are added.

## Alternatives considered
- **A compact description the tool turns into a diagram** (like D2). It hides the step-by-step loop, leaves the assistant guessing at the result, and needs placement the tool would have to decide.
- **Helper functions the assistant calls from its own script.** Small, but still needs a shell and a runtime.
- **Only the running app executes the operations.** Watching it happen and undo come for free, but the app must be open and the connection needs its own security design.

## Consequences
- A second path for edits that must produce what the editor would: every result is validated and written in the app's own serialisation, and the tests check both.
- The command line has no counterpart yet; a `chd` command would take the same operations on standard input.
- The set of style fields is checked in the core (known fields, numbers in range, known markers) and passed through to the file.
