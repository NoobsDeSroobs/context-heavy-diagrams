# 0179: Align a connection point with another element

## Status
Not Started. Logged 2026-11-07. Waits for [0188](0188-loosely-attached-edges.md) (decided 2026-11-14): dynamic and springy connection points may make this unnecessary or change what it should be, so it is read again when 0188 is designed.

## Goal
Let an assistant get a straight vertical or horizontal edge without working out the offset itself. Today it turns the target's centre into `(cx - x) / width` by hand for every `add_connection_point`.

## Tasks
- [ ] `add_connection_point` takes `align_with: <element id>` in place of `offset`: the point lands where the line from the other element's centre meets the side (clamped to 0..1), with tests
- [ ] Say in the answer when the side's centred point was kept under the side's name, so the handle list is not a surprise
- [ ] Mention it in the `edit_diagram` help

## Notes
[0188](0188-loosely-attached-edges.md) (dynamic and springy attachment) may make most of this unnecessary: read it before building this.

Seen in the second Immich trial. The operation stays in the shared edit core, so the app can use it too.
