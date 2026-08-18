# Licensing notes

Things that need the user's own business/legal judgment, not an engineering decision — tracked here rather than as an epic, since there's no code task to check off, just a call to make later.

## Vendor icon packs (AWS, Azure, GCP, etc.)

The obviously most useful built-in icons for IT architecture diagrams would be the official vendor packs — but bundling/redistributing them inside this tool's own (eventually open-source) binary is a different thing than one person using them in their own diagram, and needs each vendor's actual licensing/usage terms reviewed before shipping.

**Current stance**: not bundled, not built. [ADR 0006](decisions/0006-icon-storage-model.md) uses a permissively-licensed generic set (Tabler Icons, MIT) as the only built-in icon source for now. Vendor icons remain fully usable via the custom-upload path — the user supplies their own downloaded copy, we don't redistribute anything.

**Blocked on**: the user contacting AWS/Azure/GCP (and whichever others become relevant) directly about redistribution terms. Revisit epic [0019](planning/epics/0019-installable-icon-packs.md) once that's resolved.
