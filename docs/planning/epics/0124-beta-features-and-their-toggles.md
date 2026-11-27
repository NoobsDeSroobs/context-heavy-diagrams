# 0124: Beta features and their toggles

## Status
Design decided 2026-11-27, not started. An idea since 2026-09-19 as feature toggles in general; scoped down to beta features only.

## Goal
Ship a feature in a release but dark, so a person can opt in, try it and report back, until the maintainer has the data to make it core, postpone it or delete it. Toggles to hide existing features for people who do not use them (stories, the security matrix, the minimap) are not part of this: they add settings and test states for no new learning, and can be a later epic if wanted.

## Decided (2026-11-27)
- **Where:** a "Beta features" group in Preferences (the Preferences tier of the [glossary](../../architecture/glossary.md)), one place to change the state. Help gets a "Beta features…" item that only opens Preferences at that group, so they can be found.
- **Rules for a beta feature:** marked beta in the list, off by default, opt-in, with a description of what to try. It always has a `reviewBy` date, and may carry a note on how to report back; the app is offline, so there is no usage data, only what testers and the maintainer report.
- **Only the maintainer promotes** a beta to core. He gathers the data and decides.
- **A hard review date:** a test fails once a beta's `reviewBy` has passed (system clock, no network), so it has to be decided: delete, postpone (a new date) or promote.
- **A standing step every iteration:** go over the betas left and decide delete, postpone or promote. The wording for CLAUDE.md and `docs/planning/README.md` is for the maintainer to approve.
- **Off hides the way in, never the data.** Creating and editing is gated; a diagram that already uses a beta feature still draws and round-trips for someone who has it off. A deleted beta leaves its fields in the file, ignored and kept, like any field this version does not know ([0115](../completed-epics.md#0115-fileapp-version-compatibility-and-data-loss-safety)).
- **Assistants see betas, labelled, never gated.** The CLI and the MCP server have no preferences, so they always offer a beta kind, field or operation and say it is beta. A beta that is only app UI (the outline view) has nothing to label for them.

## How
- A registry in `src/shared/` with, per beta: id, label, description, `reviewBy`, default off, and which of these it touches: app UI only, or also a kind, a field or an operation (the second kind is labelled for assistants).
- Stored in `AppPreferences` as `features: Record<id, boolean>`, merged over the defaults wherever it is received; ids the registry does not know are ignored, so a deleted beta never breaks an old preferences file.
- Labelling for assistants: an optional beta flag on a registry entry for a kind or operation; the generated kind lists in tool errors, `inspect_diagram` and the tool results then say "(beta)". `validate`, `check` and the `edit_diagram` result print one note when a file uses a beta feature ("may change or be removed"), as a note, not an error.
- The hand-written spec (`field-reference.md`, `build-guide.md`, [file-format.md](../../file-format.md)) marks each beta; a test fails if a registered beta is not marked there.
- Each toggle has a test for its off state.
- The existing "Show the AI menu" preference is not a beta and stays as it is.

## Open questions
- The first beta to try the system on: likely the outline and table view ([0125](later/0125-outline-and-table-view.md)).
- Whether the registry needs a "how to report" field, or reporting is always the same route.

## Tasks
- [ ] The registry, the Preferences group and the Help item.
- [ ] The `reviewBy` test and the off-state test pattern.
- [ ] Labelling in the CLI and MCP (generated lists, notes) and the spec-marker test.
- [ ] `docs/file-format.md`: how a beta field is marked.
- [x] The standing step in `docs/planning/README.md` and the CLAUDE.md section "Beta features" (approved and applied 2026-11-27).
- [ ] Try it on the first real beta; an example per [ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md).
