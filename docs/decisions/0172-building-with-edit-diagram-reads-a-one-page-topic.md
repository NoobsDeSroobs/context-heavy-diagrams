# 0172: An assistant building with edit_diagram reads a one-page topic

## Status
Accepted (2026-11-14)
Supersedes: the part of [0110](0110-claude-desktop-extension.md) and [0138](0138-the-mcp-server-carries-the-guidance-the-cli-carries-the-checks.md) that has every assistant read the core rules before it creates or edits a diagram; the rest of both stands.
Superseded by: none

## Context
The core rules and the three references an assistant read before drawing came to about 78 KB, most of it about writing the JSON by hand: ids, parent order, relative paths, serialisation. `edit_diagram` guarantees those, so an assistant using it paid for text it could not use, in every session and again with every later call, since it stays in the context. What an assistant that cannot see the picture still needs is how to place things: sizes, gaps, insets, how to give edges room for their labels, and what makes a drawing read well.

## Decision
- **`get_format_spec` has a topic `build`, and `chd spec build` prints the same page** (`references/build-guide.md` in the skill, about 4 KB): what the editing tool does and leaves to the assistant, the order to work in, the numbers (gaps, insets, label room), and short recipes for common shapes. It says what the answers' checks cannot judge: alignment, even spacing, grouping, short straight edges, wide hubs with a connection point for each edge, not crossing a container an edge does not belong to.
- **The server instructions and the tool description tell an assistant that builds with `edit_diagram` to read that topic and nothing else.** The core rules, without a topic, are for writing a diagram by hand with `create_file` or `update_file`, and the skill's own text says the same.
- **The other references stay as they are,** one topic per call, for what the page does not cover.
- **The server tells the assistant its own version** (the package version and the commit it was built from), so a person can tell which build is installed.

## Alternatives considered
- **Keep reading everything.** The most complete, and the most expensive, for guidance that mostly concerns a way of working the tool replaces.
- **No spec for an assistant that uses the tool.** Cheapest; the diagrams a person rated for how readable they are came out clearly worse, since the checks in the answers cannot say how a drawing should look.
- **Shorten the core rules in place.** One text for two ways of working, so each reader gets less than they need or more than they use.

## Consequences
- A shorter start for the common case, and one more topic to keep true when the tool changes: its numbers come from the layout checks and the label geometry, and a test keeps its size to about a page.
- The page is advice. What the checks report is still what the assistant is told to fix; the page is for what they do not report, and it moves into the checks when one can be written.
