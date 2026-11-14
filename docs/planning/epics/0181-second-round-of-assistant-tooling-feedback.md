# 0181: Second round of assistant tooling feedback

## Status
Not Started. Logged 2026-11-07; for after the first release of the assistant tools.

## Goal
Small gaps found by the second Immich trial (a run of 238k tokens of context, against 285k before the shorter answers).

## Tasks
- [x] `list_files` says when files deeper than its 12 levels were left out (a folder listed from inside reached 4 more files than the same folder listed from above)
- [ ] Creating a diagram can copy the setup (required tags, highlights, legend, no elements) from an existing file, so a set of linked diagrams is not set up four times
- [ ] The layout check flags an edge label that sits on a container border, including one squeezed into the gap between an element outside the container and its wall while the container has room (seen in the spec comparison of 0177)
- [ ] The layout check flags an edge label that covers a container's own label (the check only looks at entities and text today, `solid` in `edgeRouting.ts`)
- [x] `get_format_spec` description sends `edit_diagram` users to the `build` topic (done with 0177)
- [x] `inspect_diagram` `ids` filter (done with the filters of 0177)

## Notes
Left out on purpose: a legend generated from the highlights (the legend does not hold highlights, [ADR 0033](../../decisions/0033-diagram-legend-design.md)); a description field for entities (tags and notes carry it); a rendered preview for the assistant ([0167](../completed-epics.md#0167-an-assistant-can-see-the-diagram-it-drew)).
