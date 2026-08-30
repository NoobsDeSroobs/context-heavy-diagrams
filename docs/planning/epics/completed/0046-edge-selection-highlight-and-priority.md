# 0046: Edge selection highlight and grab priority

## Status
Done (2026-08-21).

## Goal
Two related asks, both about making it easier to work with edges that converge or overlap at one point:
1. **Visual feedback on selection** — a selected edge should look visibly selected (the user's suggestion: render it a little thicker), the same way selected nodes already get visible feedback.
2. **Grab priority** — once an edge is selected/clicked, it should take precedence for future grab/drag interactions at that location, so a user can reliably move *that specific edge* even when several edges meet at the same node or connection point, rather than fighting over which one the next click happens to hit.

## Relevant existing behavior
`LabeledEdge.tsx` didn't use React Flow's `selected` prop at all, and there was no CSS anywhere targeting a selected-edge state — edges had zero visual selection feedback going in.

## What actually happened investigating Part 2
The obvious theory going in — React Flow's `elevateEdgesOnSelect` (on by default, never overridden here) already bumps a selected edge's z-index by 1000, which should make it win future hit-tests "for free" — turned out to be wrong, or at least not the actual explanation. The user tested it directly on a real shape ("Many From Same Point", three edges into one connection point, labeled 1/2/3 in creation order) and found the *reconnect handle* (the small circle you drag to move an edge's endpoint) always belonged to edge 3 — the last-created one — regardless of which edge was selected. Reading the React Flow source further didn't turn up why the z-index elevation isn't winning that tie in practice; rather than keep chasing that, the fix targets the mechanism the user's own test actually implicated: **DOM/creation order**, which the user identified correctly from direct observation.

The user also floated an alternative: at pointerdown, read every element under the cursor (`elementsFromPoint`) and prefer the currently-selected edge if it's among them. That's a sound idea and was kept in reserve, but it requires intercepting and re-dispatching real browser events (capture-phase listener, `stopImmediatePropagation`, synthetic re-dispatch onto the correct DOM node) — real complexity. Reordering *what the browser's own native hit-test sees* is simpler and gets the same result without any event interception, so it was built first.

## What was built
- **Part 1 — thicker stroke on selection.** `LabeledEdge.tsx` now destructures `selected` and adds a flat `SELECTED_STROKE_WIDTH_DELTA` (2px) on top of whatever width the edge already resolves to (explicit `strokeWidth`, or the highlight override, or the 1px default) — additive, not competing, so a highlighted *and* selected edge just gets both effects layered. Answers the epic's own open question about highlight/selection precedence: there isn't one, because they compose instead of overriding each other.
- **Part 1b — visible reconnect handles on selection** (the user's own follow-up idea, offered as "not required" but cheap to include). React Flow's reconnect-handle circles render fully transparent by design (`fill`/`stroke: transparent`, SVG presentation attributes). A CSS rule, `.react-flow__edge.selected .react-flow__edgeupdater`, overrides those attributes (class selectors beat presentation attributes) to show a small solid dot — no JS needed, and it makes Part 2 visually checkable. Iterated a few times on sizing after the user saw it live: started at radius 12 (bigger than React Flow's own default 10px grab target), then 6 (about half, per the user's next ask) — but that left the visible dot *smaller* than the actual (still-invisible) grab area, which wasn't quite what was wanted either. Landed on shrinking the real grab area to match instead: `Canvas.tsx`'s `reconnectRadius={8}` prop and the CSS `r: 8` are now the same number on purpose, so the visible dot *is* the grabbable area, not an approximation of it.
- **Part 2 — grab priority via render order, not z-index.** `Canvas.tsx` now computes `orderedEdges`, a derived array with selected edges moved to the end (stable partition, same pattern `zIndexedNodes` already established for containers-behind-shapes) — passed to `<ReactFlow edges={orderedEdges}>` instead of the canonical `edges` state. The real `edges` state (save order, undo history) is untouched; this is a rendering-only concern, exactly like `zIndexedNodes`.

## Answers to the epic's original open questions
- **Highlight/selection precedence**: resolved by making them additive (see Part 1 above) — no precedence needed.
- **Exact grab-priority mechanics**: DOM/paint order, driven by array position, not a temporarily-enlarged hit area or a z-index change. Confirmed necessary by the user's own direct test, not assumed.
- **Relationship to epic 0043**: doesn't need to wait on or feed into the general layer/z-height control epic — this uses plain array reordering, not a new z-index model.

## Verification
Clean typecheck. Browser-based interactive verification was attempted (adding two shapes worked; connecting them with a real edge requires a drag gesture, which synthetic pointer events don't reliably trigger in this environment, and the dev-server connection itself dropped mid-session) — **not visually verified in-session**, same limitation as epics 0042/0045. Worth checking directly on the "Many From Same Point" shape that motivated this epic: select edge 1, confirm it thickens and its endpoint dots appear, then confirm grabbing at the shared point now moves edge 1 rather than edge 3.

## Notes
If the render-order fix turns out not to fully resolve it in practice, the `elementsFromPoint`-based click interception the user proposed is the documented fallback — see "What actually happened investigating Part 2" above for the approach.
