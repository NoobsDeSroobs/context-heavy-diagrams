# 0122: The app icon is generated from one SVG master

## Status
Accepted

## Context
The artist delivered the app icon as an SVG on an A4 landscape artboard: a rounded tile with two ravens, where the lower raven runs past the bottom of the tile and a white bar hides the overflow. That works on a white page but would show as a white strip on a transparent icon. The build needs the icon in four forms: `build/icon.png` (Linux and the source image), `build/icon.ico` (Windows exe, installer and taskbar), `build/icon.icns` (macOS) and `resources/icon.png` (the runtime window icon). Converting by hand each time the artist sends a revision would be error-prone, and no image tool was installed.

## Decision
- **`build/icon.svg` is the master.** It is the artist's drawing cropped to the tile. The first delivery needed its white bar replaced by a clip path and its stray title removed; the current one is pure vector with no overflow, and only the border stroke gets a round join, because the closing join of that closed stroke drew a small step in Chromium. The artist's original is kept untouched as `build/icon-artist-original.svg`.
- **The four files are generated, not edited:** `npm run icons` (`scripts/make-icons.mjs`) renders the SVG with Electron's own Chromium, so it needs no extra dependency, and writes all four. The output is deterministic, so a re-run on an unchanged SVG changes nothing.
- **Windows:** the `.ico` holds 16 to 128 px as 32-bit BMP entries and 256 px as PNG, the layout the NSIS installer tooling expects, rather than PNG for every size.
- **macOS:** the `.icns` scales the artwork to 824 of 1024 px, the grid macOS icons sit on, so the icon does not look oversized in the Dock. Windows and Linux use the full-bleed tile.
- **The document icon for `.chd` files is unchanged:** it still reuses the app icon.

## Alternatives considered
- **Convert by hand or with an online tool each time.** Works once, but is not repeatable and gives no check that the files are consistent.
- **Add an image library (sharp, png-to-ico, icon-gen) as a dev dependency.** More code to trust and keep in the notices and audit for a task done a few times in a project's life.
- **Let electron-builder convert a single PNG.** It does that when the `.ico` and `.icns` are missing, but the result is not under our control and cannot be reviewed as files in the repo.

## Consequences
- A revised icon is a new `build/icon.svg` plus `npm run icons`; nothing else changes.
- The macOS output is unverified: there is no Mac to check the grid and sizes on.
- The ownership and licence of the artwork are recorded separately in [docs/licensing.md](../licensing.md).
