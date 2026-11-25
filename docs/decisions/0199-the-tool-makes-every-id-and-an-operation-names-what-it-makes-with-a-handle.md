# 0199: The tool makes every id, and an operation names what it makes with a handle

## Status
Accepted (2026-11-25)
Amends: [0148](0148-an-assistant-builds-a-diagram-by-operations-that-answer.md) (the operations no longer take an `id` for what they add) and [0060](0060-detail-file-naming-convention.md) (the name of a note comes from an id the tool made).
Superseded by: none

## Context
A person and an assistant should be able to do the same things, and differ only in how: one element at a time or in bulk, and in the format they write. Only the application names and writes files. A person never types an element's id, and a note's file name is made from the label and the end of the element's id (0060), so an assistant that could choose ids could choose the tail of a file name.

The add operations took an optional `id`, which let one call add an element and connect to it, note it and tag it without knowing its real id first. That is the one thing a handle must still allow.

## Decision
- **The tool makes every id.** `add_entity`, `add_container`, `add_text`, `add_behaviour`, `add_line`, `connect` and `add_legend_entry` take no `id`; one is refused with a message that says why. The answer gives the id each operation made.
- **A handle names what an operation makes, for the rest of that call.** An add operation takes `"as": "$name"` (a `$` and then letters, digits, `.`, `_` or `-`, up to 32), and a later operation of the same call writes `$name` where it would write an id (`id`, `from`, `to`, `parent`, `ids`). The answer shows each handle beside the id it got. A `$` can never start a real id, so a handle cannot be mistaken for one.
- **A handle is not an id and is never kept.** It is resolved when the operation is read, is never written to the file, and does not exist in the next call, which uses the ids from the answers. A handle that was not made earlier in the call, or is made twice, or is badly written, fails the whole call with the operation named.
- **The same for the command line and the Claude Desktop extension.** Both run the same operations.

## Alternatives considered
- **No handles: make the elements in one call, and everything that points at them in the next.** Needs nothing new, but the assistant must copy 36-character ids exactly into every edge, note and tag, which it does badly. Nested containers need the parent made first, or a `reparent` afterwards, and a half-built diagram sits on disk between the calls.
- **Let the assistant keep choosing ids.** Simplest, and it keeps the operations as they were. It lets an assistant name a note's file, which a person cannot.
- **Handles that live across calls.** An assistant would then be naming things again, in a way the file does not show. The tool's code is what keeps a handle to one call, and a test fails if one reaches a file or a later call.

## Consequences
- An assistant or script that sends `id` on an add operation is refused and must use `as`. The skill, the tool descriptions and the command line's help say so.
- A note's file name always comes from an id the tool made, so the app and an assistant name it alike.
- An id in a file written before this (a short one like `api`) stays valid and is still used whole in a note's name.
- Legend entries take handles too, so one call can add a line and set it as the line for new edges.
