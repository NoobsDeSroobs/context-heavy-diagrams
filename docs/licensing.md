# Licensing notes

Things that need the user's own business/legal judgment, not an engineering decision — tracked here rather than as an epic, since there's no code task to check off, just a call to make later.

## Vendor icon packs (AWS, Azure, GCP, etc.)

The obviously most useful built-in icons for IT architecture diagrams would be the official vendor packs — but bundling/redistributing them inside this tool's own (eventually open-source) binary is a different thing than one person using them in their own diagram, and needs each vendor's actual licensing/usage terms reviewed before shipping.

**Current stance**: not bundled, not built. [ADR 0006](decisions/0006-icon-storage-model.md) uses a permissively-licensed generic set (Tabler Icons, MIT) as the only built-in icon source for now. Vendor icons remain fully usable via the custom-upload path — the user supplies their own downloaded copy, we don't redistribute anything.

**Blocked on**: the user contacting AWS/Azure/GCP (and whichever others become relevant) directly about redistribution terms. Revisit epic [0019](planning/epics/0019-installable-icon-packs.md) once that's resolved.

## AI-written code and copyright

Not legal advice; a note for a lawyer pass, should one ever be wanted (see [ADR 0011](decisions/0011-software-license-choice.md)).

A large share of the code was written by an AI assistant under the author's direction (disclosed in the README). In some jurisdictions copyright needs human authorship, and the US Copyright Office's position is that purely AI-generated output is not protected. Where that applies, a licence has nothing to attach to for those parts: the GPL, the contribution terms in [CONTRIBUTING.md](../CONTRIBUTING.md) and any later relicensing would protect them less, or not at all.

On firmer ground are the parts a human authored or shaped: the design and direction, the selection and arrangement of what goes in, hand edits, review, and the written material (decision records, docs, planning). The line between "AI-generated" and "AI-assisted" is not settled either, so no one can say today exactly how much of the code is covered.

This is not a blocker for the release and changes nothing about how the project is used or licensed today. It matters mostly if the author later wants to enforce the licence against a copier, sell, dual-licence or relicense.

## The app icon

The raven icon (`build/icon.svg`, original in `build/icon-artist-original.svg`) was drawn by an artist commissioned by the author. **Decided 2026-10-19:** the author owns all rights to it; the artist keeps the right to show it in their portfolio and marketing. **Open:** whether the icon is covered by the GPL-3.0-or-later like the rest of the repository (so forks may reuse it), or is reserved so that forks should replace it. The author, as the owner, can decide either way.
