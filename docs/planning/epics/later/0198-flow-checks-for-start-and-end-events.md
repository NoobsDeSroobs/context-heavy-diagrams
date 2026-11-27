# 0198: Flow checks for start and end events

## Status
Not Started, parked. An idea from the 0194 design talk (how the event kinds are meant to be used); it does not depend on that epic's marks or colours, but the start/in-flow toggle makes the second check possible.

## Goal
Flag the diagram mistakes that the meaning of a start and an end event already rules out, in the Diagnostics panel, so a person or an assistant sees them without reading the diagram.

## Tasks
- [ ] An end event with an outgoing edge is flagged: an end finishes its path and starts nothing.
- [ ] Once the start/in-flow toggle exists ([0194](../0194-one-diagram-several-views-visibility-sets-and-stories.md)): an event set to "starts a flow" with an incoming edge, and an event set to "in the flow" with none, are flagged as not agreeing with their position.
- [ ] Decide where the checks live: a built-in Diagnostics section, or rules a diagram metamodel can switch on, so `chd check` reports them too.

## Notes
- Not enforced anywhere: drawing is never refused, the check only reports.
- Whether a flow may have several starts or ends, and whether a node with no way out that is not an end is also a mistake, are open and left out until someone asks.
