# 0177: Fewer tokens for an assistant that builds diagrams with the tools

## Status
Not Started. Logged 2026-11-06; follows the proof of concept of [0165](../completed-epics.md#0165-an-editing-tool-for-assistants).

## Goal
Shrink what an assistant has to read to build or check a diagram with the extension tools, without raising the risk of badly structured diagrams in any way that matters. One goal of the tools is to reduce the tokens a person spends on a task through an agent, so this is measured, not assumed.

## Why
A trial run built six linked Immich diagrams with the extension. Cost drivers seen:
- The spec topics (core, layout, fields, authoring) are long, and the assistant read all four.
- `inspect_diagram` is very verbose: six inspections returned roughly 4,000 lines.
- The largest single cost was hand-written `.chd` JSON through `create_file`, because `edit_diagram` deliberately cannot set notes, links or tags in the proof of concept. Adding them to `edit_diagram` is the task "Tags, notes and links as operations" in 0165, not here.

## Direction

### `inspect_diagram` (about 4,000 lines for six diagrams)
- **Compact format.** The output is pretty-printed JSON, with about 12 lines per node and 8 per edge. One line each carries the same information:
  - Node: `ctl | entity | "Controllers" | 40,50 190x80 | in api-worker`
  - Edge: `e-ctl-svc: ctl.bottom -> svc.top "calls"`
  - Expected to cut the output by roughly 5–8x and loses nothing.
- **Default handles.** Most nodes list `top,right,bottom,left`. List handles only when they are custom.
- **Narrower reads.** Add `issues_only` and an `ids` or `container` filter. After an edit, an agent usually needs only the problems and the elements it touched.
- **Overlap with other tools.** `inspect_diagram`'s `issues`, `validate_diagram`'s warnings and `edit_diagram`'s answer all report layout problems. With `edit_diagram`, `validate_diagram` is redundant. Document one check path.
- The size of an `edit_diagram` answer (id, position, size and connection points for every operation) was not measured in the trial, which used `create_file`. Measure it too.

### `edit_diagram` answers and `list_files`
Seen in the C4 run (see Notes):
- **Echo per operation.** Every operation answers with the full element. Each `add_connection_point` repeats the element with all its handles so far, so a diagram with many points pays quadratically. Answer with the new id and the changed fields only, and keep the full element for `inspect_diagram`.
- **`list_files` has no filter.** It listed the whole repository (90 locale files, 35 database schemas) and was still truncated. Add a path prefix, an extension filter and paging.

### Spec topics
- `edit_diagram` already guarantees id uniqueness, parent ordering, relative paths and serialization, and the tool descriptions list the operations and style fields. Most of the core, fields and authoring topics are hand-editing guidance that an `edit_diagram`-only workflow does not need.
- **A short `build` topic of about a page:** absolute coordinates; default sizes; container inset of 24–40px; the 20px and 60px gaps; "geometry last"; the archetype recipes; a pointer to `room_for_label` instead of the gap formulas.
- **Server instructions:** `get_format_spec` required only for hand-writing, not for `edit_diagram`.
- **What the feedback loop covers.** `edit_diagram` reports label room, overlaps, containment and edges over elements, so those rules can be short. It cannot catch aesthetics: alignment, consistent gaps and grouping. Those are what the archetype recipes and insets protect, so they stay in the short topic.

### Measuring the risk
Run the same diagram tasks (the Immich set among them) with the full spec, the short spec and no spec. Compare tokens against:
- the issue count from `inspect_diagram`;
- a few automatic checks: consistent gaps, container insets, aligned edge endpoints;
- a quick human rating.

Much of the quality side can be scripted, since the tools already compute those checks.

## Tasks
- [x] Default handles left out and one line per element (`compactJson`): done earlier, so the custom one-line text format is not built (measured 2026-11-11, see Notes)
- [x] `issues_only`, `ids` and `container` filters on `inspect_diagram` and `chd ask inspect`, with tests; an id not in the diagram comes back as `unknown`
- [x] Settle one check path: `edit_diagram` answers with the problems it touched and a count of the rest, `validate_diagram` stays for files it did not write ([ADR 0171](../../decisions/0171-an-edit-answers-with-the-problems-it-touched.md))
- [x] Short `build` topic (`references/build-guide.md`; `get_format_spec` topic `build`, `chd spec build`) and server instructions that ask for it instead of the core rules when building with `edit_diagram`
- [x] Shorter `edit_diagram` answers (new ids and changed fields, not the full element), with tests
- [x] Filtering and paging for `list_files`: done in [0178](0178-reading-large-repositories-through-the-extension.md), which designs reading large repositories as a whole
- [ ] Measure the size of an `edit_diagram` answer on a large build (first numbers below)
- [x] First task and automatic checks: `scripts/spec-comparison/` (`brief.md`, a layered shop platform of 20 elements and 16 labelled edges; `score.mjs`). One task only so far
- [x] Run the comparison (full spec, short spec, no spec), each case more than once, and record the numbers: pilot and a second round with two runs per case (see Notes); small numbers, one rater
- [ ] Decide what to keep; record the choice in an ADR

## Notes
**Measured 2026-11-11, after the first trial.** The answers already go out one line per element, and default handles are left out, so the 5–8x the custom text format was expected to give was mostly taken: `inspect_diagram` on a 16-node, 14-edge C4 diagram is 8,636 characters (about 2,500 tokens, about 290 characters an element, most of it long labels, note paths and the legend); on an 81-node landscape 49,405 characters. The same answer with only the problems is 913 and 2,219 characters, so the filters, not a new text format, are where the saving is. A line format would save the quotes and key names (perhaps a third) and cost a second shape for assistants to parse; not built.

**First numbers: a C4 set of the Immich repository (2026-11-06).** An assistant with only the extension tools, no notes, tags or links, built four diagrams (context, containers, components, code) in `immich-c4/` from a repository placed in the diagram folder. Token figures are the assistant's estimates, not measurements. All four diagrams validated with no warnings.
- `list_files` on the whole repository: about 12–14k tokens, truncated before `server/` and `web/`.
- Reading the draw.io architecture file in the repository: about 6k tokens, mostly styling attributes.
- `edit_diagram` answers: about 5k, 7k, 6k and 3k tokens for the four builds, from 27, 44, 33 and 15 operations. `add_connection_point` was the worst: 7, 10 and 3 of them on the first three diagrams, each repeating the element with its growing handle list.
- The assistant's own operation lists: about 2–3k tokens each. It worked out gaps from the layout formulas and did not call `room_for_label`.
- The spec topics were not re-read in that session, so that cost is not in the figures; a cold start would add it.
- `validate_diagram` returned nothing that the `issues` of `edit_diagram` had not already shown.

**Limits met in the same run, outside this epic** (kept here so they are not lost): `read_file` rejects source files (`.ts`, `.mdx` and others) and `list_files` does not show them, so a diagram "based on the code" can only use documentation, configuration and `AGENTS.md` files (the code followed the first wording of [ADR 0110](../../decisions/0110-claude-desktop-extension.md), an allowlist; the ADR is corrected and the extension now reads any file but the blacklisted types, so this limit no longer holds); the listing cannot be browsed by folder; there are no notes, tags or links, so the four diagrams cannot drill down into each other; entities are rectangles only (no person or database shape); edge labels are one line, which forced shortening C4-style "description [technology]" labels; whether a newline in a label works was not tried.

**Pilot comparison, one run per case (2026-11-13).** Real Claude Desktop sessions with the freshly built extension, the brief in `scripts/spec-comparison/`. Token use was not available from the app, so the cost is in calls and spec text read (bytes / 4 as the estimate).
- All three diagrams are complete (20 elements, 16 labelled edges, right layers) with no layout problems left, 30px insets, no overlaps. **A person rated them on readability alone (how the picture reads; cost and error-proneness were not part of the rating): full spec 10, no spec about 6, `build` about 4.** The checks above did not see what mattered. None has tags, a legend, highlights or icons. No spec: good structure, but Payment service sits between Order and Cart so their edges are unevenly spaced, and the CDN above the gateway instead of beside it leaves dead space. `build`: no box resized, much dead space, edge labels over arrows, several edges leaving or entering one point, and a back-and-forth route (Order service, Event bus, Notification service, Email provider). Full spec: no edge through an unrelated container, symmetrical and easy to read, compact, straight edges unless a bend was needed, a wide gateway and bus with an own connection point for each edge.
- Full spec (core, fields, authoring, layout; about 78 KB, about 20k tokens): 4 spec calls, no `room_for_label`, one `edit_diagram` call that came back clean, one inspection. Gaps from the formulas: widest (joined gap 140px), tallest canvas (1160px).
- `build` topic (3 KB, under 1k tokens): 1 spec call, 3 `room_for_label`, 6 `edit_diagram` calls, 3 inspections. The extra rounds were edge labels of the edges leaving the gateway colliding, fixed by sliding 9 labels along their edges (`labelPosition`) and styling 10 edges.
- No spec: no spec call, 2 `room_for_label`, 2 `edit_diagram` calls, 1 inspection. Five edges picked side connection points where top and bottom were wanted and were redone. No label tricks, widest canvas (1380px), joined gap 90px.
- Size of the saving: the spec text is 95% smaller (78 KB against 3.9 KB). What every session pays regardless, measured on the built server: instructions 2.9 KB and the tool list 20 KB (`edit_diagram` alone 6.8 KB), about 5.7k tokens. With the brief, the operations written and the answers, a run without spec is perhaps 15–20k tokens, so the full spec is roughly half of one run's context (an estimate, not a measurement), and it stays in context for every later call.
- So the short page saves the spec reading (about 19k tokens) but, in this run, gave the worst picture, below no spec at all. One run each cannot separate that from chance, and why the full spec did better is not known (its text does not describe the wide bar with several connection points the run used). The score script now also counts attachment points shared by several edges, box sizes, density, edges through other containers and edges against the flow: it agrees with the ratings on `build` (shared points, two edges through containers) and the full spec (none), not on dead space. The `build` page now teaches those four things; repeat the runs before concluding. Not yet measured, besides a rated repeat: the size of the `edit_diagram` answers, the tool descriptions and the server instructions, which every session pays and only token figures show.

**Second round (2026-11-14), extension `0.10.0+43c56fe`, two more runs per case, rated blind by the maintainer for readability only (0–10, nine diagrams shuffled).** Ratings by run: full-spec 8, 7, 5 (mean 6.7); `build` page 10, 6 and, from the pilot on the older page, 3 (the two on the updated page: mean 8); no spec 6, 3, 1 (mean 3.3). The maintainer's ratings of the pilot's three, given again blind, were 8 against 10 before, 3 against 4, 6 against 6.
- The updated `build` page did at least as well as the full spec on 5% of its text (3.9 KB against 78 KB), and no spec did clearly worse. The spread inside a case (5–8 full, 6–10 build, 1–6 none) is as big as the gap between full and `build`, so this is a direction, not a proof.
- Calls: full spec 8–9 diagram-tool calls (4 spec reads, 1–2 `edit_diagram`); `build` page on the updated page 8–9 (1 spec read, 3 `room_for_label`, 2 `edit_diagram`), against 14 and 6 `edit_diagram` calls on the older page; no spec 8–11 (2 `edit_diagram`). One no-spec run left a crossing it said the layout forced. No token figures were available from the app.
- The best diagram (a `build` run) is the one that kept every edge out of containers it does not belong to, as the updated page now says.
- Measures against the ratings (nine diagrams, so rough, and some were fitted to the first three): density of boxes in the canvas 0.85, edges sharing an attachment point -0.78, edges through other containers -0.72, number of different box sizes 0.69, layout problems the tool reports -0.60. Canvas size and the smallest gap between joined elements are not related to the rating.
- Caveats: the sessions ran with the repository as working folder, so its own instructions applied to every case alike; two no-spec runs found the brief copy in `scripts/spec-comparison` with a file search and, by their reports, did not open it.

**How to run the comparison.** The spec text is inlined into the extension bundle when it is built (`scripts/build-extension.mjs` replaces `extension/lib/specText.mjs`), so changing the spec or the `inspect_diagram` format needs a rebuild and a new session to load it. Once the short topic exists, the three cases can run from one build as three agents, with no rebuild between them, because the case is set by the prompt: each agent is told to read the full spec, the `build` topic only, or no topic. This does not work for the `inspect_diagram` format: it is code. Run the baseline cases on the old format first, rebuild, then repeat; or put the compact format behind a parameter so one build holds both. Each agent works in its own output folder and does not read the others'. Agents start cold, so none inherits another's context. Run each case more than once, as one run is not enough to tell a spec effect from noise. Whether a subagent can call the extension's tools, and whether its token use is reported, are to be checked before relying on this.
