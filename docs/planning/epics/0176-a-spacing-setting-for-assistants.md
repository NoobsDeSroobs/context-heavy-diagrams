# 0176: A spacing setting for assistants

## Status
Not Started. Logged 2026-11-05, redirected 2026-11-11; follows [0162](../completed-epics.md#0162-minimum-distance-between-connected-elements).

## Goal
Let the person say how much room an assistant should leave around an edge label, so the amount is theirs and not a number buried in the guide. A person drawing by hand can see what good spacing is; an assistant cannot, so the setting only exists for assistant work.

## Direction (decided 2026-11-11)
- **It is not a file format field and not a diagram setting.** Nothing is written into the `.chd`. It is configuration of the assistant integration, set where the integration is set up, like `allow_update`: a number in the extension's `user_config` (passed as an environment variable), a flag on `chd mcp`, and a field in the AI menu's copy-settings dialog and copy-paste instructions.
- **The hard floor stays** as the recommended minimum: `MARKER_LINE_PX` in `labelClearance.ts` (8 px of line a side with no end graphic, 12 to 18 with one). It is always checked, it is not configurable, and `chd validate`, the skill script and Diagnostics keep reporting it as a warning.
- **The setting is the target.** It is the line to leave either side of the label (20 px by default, never below the floor of that edge). `room_for_label`, the `edit_diagram` answers and the layout guide use it in place of the fixed `TARGET_LINE_PX`.
- **No second tier in Diagnostics or `chd validate`.** The one place a soft finding may help is the answer of `edit_diagram` ("tighter than the spacing you asked for"); decide when building.

## Questions to settle first
- The unit: the line either side of the label (as the floor is) or padding around the label box. Keep one meaning across and down.
- How the setting reaches an assistant that has no MCP server (the skill running `chd`, copy-paste instructions): an environment variable and a flag on the commands that use it, or the number written into the copied instructions.
- Whether the tools report the value in use, so an assistant can see it.
- The floor depends on the end graphics and was set by eye with the default 12px label; check it with a larger font.

## Tasks
- [ ] Settle the questions above and write the design as an ADR
- [ ] Read the setting in the shared check code (`src/shared/layout/`), with tests, and use it in `room_for_label` and the `edit_diagram` answers
- [ ] The extension `user_config` field, the `chd mcp` flag and the AI menu fields
- [ ] Update the layout guide and the skill to use the number the tools report
- [x] Diagnostics: the Layout section for the hard floor (done with 0162)

## Notes
Raised while reviewing 0162: the figures in the guide are an estimate, and the person is the one who knows how airy they want assistant work. First written as a diagram setting with a second warning tier; dropped because a person looking at the diagram needs neither.
