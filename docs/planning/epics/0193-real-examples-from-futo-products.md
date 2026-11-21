# 0193: Clean up the examples, with FUTO's products as real examples

## Status
Not Started. Logged 2026-11-17. FUTO replied to the maintainer (received 2026-11-13) that they have no objection: Immich is AGPL, which allows it, and Grayjay is under FUTO's own licence, which allows non-commercial research, so analysing the code and publishing the analysis is within the licence as long as their software is not resold.

## Goal
Make the examples easy to find and trustworthy: sort the feature fixtures from the showcase diagrams, and add real systems drawn from FUTO's public source and documentation next to the fictional Meridian Rail gallery, so a reader sees the tool on something they can check.

## Direction (2026-11-21)
The maintainer wants a complete revamp of the examples: a few strong ones modelled on real products such as Immich, in place of many small contrived ones. The visibility sets (today and proposed) and the behaviour symbols should be shown in them.

## Tasks
- [ ] **Record the go-ahead in the repo** (`docs/licensing.md`): the date and what the reply covers (analysis and publication of the analysis, no reselling), paraphrased, with no names or contact details; and how the examples credit the products (names only, no logos, no suggestion that FUTO endorses the tool).
- [ ] **Survey the examples folder:** classify every file as a feature fixture (one feature, small), a round-trip fixture, a gallery diagram or a limits test; list overlaps (`stencil-kinds`, `process-flow-stencils` and `process-flow-all-behaviours` show much the same), dead files and names that say nothing. Features keep an example ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md)); the round-trip fixtures stay.
- [ ] **Choose the products:** two or three to start, from what FUTO publishes (Immich is the first candidate; the second Immich trial of the assistant tools is already behind us). For each, read its licence first. Grayjay is under FUTO's own licence, which is not an open source licence, and FUTO's reply allows it only as non-commercial research: its example says so in its README and is called analysis, not part of the product.
- [ ] **Decide the folder layout and the fate of the fictional gallery** (keep Meridian Rail for tag, highlight and security-matrix showcases, or fold it in); an ADR, since it replaces the layout of [0028](../../decisions/0028-example-gallery-shared-landscape-and-domain-folders.md).
- [ ] **Build one set per product from its source and docs:** a context diagram, a drill-down by container and component through linked diagrams, one flow with Behaviour in lanes (for Immich, an upload to a backed-up photo), tags (owning component, kind of data) with a highlight, and a note per element saying where the fact comes from (a file or a page). Each set names the version it was drawn from and the date.
- [ ] **Check every statement against the source** (a local clone, never the network from the app or the assistant tools); what cannot be confirmed is left out or marked as unsure. The maintainer reviews each set in the app.
- [ ] **Use the assistant tools to draw them** where it is sensible, and write what got in the way as a finding for the tools' epics (the same way the Immich trials did), not as a workaround in the diagram.
- [ ] **Update the indexes:** `examples/README.md`, the gallery README, the root README and [docs/comparison.md](../../comparison.md) where they name examples; every example validates and opens in the app.

## Notes
- Real systems change; a dated version in each set says when it was true, and a diagram that has drifted is a known state of an example, not a bug.
- The same drawings can serve as the tool's first honest test of drill-down at a realistic size.
- Facts about a product are not copied text: describe in our own words, and keep each note short. No code, text or images of a product go into the repository: a set holds only a diagram of what we understand its architecture to be, using the names its own components have. Each set says it is our reading, not FUTO's documentation. For Grayjay that is also what keeps the examples inside its licence.
