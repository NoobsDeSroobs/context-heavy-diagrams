# 0179: Align a connection point with another element

## Status
Not Started. Logged 2026-11-07; for later.

## Goal
Let an assistant get a straight vertical or horizontal edge without working out the offset itself. Today it turns the target's centre into `(cx - x) / width` by hand for every `add_connection_point`.

## Tasks
- [ ] `add_connection_point` takes `align_with: <element id>` in place of `offset`: the point lands where the line from the other element's centre meets the side (clamped to 0..1), with tests
- [ ] Say in the answer when the side's centred point was kept under the side's name, so the handle list is not a surprise
- [ ] Mention it in the `edit_diagram` help

## Notes
Seen in the second Immich trial. The operation stays in the shared edit core, so the app can use it too.
