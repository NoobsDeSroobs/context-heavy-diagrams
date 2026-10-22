# 0127: Vitest for the renderer's tests

## Status
Accepted.

## Context
The tests run on Node's built-in runner (`node --test`) with type stripping. That can load pure `.ts` modules, but not `.tsx` (JSX), the `@shared` / `@renderer` import aliases, or extensionless relative imports, which most renderer code uses. So almost none of the renderer is tested, including the `toDiagramFile` / `fromDiagramFile` round trip and the behaviour of `Canvas.tsx`, which is about to be split into hooks.

## Decision
- **Add Vitest, jsdom and Testing Library** (`@testing-library/react`, `@testing-library/dom`) as dev dependencies. Vitest is built on Vite, so it reads the same aliases and the React plugin.
- **Renderer tests are `*.test.ts` / `*.test.tsx` files beside the code**, run by `vitest run` with explicit imports (no globals). The existing `*.test.mjs` suite stays on `node --test` for pure, Electron-free code (shared, main, CLI, extension).
- **`npm test` runs both**, as does CI on Linux and Windows.
- Tests that need a real browser (layout, CSS, the packaged app) are out of scope here; jsdom has no layout engine.

## Alternatives considered
- **A custom Node module loader for the aliases.** Would fix aliases and extensionless imports, but not JSX, and would be a second resolver to keep in step with Vite's.
- **Jest.** Works, but needs its own transform and module-mapping setup next to the Vite one.
- **Browser-based component tests (Playwright).** Real layout, but heavy, and an end-to-end smoke test of the built app covers most of that need.
- **Manual testing only.** What the project had; it does not scale to splitting a 6,000-line component.

## Consequences
- Four dev dependencies and their transitive packages (listed in `THIRD-PARTY-NOTICES.md` after `npm run notices`). Nothing ships in the app.
- jsdom does not lay anything out, so a CSS-dependent behaviour such as text alignment cannot be asserted with it.
