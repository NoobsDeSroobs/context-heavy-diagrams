# 0111: User-registered favorite folders for quick navigation

## Status

Not Started — parked. Logged 2026-09-05 from a user aside: "maybe we could
add a custom folder path list that lets the user register paths to most
commonly used folders? For easy navigation."

## Goal

Let a user pin/register a handful of folder paths (e.g. where their
diagram projects live, a shared drive, an icon-pack folder) and jump to one
directly from the Open/Save dialogs or wherever folder navigation happens
in the app, instead of re-navigating the OS file-picker's default location
every time.

## Possible directions (not chosen)

- **Native OS file-dialog "quick access" is mostly out of Claude's/this
  app's control** — Electron's `dialog.showOpenDialog` delegates to the
  OS-native picker, which already has its own sidebar (Windows "Quick
  access", macOS Finder sidebar). Worth checking how much of this ask is
  already solved by pinning folders at the OS level before building
  anything app-specific.
- **App-level favorites list** (a `AppPreferences.favoriteFolders?: string[]`
  entry, edited from Preferences, surfaced as a dropdown/menu near
  File → Open) — meaningful if the app ever grows its own in-app file
  browser (e.g. for the example gallery, or a "recent projects" tree)
  rather than only ever shelling out to the native dialog.
- Cross-reference: `AppPreferences.recentDiagrams` already exists (recency,
  not user-curated pins) — this would be a second, deliberately-curated
  list alongside it, not a replacement.

## Notes

Purely a convenience idea, not scoped or designed. No immediate driver;
revisit if folder navigation friction comes up again in practice.
