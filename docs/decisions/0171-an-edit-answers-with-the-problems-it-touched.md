# 0171: An edit answers with the problems it touched

## Status
Accepted (2026-11-11)
Supersedes: the part of [0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md) that has every answer say what is wrong with the layout so far; the rest of 0148 stands.
Superseded by: none

## Context
`edit_diagram` and `chd edit` answered every call with every layout problem in the whole diagram. In a long build one unresolved overlap is repeated in each answer, and the answers grow with the diagram. `validate_diagram` runs the same checks, so a careful assistant calls it after an edit and pays twice.

## Decision
- **An edit answers with the problems that involve an element the call touched.** Touched means made, changed or removed by one of its operations, plus everything inside a touched container (moving a container moves its contents). Problems of one kind are still collapsed into one line ([0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md)).
- **One more line gives the number of the other problems,** and says that `inspect_diagram` with `issues_only` (`chd ask inspect --issues-only`) lists them. Nothing is hidden, only not repeated.
- **The check stays inline.** An edit does not answer with a bare confirmation, and the assistant is not required to call a second tool to learn what its edit broke.
- **`validate_diagram` stays** as the read-only check of a whole file, for a file the edit tool did not just write (written by hand, by `create_file` or `update_file`, or by someone else). Its description says an edit already covers the layout.
- Both front doors use the same function, so the answers stay the same ([0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md)).

## Alternatives considered
- **An edit confirms only; a validate call must follow every change.** One more round trip per edit, and a forgotten call means no feedback.
- **Remove `validate_diagram`.** It is still the only check of a file the edit tool did not write.
- **Keep repeating everything.** Simple and always complete, but the cost grows with the diagram.
- **Report only problems that are new.** Misses a problem that existed and got worse, and needs the previous state kept.

## Consequences
- A shorter answer on a large build, and one clear job for each tool.
- A problem caused indirectly, such as moving an element so that two others collide, shows in the answer only as part of the count. A final `issues_only` inspection is how a build is checked at the end.
