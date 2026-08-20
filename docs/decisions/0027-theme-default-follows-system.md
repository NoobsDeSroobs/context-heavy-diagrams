# 0027: Theme defaults to OS preference, never a hardcoded color

## Status
Accepted

## Context
Epic 0005 (dark/light mode) was one of the original brief's core requirements (item 7) and had never been implemented — the app had only ever rendered in what *looked* like a deliberately-chosen dark theme, but wasn't: the electron-vite scaffold's `base.css` template ships both light (`--ev-c-white*`) and dark (`--ev-c-black*`) raw palette tokens, but the semantic tokens actually used everywhere (`--color-background`, `--color-text`, etc.) were hardcoded straight to the dark ones with no `prefers-color-scheme` handling at all. The user's own words when greenlighting this epic: they hadn't minded the accidentally-dark look, but were specifically worried that *building the real thing* would end up reinforcing dark as a deliberate hardcoded default rather than fixing it.

## Decision
The resolved theme is never hardcoded in either direction. Three layers, each only active when the one above it doesn't apply:
1. **No explicit choice, OS prefers dark** (or the browser/OS doesn't support `prefers-color-scheme` at all) → dark. This is the fallback, not a default preference for dark specifically — it's just what's left once the more specific cases below don't apply.
2. **No explicit choice, OS prefers light** → light, via a `@media (prefers-color-scheme: light)` rule in `base.css` at equal CSS specificity to the dark fallback, winning by appearing later in the file. This layer requires zero JavaScript — it's correct on the very first paint, before React even mounts, so there's no flash-of-wrong-theme for the common "just respect my OS setting" case.
3. **Explicit choice** (the toolbar toggle, `theme.ts`'s `setTheme`) → whatever the user picked, persisted to `localStorage`, applied via a `data-theme` attribute on `<html>` that outranks both of the above regardless of OS setting.

Layers 1–2 are pure CSS (`:root:not([data-theme='light'])` for dark, `@media (prefers-color-scheme: light) { :root:not([data-theme='dark']) {...} }` for light) — `theme.ts`'s `useTheme()` hook only ever needs to run to apply an *explicit* choice; the no-choice-yet default is entirely CSS's own responsibility, which is what makes it robust rather than a "JS sets a sensible default on mount" pattern that would still flash the wrong theme for one frame.

An explicit choice, once made, is a real toggle (light ↔ dark), not a three-state light/dark/system picker — there's no UI path back to "follow system" after picking one. `enabledHighlightIds`-style ephemeral-vs-persisted split doesn't apply here; a theme choice is a genuine standing app preference, so it's a plain `localStorage` write, not session-only state.

**Cross-window sync**: since all of an app's windows share the same `localStorage` (same origin, same Electron session), changing the theme in one window is picked up live by every other open window via a `storage` event listener in `useTheme` — cheap to add, avoids the visibly-inconsistent "one window went dark, the other didn't" state that would otherwise persist until each window was reopened.

## Alternatives considered
- **Default to light unconditionally.** Rejected — the user's stated fear was specifically about an unconditional *dark* default; unconditionally defaulting to light instead would just be the same mistake in the other direction, ignoring whatever the user's actual OS-level preference already is.
- **JS computes and applies a default theme on mount** (`useEffect(() => applyTheme(matchMedia(...).matches ? 'dark' : 'light'))`), rather than a pure-CSS media query. Rejected — this reintroduces exactly the flash-of-wrong-theme problem the pure-CSS fallback avoids: the very first paint would use whatever `data-theme` was absent-default before the effect runs, then jump once JS catches up.
- **Three-state light/dark/system toggle UI.** More capable (lets a user return to "follow system" after overriding once) but more UI than the epic's own "theme toggle" framing called for, and not something the user asked for. A straightforward two-state toggle plus a correct no-JS-needed system-following default before any explicit choice covers the actual concern raised.

## Consequences
- `base.css` restructured around explicit "raw palette" vs. "semantic token" layers, with semantic tokens defined exactly twice (once per theme) rather than scattered — see the file's own header comment. Every other stylesheet (`main.css`) continues to reach only for semantic tokens (`--color-background`, `--ev-c-gray-1`, etc.), never the raw ones, so nothing outside `base.css` needed to change to become theme-aware.
- React Flow's own `colorMode` prop is passed the *resolved* concrete theme (`'light' | 'dark'`) from the same `useTheme()` hook driving the CSS variables, never `"system"` — keeping React Flow's own dark-mode styling (Background/Controls/MiniMap) in lockstep with the rest of the app rather than letting it resolve OS preference independently and potentially disagree.
- A handful of hardcoded, non-variable colors elsewhere in `main.css` (the alignment-guide pink, the "Saved" flash green, a few `rgba(0,0,0,0.4)` box-shadows) were deliberately left as-is — all read acceptably on both a light and a dark background, and treating drop-shadow depth as theme-invariant is a common, low-cost simplification even in more polished theming systems. Worth revisiting only if manual testing on light mode actually shows a problem.
