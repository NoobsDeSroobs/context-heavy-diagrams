# 0193: Revamp the examples, with FUTO's products as real examples

## Status
Not Started. Logged 2026-11-17, rewritten 2026-11-27. FUTO replied to the maintainer (received 2026-11-13) that they have no objection: Immich is AGPL, which allows it, and Grayjay is under FUTO's own licence, which allows non-commercial research, so analysing the code and publishing the analysis is within the licence as long as their software is not resold. The work starts once the branch holding 0124 is merged.

## Goal
Examples that are good and current: a few strong diagrams that show what the tool can do and what a medium-sized project looks like when it is readable, and a way for a new person to get going. The current ones are bloated, outdated and uneven.

## Principles (the maintainer, 2026-11-27)
- **Examples show the tool, not the architecture.** A wrong detail in a drawing of a real product is fine: the point is what the tool can do and what an assistant can generate, and a real product changes anyway. Each set says it is our reading, drawn on a date from a version, not the product's documentation. That one line is also what keeps the Grayjay set inside its licence; no verification pass.
- **Real products, not made-up ones.** A synthetic example hides simplifications and assumptions; a real product brings real complexity and is more believable. Read each product's licence first; names only, no logos, no suggestion that FUTO endorses the tool. No code, text or images of a product go into the repository.
- **Several features in one diagram is fine**, as long as it stays clear to the reader. A feature does not need a diagram of its own ([ADR 0151](../../decisions/0151-every-visible-feature-has-an-example-diagram.md) says an example is extended, not duplicated).
- **Revamp, not wipe.** Delete what is better replaced or has no use, create what is missing, update what is outdated. Some files stay because something reads them (below).
- **A size budget**, so the new ones do not bloat: about 30 to 60 elements per diagram, drill-down links for anything bigger, one stated purpose per file in the README.
- **Built with the assistant tools** where it is sensible, and said so in the README. What got in the way is a finding for the tools' epics, not a workaround in the diagram.

## The tutorial
A `welcome.chd` with a story: open it, press F5 for the guide, and press Ctrl+N for a blank window beside it to repeat the steps (drag an Entity onto the canvas, write a label, drag an edge out to make a new entity). The story steps reveal the instructions through visibility sets; the second window is where the person does them. It is also the example for stories. `docs/getting-started.md` stays the written version.

## What reads the examples (do not break)
Tests read `examples/conformance/` by name (`checkCommand`, `parity`), `Canvas.test.tsx` and `diagramConversion.test.ts` read example files, and `drawio.test.mjs` walks every example (a new one is covered by itself). `hello-world`, `with-icons` and `with-metadata` are round-trip fixtures that the docs link to. `life-parallel-selectors` is named in an edge-culling test and in `known-issues.md`; `paste-a-table.csv` in a bulk-create test; `gallery/technical/security-rollup` in the getting-started page. Check each reference before a file goes.

## Tasks, in this order
- [ ] **1. The feature list in four tiers:** low impact or basic; core, what every user needs and expects; good, what empowers the user; defining, the main sales pitch. Drafted from the README, the changelog and the getting-started page with proposed tiers; the maintainer decides them.
- [ ] **2. Group the features** (dropping the low tier where it needs no example) into logical groups that are shown together.
- [ ] **3. The list of diagrams wanted:** one per group, plus the ones that help a person get going (the tutorial, hello-world and the like). Decide here whether the Meridian Rail gallery stays as the home of the tag, highlight and security-matrix showcases or is folded in; an ADR if the layout of the examples changes.
- [ ] **4. Sort every existing file** into noise (can go), uncertain and needed, with a column for what refers to it.
- [ ] **5. Decide each:** delete, rework, update or keep.
- [ ] **6. Map the survivors onto the list from 3** and find the gaps.
- [ ] **7. Make the diagrams that fill the gaps,** the real-product sets among them (Immich first; two or three products to start; each names the version and date it was drawn from). Each set: a context diagram, a drill-down by container and component through linked diagrams, one flow with behaviour in lanes (for Immich, an upload to a backed-up photo), tags with a highlight, visibility sets and a story, a short note per element.
- [ ] **Record the go-ahead in the repo** (`docs/licensing.md`): the date and what the reply covers (analysis and publication of the analysis, no reselling), paraphrased, with no names or contact details; and how the examples credit the products. Before the first real-product set is published.
- [ ] **Update the indexes:** `examples/README.md`, the gallery README, the root README and [docs/comparison.md](../../comparison.md) where they name examples; every example validates and opens in the app.

## Notes
- The same drawings can serve as the tool's first honest test of drill-down at a realistic size.
- A diagram that has drifted from its product is a known state of an example, not a bug.
- Real systems change; the dated version in each set says when it was drawn.
