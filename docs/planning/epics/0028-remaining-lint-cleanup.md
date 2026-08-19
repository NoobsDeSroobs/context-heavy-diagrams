# 0028: Remaining lint cleanup (Fast Refresh export rule, effect-reset pattern)

## Status
Not Started

## Goal
Fix the last 4 pre-existing ESLint errors left after the easy ones were cleaned up alongside epic 0004 (an unescaped apostrophe, and a genuinely-unnecessary `useState`+`useEffect` in `IconPicker` that's now a plain derived value). These 4 are lower-priority specifically because none of them are actual bugs — they're real code that works correctly today, flagged by lint rules whose fixes require understanding a real React concept first, not just editing until the linter goes quiet. Splitting this into its own epic on purpose, so it gets a real look rather than a rushed pass.

## Background — read this before touching the tasks below

### Issue A: `DiagramContext.tsx` — the "Fast Refresh" export rule

**The error**: `react-refresh/only-export-components` on the file's `useDiagramContext` export.

**What Fast Refresh actually is**: when you edit a React component's code and save, Vite's dev server ("Fast Refresh") tries to swap the new component code into the *already-running* app in your browser, preserving its current state (e.g. which node is selected, what's typed into a text field) — instead of doing a full page reload. This only works reliably if the dev server can cleanly tell "this export is a component" apart from "this export is something else" (a plain function, a constant, a React Context object). A file mixing both kinds of exports breaks that guarantee — editing it might force a full reload instead of a clean hot-swap, or in rarer cases leave the page in a stale, half-updated state until you manually refresh.

**Why it's flagged here specifically**: [`DiagramContext.tsx`](../../../src/renderer/src/DiagramContext.tsx) exports two things: `DiagramContext` itself (the result of React's `createContext()` — this is *not* a component, it's a plain object that a `<DiagramContext.Provider>` wraps around your component tree so any component inside can read from it) and `useDiagramContext` (a "custom hook" — a plain function, by convention prefixed `use`, that other components call to read from that context without having to know the low-level `useContext()` API). Neither export is actually a component. The lint rule's automated check still flags this pairing anyway — it's a well-known limitation of this specific rule with this specific "Context object + its own accessor hook in the same file" pattern, which is otherwise an extremely common, idiomatic way to structure a React Context (see the [official React docs' own example](https://react.dev/learn/passing-data-deeply-with-context), which does exactly this).

**Why it's not urgent**: this only affects the *dev-server hot-reload experience* — it has zero effect on the built, packaged app a user actually runs. Worst case today: editing `DiagramContext.tsx` during development might trigger a full page reload (losing in-progress canvas state) instead of a instant hot-swap. Mildly annoying to whoever's coding, invisible to the shipped product.

**The real fix, if we do it**: move `useDiagramContext` out into its own file (e.g. `useDiagramContext.ts`), leaving `DiagramContext.tsx` exporting only the `Context` object and its `DiagramContextValue` type. This is exactly the same move already made this session for `connectionPoints.ts`/`ConnectionHandles.tsx` (see epic 0004). The catch: `useDiagramContext` is imported from `'../DiagramContext'` in every node component (`ShapeNode`, `ContainerNode`, `TextNode`, and likely others) — the fix itself is small, but the import-path update touches every one of those call sites, which is why it wasn't done as a drive-by this session.

### Issue B: the "reset before an async fetch" pattern (3 instances)

**The error**: `react-hooks/set-state-in-effect`, in [`IconSlotView.tsx:24`](../../../src/renderer/src/components/IconSlotView.tsx), [`useDetailsTooltip.ts:14`](../../../src/renderer/src/hooks/useDetailsTooltip.ts), and [`Canvas.tsx`](../../../src/renderer/src/Canvas.tsx) (the effect that seeds a node's details-panel draft).

**The shape of the pattern, using `IconSlotView.tsx` as the concrete example**:
```tsx
const [svg, setSvg] = useState<string | null>(null)

useEffect(() => {
  setSvg(null)              // <- flagged: "calling setState synchronously in an effect"
  if (!icon) return undefined

  let cancelled = false
  loadBuiltinIconSvg(icon.id)?.then((s) => {
    if (!cancelled) setSvg(s)
  })
  return () => { cancelled = true }
}, [icon, diagramPath])
```
This effect runs whenever `icon` changes (a node's icon slot gets a different icon assigned). It (1) immediately clears the currently-displayed SVG, then (2) kicks off fetching the *new* icon's SVG asynchronously, and only updates `svg` again once that fetch resolves.

**Why the linter flags it**: the general shape "call `setState` synchronously as the very first thing inside an effect" is *usually* a sign you don't need an effect at all — the classic case is state that's 100% derivable from props/other state (exactly what `IconPicker.tsx`'s `results` was, fixed alongside this epic). The linter can't tell that apart from what's actually happening here.

**Why this case is different — and *why removing that line would introduce a real bug***: without `setSvg(null)`, when you switch a node's icon from icon A to icon B, the component keeps showing icon A's SVG on screen for however long icon B's fetch takes (even if just one animation frame) — a visible flash of the *wrong* icon, not just a brief blank state. The reset isn't incidental cleanup, it's the only thing preventing stale content from being shown as if it were current. Same underlying reason in the other two spots: `useDetailsTooltip` resets the tooltip text before fetching the new node's details file, and `Canvas.tsx`'s effect seeds an empty draft before the async read of an existing details file resolves.

**The real fix, if we do it — a `key`-driven remount instead of a manual reset**: React has a built-in mechanism for exactly this: giving a component a `key` prop that changes when its underlying "identity" changes causes React to throw away the *entire* old component instance (state included) and mount a fresh one, rather than keeping the old instance around and asking it to update its own state manually. Concretely, at `IconSlotView`'s call site (inside `ShapeNode`/`ContainerNode`), passing `key={icon ? `${icon.source}:${icon.source === 'builtin' ? icon.id : icon.path}` : 'none'}` would mean: whenever the icon reference actually changes to a *different* icon, React mounts a brand-new `IconSlotView` with `svg` starting fresh at `null` — no manual `setSvg(null)` needed, because there's no old state left to clear. This is the idiomatic React answer to "I want to reset state when this identity changes," and it satisfies the linter as a side effect of being structurally the right tool, not because we made the linter happy.

**Why this one needs care, not a quick pass**: the `key` value has to uniquely and correctly identify "this is a genuinely different icon/tooltip-target/details-target," matching exactly what the current effect's dependency array (`[icon, diagramPath]`, `[diagramPath, detailsPath]`, etc.) already expresses — getting that equivalence subtly wrong would be a real regression (state not resetting when it should, or resetting too often and causing extra flicker/refetching), which is exactly why this got its own epic instead of being folded into epic 0004's other fixes.

## Tasks
- [ ] Split `useDiagramContext` out of `DiagramContext.tsx` into its own file; update every import site (`ShapeNode.tsx`, `ContainerNode.tsx`, `TextNode.tsx`, `connectionPoints.ts`, any others — grep for `from '../DiagramContext'` / `from './DiagramContext'` to find them all)
- [ ] `IconSlotView.tsx`: replace the `setSvg(null)`/`setDataUrl(null)` reset with a `key`-driven remount at its call site(s) inside `ShapeNode`/`ContainerNode`
- [ ] `useDetailsTooltip.ts`: same pattern — likely needs the *consuming* component (wherever `useDetailsTooltip` is called) to remount on node-id change, or a different structural fix if a hook-level `key` equivalent doesn't cleanly apply (hooks don't take a `key` themselves — this may need the hook's caller to be restructured, worth scoping properly rather than assuming the `IconSlotView` fix transfers directly)
- [ ] `Canvas.tsx`'s details-draft-seeding effect: same category, but this one seeds a *dictionary* keyed by node id (`detailsDrafts`), not a single piece of display state — the `key`-remount trick doesn't obviously map onto "seed one entry in a larger object," so this one may need its own approach, not a copy of the `IconSlotView` fix
- [ ] Re-run `npm run lint` and confirm all 4 are gone with no new errors introduced
- [ ] Manually verify (or ask for manual verification) that icon-switching, tooltip-switching, and details-panel-opening still show correct content with no stale-content flash after the fix — these are exactly the failure modes that would silently regress if the `key` equivalence is wrong

## Notes
Split out from epic 0004 (containers) on 2026-08-19, at the user's request, after asking about pre-existing lint errors uncovered while working on that epic. Two of six original errors (an unescaped apostrophe, and `IconPicker.tsx`'s derived-state effect) were fixed immediately as part of epic 0004's branch since they were unambiguous, zero-risk fixes; these remaining 4 needed more explanation and more careful handling, hence their own epic rather than a rushed fix.
