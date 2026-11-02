# 0162: Minimum distance between connected elements, in everything we tell an AI agent

## Status
Not Started. Parked on purpose; do not forget it.

## Goal
Every piece of guidance we hand an AI agent that draws diagrams says: two entities or containers joined by an edge must be far enough apart for the edge to be seen and its label to be read, and the distance depends on the label.

## Why
The layout guide already says an edge label needs roughly 100-160 px of clearance, but its spacing rules also say to put closely related shapes 20 px apart. Two shapes joined by a labelled edge at 20 px leave no room for the label, so the two rules contradict each other and a generated diagram follows the 20 px one. Auto-layout is parked ([0126](later/0126-auto-layout.md)), so the agent's placement is the layout.

## Where the guidance lives
- `resources/ai/skills/chd-diagrams/references/layout-guide.md` (spacing, label clearance) and `SKILL.md`
- `resources/ai/AGENTS.md`, which the folder setup writes
- `extension/lib/specText.mjs`, which serves the same layout reference to the Claude Desktop extension
- the copy-paste instructions and `docs/architecture/ai-integration.md`
- the repo's own copy under `.claude/skills/chd-diagrams/`

## Rule to write
- The gap between two connected elements is measured edge to edge, between their bounding boxes, and has a floor that grows with the edge label: no label, a short one, a long one. The numbers come from measuring real labels in the app, not from the 100-160 px rule of thumb.
- The floor applies along the edge's direction, so a label on a vertical edge needs height, not width.
- The loose and baseline gaps in the layout guide stay for elements that are not joined by an edge; say so, so the two rules stop competing.
- Edges between a container and an element inside it are not covered; the rule is about siblings and about different containers.

## Tasks
- [ ] Measure how much clearance a label needs at the default font, for a horizontal and a vertical edge, and set the floor
- [ ] Rewrite the spacing section of the layout guide so the connected-elements rule wins over the baseline gap, with a worked example
- [ ] Mirror it in `SKILL.md`, `AGENTS.md`, the extension's spec text and the copy-paste instructions
- [ ] Decide whether `validate_chd.mjs`, `validate_diagram` and `chd validate` warn when connected elements are closer than the floor (a warning, never an error)
- [ ] Add the rule to the layout line of the Immich experiment scorecard, if that experiment is kept in the repo
- [ ] Re-check the gallery examples against the new floor

## Notes
Raised while preparing the showcase video, from the layout of AI-generated diagrams.
