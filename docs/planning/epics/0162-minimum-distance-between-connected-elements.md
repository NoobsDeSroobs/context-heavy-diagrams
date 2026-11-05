# 0162: Minimum distance between connected elements, in everything we tell an AI agent

## Status
In progress on the branch `epic/0162-minimum-distance` (2026-11-05). Design in [ADR 0146](../../decisions/0146-elements-joined-by-an-edge-keep-a-gap-for-the-label.md).

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
- [x] Set the floor for a horizontal and a vertical edge. Derived from the label's styling (a 23 px chip, 14 px of padding, 6.5 px a character at 12 px) and not yet measured in the app on each OS's font: an eye-check of the numbers in the running app is open
- [x] Rewrite the spacing section of the layout guide so the connected-elements rule wins over the baseline gap, with a worked example; the four recipes that put connected elements at the baseline gap (hub-and-spoke, pipeline, swimlane steps, layered) now use the connection gap
- [x] Mirror it: `SKILL.md` points to it; `AGENTS.md` and the copy-paste instructions only point to the skill; the extension's spec text is built from the same file
- [x] `validate_chd.mjs`, so `chd validate` and `validate_diagram`, warn when a label is wider than the gap it sits in (a warning, never an error), with tests
- [x] The Immich scorecard is not in the repository, so there is nothing to add
- [ ] Loosen the gallery diagrams that now warn: 22 edges in 12 files (`c4-context.chd`; `c4-container/` booking-api, booking-web-app, interop-gateway, legacy-sync, notification-service and payment-orchestration components; `security-rollup/` domain-customer, domain-payments, profile-service and ledger-service; `meridian-rail-landscape-layered/ticketing-and-booking.chd`). Each needs nodes moved and containers resized, so it wants an eye on the result in the app

## Notes
Raised while preparing the showcase video, from the layout of AI-generated diagrams.

The validator warns at the label's own width, not at the guide's figures (which add 32 px of visible line): at the full figure one edge in five of the shipped examples warned, at the label's width 22 of 206 do. An edge that leaves by the far side of an element is skipped, as in `hello-world.chd`, where the line loops round and the label is not in the gap.
