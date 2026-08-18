# 0006: Icon storage model — central built-in library vs. per-diagram custom uploads

## Status
Accepted

## Context
Epic [0007](../planning/epics/0007-icon-slots.md) needs per-shape corner icon slots, supporting both a built-in icon set and user-uploaded custom icons (brief requirement #3). The brief's draft schema showed icon references as plain relative paths (`"icons": { "topRight": "assets/aws-icon.svg" }`), implicitly assuming every icon is a per-diagram file. That assumption doesn't hold once built-in icons live centrally rather than per-diagram.

## Decision
Two icon sources, both represented explicitly (not inferred):
- **Built-in**: bundled with the app itself, referenced by a stable id (e.g. `"tabler:server"`). Centrally stored — not copied per-diagram, not something the app writes anywhere.
- **Custom**: uploaded by the user for a specific diagram, copied into that diagram's sibling `assets/` folder (per ADR 0005's convention) and referenced by a relative path, same as any other asset reference. Requires the diagram to already be saved (there's no sibling-folder location to copy into otherwise).

Schema (additive to `DiagramNode.data`, per ADR 0003):
```ts
type IconRef =
  | { source: 'builtin'; id: string }
  | { source: 'custom'; path: string }

data: {
  label: string
  icons?: {
    topLeft?: IconRef
    topRight?: IconRef
    bottomLeft?: IconRef
    bottomRight?: IconRef
  }
}
```
The `source` discriminator is what makes this extensible — a third kind (`source: 'installed'`, for a downloaded vendor icon pack) can be added later without another schema rewrite. See epic 0019 for why that's not built now.

Built-in icon set: [Tabler Icons](https://tabler.io/icons) (MIT-licensed, ~5,800 icons), chosen for permissive licensing and solid generic tech/IT coverage (server, database, cloud, network, router). Not vendor-specific (AWS/Azure/GCP) — see [docs/licensing.md](../licensing.md) for why.

## Alternatives considered
- **Bundle official vendor icon packs (AWS/Azure/GCP) as built-in**: the most immediately useful choice for actual IT architecture diagrams, but redistributing vendor-owned icon assets inside our own (eventually open-source) binary needs their licensing terms reviewed first — a business/legal question, not an engineering one. Deferred; tracked in `docs/licensing.md`, not an epic.
- **Keep icon references as plain relative paths for everything** (the brief's original draft): simpler schema, but doesn't work once built-in icons stop being per-diagram files — there'd be nothing to form a relative path *from* for a centrally-stored icon.

## Consequences
- Built-in icon references are portable across diagrams and machines by construction (same app version, same bundled icons) — no missing-file risk the way a custom asset path has.
- Custom icon references can go stale exactly like any other asset/detail reference (renamed sibling folder, moved file) — same graceful "not found" handling as everywhere else, not a new risk category.
- A brand-new, unsaved diagram can use built-in icons immediately but not custom ones.
