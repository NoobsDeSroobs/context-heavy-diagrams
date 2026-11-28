# 0210: Metadata and context on behaviours

## Status
Not Started. Logged 2026-11-27, to be picked up after the examples revamp has shown what a real flow wants to say about its steps.

## Goal
Decide what, if anything, a behaviour (a step, a branch, an event) should carry beyond its kind, label and one link, so that flows are as context-heavy as the rest of the tool without a step becoming an entity with a different shape.

## The worry (the maintainer's, to hold every option against)
A behaviour must not turn into **just another entity with a different look**. If a step gets the same tags and the same note as an entity and nothing else, the kinds, lanes and flow edges become a skin, and the two element types are one type with two styles. Whatever is added has to say something about a step that an entity cannot: when it runs, who or what does it, what it needs and produces, how it ends. The opposite risk is real too: a flow whose steps carry no context is a second-class diagram in a tool about context.

## What there is today
- A behaviour has a kind, a label (outside the small shapes), an end's outcome and reach, an event's position, and **one link** to another diagram. It has **no tags and no note** (the rule stated in the edit help, `src/shared/edit/help.ts`).
- Behaviours sit in containers, so a lane is a container; edges, legend and visibility sets work on them.
- The set is the tool's own vocabulary and BPMN is only a source of words ([ADR 0080](../../decisions/0080-behaviours-are-the-tools-own-flow-vocabulary-with-semantic-not-symmetric-symbols.md)).

## The maintainer's seed idea
Levels that alternate. A flow diagram at one level points, from a step, to a technical diagram underneath; an entity in that diagram points to a flow diagram of its own, and so on down. The link on a behaviour already allows this. What is open is whether the drill-down is the context (the step is thin and what it links to carries the detail), or whether the step also carries something itself, and whether anything rolls up through such a chain the way the security scores do through linked diagrams.

## Options to compare (none chosen)
- **A. The same tags and note as an entity.** Cheapest, and highlights, the peek card, required tags and search work on steps at once. This is the option the worry is about: on its own it makes a step an entity in costume.
- **B. Fields of a step's own,** for example the actor or system that performs it, what it reads and writes, how long it takes, what triggers it. Honest to what a step is, but each field is a file-format addition and a new thing for every assistant surface to learn.
- **C. Nothing on the step; the link carries it.** The seed idea above. Keeps behaviours light, and puts the context in the diagram below. The cost is a step whose peek card is empty unless it links somewhere.
- **A mix,** such as a note and a link only (no free tags), or tags for highlighting with fields for what is specific to steps.

## Questions to answer first
- What do people draw a flow *for* in this tool, and what do they want to read on a step when they hover it? The first real-product flows (the Immich upload, in the examples revamp) are the test, drawn with today's tools to see what is missing.
- Should a step's tags take part in highlights, the legend and required tags, and in the security rollup?
- Should the peek card show something for a behaviour, and what?
- Does an entity linking to a flow, and a step linking to a technical diagram, need any support beyond the link (a back-reference, an indication on the element that there is a diagram below)?
- Which assistant surfaces change (`add_behaviour`, the CLI, the MCP tools, the skill files, `docs/file-format.md`), and does any part need a beta first?

## Tasks
- [ ] Draw the Immich upload flow (and one other real flow) with the current tools and list what the steps lack, with the maintainer.
- [ ] Choose between the options, or a mix, with the worry above as the test for each field.
- [ ] If a field or a tag is added: schema in `src/shared/`, file-format spec, editor, peek card, assistant surfaces, an example, and the changelog. An ADR only if the maintainer agrees one is warranted.
- [ ] If the answer is option C: make the drill-down between flows and technical diagrams visible and easy (and show it in an example), and write down why a step carries no context itself.

## Notes
Raised while sorting the feature list for the examples revamp: behaviours are Good for now, and "how behaviours and entities fit together" is the candidate for a defining feature if they come to share more than they do.
