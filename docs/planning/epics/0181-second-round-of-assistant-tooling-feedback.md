# 0181: Second round of assistant tooling feedback

## Status
Not Started. Logged 2026-11-07; for after the first release of the assistant tools.

## Goal
Small gaps found by the second Immich trial (a run of 238k tokens of context, against 285k before the shorter answers).

## Tasks
- [x] `list_files` says when files deeper than its 12 levels were left out (a folder listed from inside reached 4 more files than the same folder listed from above)
- [ ] Creating a diagram can copy the setup (required tags, highlights, legend, no elements) from an existing file, so a set of linked diagrams is not set up four times
- [ ] The layout check flags an edge label that sits on a container border
- [ ] `get_format_spec` description sends `edit_diagram` users to the layout topic only (see the `build` topic in [0177](0177-fewer-tokens-for-assistant-diagramming.md))
- [ ] `inspect_diagram` `ids` filter (also in 0177)

## Notes
Left out on purpose: a legend generated from the highlights (the legend does not hold highlights, [ADR 0033](../../decisions/0033-diagram-legend-design.md)); a description field for entities (tags and notes carry it); a rendered preview for the assistant ([0167](0167-assistants-can-see-their-own-output.md)).
