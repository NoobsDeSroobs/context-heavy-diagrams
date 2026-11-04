# 0143: The extension writes architecture profiles

## Status
Accepted (2026-11-04). Widens [ADR 0110](0110-claude-desktop-extension.md), which allowed writing only `.chd`, `.md`, `.txt` and `.svg`.

## Context
The extension applies a profile (`check_diagram`, [ADR 0131](0131-conformance-profiles.md)) but could not help write one, although drafting the rules with the person is where an assistant helps most; the command line route writes the file with the agent's own tools and tests it with `chd check`.

## Decision
- **A file whose name ends in `.chdprofile.json` can be created and updated.** No other `.json` file can; the set of writable names stays narrow.
- **It is validated before it is written,** with the reader `chd check` uses, and refused with the same message if it does not parse or is not a valid profile. A refused create leaves nothing behind.
- **The stale-edit check applies** ([ADR 0109](0109-stale-edit-check-for-every-ai-write-path.md)): an update needs the fingerprint of the version it was based on, a create fails if the file exists, and updates stay behind the person's opt-in.
- **No guard against an assistant fitting a profile to its own diagram.** A profile and the diagram it is checked against can come from the same session, and the server cannot tell sessions apart. What a green check is worth is for the person to judge, who owns the rules and the result; the skill's "ask what the rules are" step is about getting the right profile, not about trust.

## Alternatives considered
- **Leave profiles to the person's editor.** The loop of drafting, checking and adjusting then breaks in the extension, the one route with no shell.
- **Allow every `.json` file.** Anything an app reads as configuration would become writable.
- **Refuse diagram edits after a profile was written, in the same session.** Sessions are invisible to the server; a block on the process would be porous and stop legitimate work.

## Consequences
- A profile is plain JSON for version control and for `chd check` in a pipeline, which stays the authority.
- Writing a profile gives an assistant no more reach than writing a diagram: it is data, never run.
