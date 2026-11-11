# 0176: Assistant preferences

## Status
Not Started, not being built now (2026-11-11). Logged 2026-11-05 as a label padding setting; redirected 2026-11-11 to the person's preferences for an assistant. Follows [0162](../completed-epics.md#0162-minimum-distance-between-connected-elements).

## Goal
Let each person prepackage what they want from an assistant that draws, tidies or reformats their diagrams, in their own words, the way Claude's own custom instructions set tone: how airy, which colours, how to name and group things, any standing commands. Example: "I prefer a lot of whitespace in my diagrams, and sharp, vibrant colours over dim or dark ones." An assistant asked to clean up a diagram then changes it by that person's taste, not a default one. A person drawing by hand can see what looks right; the assistant cannot, so this exists only for assistant work.

## What stays as it is
The technical checks (the label floor, overlaps, containment, crossings) say whether a diagram is correct or badly laid out, and are done. The hard floor (`MARKER_LINE_PX` in `labelClearance.ts`) stays the recommended minimum, always checked and not configurable. Preferences are taste on top of that and never switch a check off.

## Direction (decided 2026-11-11)
- **Not part of the `.chd` and not a diagram setting.** It belongs to the person and the assistant integration.
- **A tool returns it** (working name `assistant_guidance`; `chd guidance` on the command line; one shared implementation). The server instructions tell an assistant to call it before it draws, reformats or tidies a diagram. The description of the tool stays a few words, so the preferences cost tokens only when asked for ([0177](0177-fewer-tokens-for-assistant-diagramming.md)), and a size limit keeps the answer short.
- **Free text first.** Most of what a person wants is prose, and an assistant reads prose. Structure is added only where a tool must act on it without the assistant's help (the spacing number for `room_for_label` is the one candidate), and then as an optional field.
- **Read-only for assistants.** The preferences are the person's; an assistant changes them only when the person asks.
- The layout guide and the skill point to the tool instead of carrying fixed taste numbers.

## Questions to settle first
- **Where the text lives.** The server has no live connection to the app and the app opens no listener ([ADR 0169](../../decisions/0169-no-live-connection-between-the-mcp-server-and-the-app.md)), so a central process that every window, the CLI and the MCP server query is out: it would need a named pipe or Unix socket (not a network, but the Windows pipe is readable by every account on the PC and the offline test forbids the Node module), and it would have to be running whenever Claude Desktop starts the server, with the app closed. Preferences are small and change rarely, so a file is the central place without a process. Leaning: **one file per person**, a Markdown file with a visible name in the app's own per-user folder, that the AI menu creates and opens for editing. The integration reads exactly that one file, which the person names once: a `file` field in the extension's `user_config` (the folder rule of ADR 0110 gets one narrow, person-chosen exception), a flag on `chd mcp`, and a default path for `chd guidance`. Alternatives: a file in the diagram folder (per project; needs no exception), or free text in `user_config` (awkward for long text). A project file could be added on top later.
- Whether the assistant may write the file through the editing tools (`.md` is writable); a rule such as "only when the person asks".
- The tool's answer when there is no file: say so briefly, so an assistant does not look for one.
- Whether a few structured fields are worth having (spacing number, a preferred palette the assistant can pass to `edit_diagram`), or prose is enough.
- Copy-paste instructions and `AGENTS.md` for assistants without the server: carry the text, or tell the assistant where the file is.

## Tasks
- [ ] Settle the questions above and write the design as an ADR
- [ ] The preferences file or setting, and the AI menu action that creates and edits it
- [ ] The `assistant_guidance` tool and `chd guidance`, with a short description, a size limit and a line in the server instructions
- [ ] Update the skill, the layout guide and the copy-paste instructions to point to it
- [ ] If a structured spacing field is kept, read it in the shared check code, with tests, and use it in `room_for_label` and the `edit_diagram` answers
- [x] Diagnostics: the Layout section for the hard floor (done with 0162)

## Notes
Raised while reviewing 0162: the label figures in the guide are an estimate, and the person is the one who knows how they want assistant work to look. First written as a diagram setting with a second warning tier, then as a spacing number for assistants; both dropped for free-text preferences, which cover spacing and everything else in one place.

**A central process** that every window, the CLI and the MCP server query is parked, not planned (2026-11-11). The concern is the connection into the application being abused, not the preferences leaking. Node's `net` module is also the way to open an outbound connection, so allowing it for one local socket leaves the offline test unable to tell the two apart unless the exception pins the exact call. The maintainer is looking for a secure way; until then the file is the plan, and the conditions of [ADR 0169](../../decisions/0169-no-live-connection-between-the-mcp-server-and-the-app.md) apply if it is revisited.
