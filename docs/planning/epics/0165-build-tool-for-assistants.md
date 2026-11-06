# 0165: An editing tool for assistants: the steps a person takes, and questions about layout

## Status
In progress on the branch `epic/0165-build-tool-for-assistants` (2026-11-06); direction agreed, design open, nothing built yet. (The file keeps its first name; the first idea, a one-shot spec like D2, was dropped.)

## Goal
An assistant draws and edits a diagram by doing what a person does, one step at a time, and each step answers with what it made, so the next step can use it: create boxes, move them, connect them, style them, add notes and links. The assistant decides spacing and layout. The tool helps it get that right by answering questions ("how much room does an edge labelled X need?", "what is wrong with this layout?"). No assistant writes a generator script again, and the result is the same on any machine.

## Why
In both trial runs the assistant wrote its own generator, about 1,000 lines each: ids, parent ordering, tags on every element, handles, key order, relative paths for notes and links, and a check that edges did not run through boxes. One run also wrote a simulated-annealing search to place a data model. A script needs a runtime the machine may not have (Node on one, Python on another, neither on a third), while the command line and the MCP server run without a system runtime ([ADR 0106](../../decisions/0106-chd-command-line-tool.md), [ADR 0110](../../decisions/0110-claude-desktop-extension.md)). Each generator also re-implements the format's traps, and one got a handle wrong.

## Direction
- **Not a description language.** A spec the tool turns into a diagram is D2-like and leaves the assistant guessing; it also hides the step-by-step loop a person has. Dropped.
- **Operations that mimic the user.** Add an entity, container or text; move, resize, nest; label; connect two elements (with the connection point on each); add connection points; style an element or an edge; set tags; add a note; add a link. Each answers with the element it made or changed (id, position, size, the ids of its connection points), so the assistant adjusts and goes on.
- **The assistant decides where things go.** The tool never lays out for it.
- **Questions the assistant can ask:** the room an edge label needs in a given direction with given end graphics (already built, [ADR 0146](../../decisions/0146-elements-joined-by-an-edge-keep-a-gap-for-the-label.md)); what is wrong with the layout so far (overlaps, elements outside their container, labels that do not fit, an edge through a box, which is also the geometry report of [0167](0167-assistants-can-see-their-own-output.md)); a compact list of the elements with their absolute positions and connection points.
- **Writes** follow [ADR 0109](../../decisions/0109-stale-edit-check-for-every-ai-write-path.md): creating fails if the file exists; every later step is conditional on the fingerprint the previous step returned.
- **Escape hatch:** whatever the operations cannot express still goes through the raw create and update tools.

## Questions to settle first
- **Where the operations run.** (a) A headless editing core in shared code, working on the file: works with the command line and the Claude Desktop extension without the app open, and is testable. Cost: a second implementation of each edit the app already does in the editor. (b) The running app executes them, so the person watches boxes appear, undo works and no logic is duplicated ([0163](0163-mcp-server-connected-to-the-running-app.md)). Cost: the app must be open and there is a security design to do first. Leaning: (a), with the operations defined as data, so (b) can run the same vocabulary later.
- **How a call looks.** One `edit` tool taking a list of operations (fewer tools in the assistant's context; `chd edit` can read the same list from standard input), or one tool per operation.
- **Ids.** The tool makes them, or the assistant may give a short one it can refer to in the same call.
- **How much of the editor in the first version.** Likely: entities, containers, text, move, resize, nesting, labels, connections with connection points, styles passed through to the file's own style fields, tags, notes, links, delete. Left for later: align and distribute, edge points, the security matrix, icons.
- The former questions on the write scope and on how a spec would be checked are open until the above is settled.

## Risks
A second implementation of the editor's edits that drifts from the app; an operation set too small to be useful or so large it is the whole editor; answers that are too long for the assistant to read at each step.

## Tasks
- [ ] Decide where the operations run and how a call looks (ADR)
- [ ] The operation vocabulary as data, and the answer each one gives
- [ ] The editing core in shared code, with tests that every result passes the validator and serialises as the app does
- [ ] The questions: room for a label (exists), layout issues, element list
- [ ] The command line (`chd edit`, `chd ask`) and the MCP tools, with the parity test of [0166](0166-mcp-and-cli-parity.md)
- [ ] Guidance: update the skill, `AGENTS.md`, the extension's instructions and the copy-paste text to prefer it
- [ ] Re-run an assistant on a large project and compare against the hand-written generators

## Notes
Raised after the first trial runs. Redirected 2026-11-06: the first design, a compact spec with tool-made placement, was set aside because the maintainer wants the tool to simulate what a user does, with the back and forth that implies.
