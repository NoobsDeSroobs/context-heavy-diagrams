# 0005: Dark / light mode

## Status
Done, merged to `master` (#22). User confirmed after testing: "everything seems to be working." With this, every core requirement from [docs/project-brief.md](../../../project-brief.md) is implemented — see [PROGRESS.md](../../../../PROGRESS.md).

## Goal
App-wide dark and light themes. Raised specifically because the app had only ever *looked* deliberately dark — actually just the electron-vite scaffold template's default, hardcoded, never a real choice — and the user was concerned that building the real thing might end up reinforcing dark as a hardcoded default rather than fixing it. See [ADR 0027](../../../decisions/0027-theme-default-follows-system.md) for the full resolution: the default is never hardcoded in either direction, it's whatever the OS already prefers, resolved entirely in CSS before any JavaScript runs.

## Tasks
- [x] App-wide CSS variables for themeable colours — `base.css` restructured into raw palette tokens (theme-invariant) and semantic tokens (defined once per theme: dark as the fallback, light via `@media (prefers-color-scheme: light)`, an explicit choice via `[data-theme]` outranking both). `main.css` needed no changes — it already only ever reached for the semantic tokens.
- [x] React Flow `colorMode` wired to the same theme state — `<ReactFlow colorMode={theme}>` now takes the same resolved value (`'light' | 'dark'`, never `"system"`) that drives the CSS variables, via `useTheme()`.
- [x] Theme toggle + persisted preference — `theme.ts`'s `useTheme()` hook, a toolbar button (☀️/🌙) that sets an explicit choice, persisted to `localStorage`. Cross-window sync via a `storage` event listener, so changing the theme in one open window updates every other one live rather than leaving them inconsistent until reopened.
- [x] **Your manual click-through pass** — done, confirmed working. `npm run typecheck`/`lint` both clean (lint's 4 remaining errors are the pre-existing epic 0028 baseline, confirmed by file/line match).

## Notes
A handful of hardcoded (non-variable) colors were deliberately left alone rather than made theme-aware — the alignment-guide pink, the "Saved" flash green, a few black box-shadows for popup/panel depth. All should read acceptably on both themes; see [ADR 0027](../../../decisions/0027-theme-default-follows-system.md)'s Consequences. Flag it if any of these look wrong in light mode during your pass — cheap to fix individually, just not proactively touched since none were an obvious problem on paper.

No three-state light/dark/system picker — a plain two-way toggle, since the system-following behavior is already the correct default *before* any explicit choice; there's no UI path back to "follow system" after toggling once, matching the epic's own original "theme toggle" framing rather than something more elaborate nobody asked for.
