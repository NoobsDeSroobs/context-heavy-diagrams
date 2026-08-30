# 0104: Central custom-icon library (de-duplicate custom icons across diagrams)

## Status
Not Started — raised 2026-08-30 from live use. **Needs a design pass + ADR
before any implementation.**

## Problem
Every diagram is the independent root of its own sibling-folder tree
([ADR 0005](../../decisions/0005-diagram-identity-and-linking.md) / [ADR 0006](../../decisions/0006-icon-storage-model.md)):
a custom icon is copied into *that diagram's* `<base>/assets/` and referenced by
a relative path. So the same company logo used in twelve diagrams is stored
twelve times, once per diagram folder. Built-in (Tabler) icons don't have this
problem — they're centrally bundled and referenced by id — only `source: 'custom'`
icons do.

This is the deliberate trade-off ADR 0006 made (portability + "a diagram is a
self-contained file with a sibling folder"), now biting at scale.

## Direction the user proposed (to be pressure-tested in the design pass)
1. **A central location for custom icons** — one shared icon library on the
   machine, not per-diagram. A custom `IconRef` points into it (by id/hash, the
   way built-ins point by id) instead of a per-diagram relative path.
2. **Portability fallback** — the library won't exist on the next person's
   machine. On opening a diagram that references custom icons the app can't
   resolve, let them **point at an icon folder** (theirs, or one shared
   alongside the diagram) to satisfy the references.
3. **A diagram-level flag / manifest** — the `.chd` records that it depends on
   custom icons (and which ones — id + original filename + maybe a hash), so an
   opener knows to prompt, and a missing icon degrades gracefully with a name to
   look for rather than a silent blank slot.
4. **Zip export option** — when [epic 0016](0016-zip-export-for-sharing.md)
   builds the shareable bundle, an option to **fold every referenced custom icon
   into the zip** (in a conventional subfolder), so the recipient gets a
   self-contained artifact and the "point at a folder" step resolves
   automatically.

## Open questions / tensions (sparring notes)
- **Where is "central"?** A fixed per-OS app-data dir (like the settings file,
  [ADR 0053](../../decisions/0053-os-conventional-settings-storage.md))? A
  user-chosen folder (so it can live in Dropbox/OneDrive/a synced drive and be
  shared by construction)? Both, with a default + override?
- **Reference by what?** Content hash (dedupes identical icons uploaded twice,
  survives rename, but opaque) vs. a stable id + keep the original filename as a
  label. Probably hash for identity + filename for humans.
- **Does this break ADR 0006's "portable by construction" property for the
  common case?** A diagram that today is fully self-contained (its `assets/`
  folder travels with it) would now depend on external library state. The
  manifest + zip option are the mitigations, but the design must not make the
  simple "email someone a .chd + its folder" case *worse*.
- **Migration.** Every existing diagram has real files in its own `assets/`.
  Moving to a central library means either (a) a one-time "import my existing
  custom icons into the library" pass, (b) leave old per-diagram icons working
  via the existing relative-path code path and only new uploads go central
  (two code paths forever), or (c) migrate on open.
  [ADR 0029](../../decisions/0029-backward-compatible-loading-is-a-standing-rule.md)'s
  backward-compatible-loading rule applies.
- **Relationship to [ADR 0006](../../decisions/0006-icon-storage-model.md)'s
  anticipated `source: 'installed'`** — a downloaded vendor icon pack is already
  a planned *third* `IconRef` kind that's centrally stored. Is "central custom
  library" just `source: 'installed'` with a user-populated pack, or a distinct
  fourth kind? Unifying them would be cleaner.
- **Relationship to [epic 0098](0098-configurable-asset-subfolder-paths.md)** —
  that epic makes the *per-diagram* asset subfolder configurable. If custom
  icons move central, 0098's scope shrinks to reference images + details. Decide
  the order.
- **Relationship to [epic 0019](0019-installable-icon-packs.md)** (installable
  icon packs, blocked on vendor licensing) — same "central, non-per-diagram,
  id-referenced icons" machinery. Build the shared substrate once.
- **Concurrency / staleness** — if the central library is a synced folder, two
  machines can add different icons with the same hash-collision-free id; fine.
  But deleting an icon from the library orphans every diagram using it — needs
  the same graceful-missing handling as (2), plus maybe a "used by N diagrams"
  guard.

## Not doing yet
Nothing — this is a note. No branch, no code. Revisit when the icon/asset area
is next in focus (naturally pairs with epics 0016, 0019, 0098).
