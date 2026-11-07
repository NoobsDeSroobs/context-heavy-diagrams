# 0151: Every visible feature has an example diagram

## Status
Accepted (2026-11-07). Replaces the open-ended gallery programme described in [ADR 0028](0028-example-gallery-shared-landscape-and-domain-folders.md); the gallery itself stays.

## Context
The example gallery was run as a continuous effort: a long list of diagram types to attempt, revisited whenever a feature landed. It never finished and did not fit the life of a task, and the list of types to draw said little about which features had a diagram that shows them.

## Decision
- A change that adds a feature people will see adds or extends a diagram under `examples/` that shows it, in the same change.
- `examples/README.md` names each example and what it shows, so a feature can be found by looking there.
- Existing examples are kept and extended, not duplicated: a feature joins a diagram that already suits it when one does.
- There is no standing list of diagram types to work through. A new example is made when a feature or a kind of use has nothing to show it.

## Alternatives considered
- **Keep the gallery as an ongoing task.** It never reaches done and tracks diagram types, not features.
- **Document features in prose only.** A diagram opened in the tool shows what a description cannot, and doubles as a fixture that the app still opens it.

## Consequences
- The gallery's current diagrams remain; the unbuilt entries of the old list are dropped.
- A feature without an example is incomplete in review, like one without a test.
