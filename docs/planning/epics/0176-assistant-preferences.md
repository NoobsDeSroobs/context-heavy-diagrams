# 0176: Assistant preferences

## Status
Not Started. Logged 2026-11-05 as a label padding setting; redirected 2026-11-11 to the person's preferences for an assistant. Follows [0162](../completed-epics.md#0162-minimum-distance-between-connected-elements).

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
- **Where the text lives.** The server has no live connection to the app ([ADR 0169](../../decisions/0169-no-live-connection-between-the-mcp-server-and-the-app.md)) and the extension reads only the diagram folder. Leaning: a Markdown file in the diagram folder with a visible name (dot-files cannot be opened, [ADR 0110](../../decisions/0110-claude-desktop-extension.md)), created and edited from the AI menu, per project. Alternatives: the integration's setup (`user_config`, the `chd mcp` flag; awkward for long text), or one per-person file the person points the integration at. A person-wide default in Preferences that seeds the file is a later step.
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
