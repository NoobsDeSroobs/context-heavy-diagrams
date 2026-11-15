# 0179: Align a connection point with another element

## Status
Not Started. Logged 2026-11-07. [0188](../completed-epics.md#0188-edges-that-attach-loosely-to-their-connection-points) is done: a point slides up to 10 px to straighten an edge, and an end with no point attaches itself. That covers elements that are nearly in line and a hub fed by many edges. What is left is a point exactly under an element more than 10 px away; decide whether that is worth an operation, or whether placing the elements in line does it.

## Goal
Let an assistant get a straight vertical or horizontal edge without working out the offset itself. Today it turns the target's centre into `(cx - x) / width` by hand for every `add_connection_point`.

## Tasks
- [ ] `add_connection_point` takes `align_with: <element id>` in place of `offset`: the point lands where the line from the other element's centre meets the side (clamped to 0..1), with tests
- [ ] Say in the answer when the side's centred point was kept under the side's name, so the handle list is not a surprise
- [ ] Mention it in the `edit_diagram` help

## Notes
[0188](../completed-epics.md#0188-edges-that-attach-loosely-to-their-connection-points) (springy points, automatic attachment) covers most of this: read it before building this.

Seen in the second Immich trial. The operation stays in the shared edit core, so the app can use it too.
