# Landscape

The base system-landscape diagram for the Meridian Rail scenario (see [epic 0022](../../../docs/planning/epics/0022-example-diagram-gallery.md#candidate-diagram-list-meridian-rail-scenario--under-review)), plus the compliance highlight overlays layered on top of it — the one place in the gallery where a single base diagram is deliberately reused rather than redrawn, because a highlight overlay only means something toggled over the *same* underlying diagram. See [ADR 0028](../../../docs/decisions/0028-example-gallery-shared-landscape-and-domain-folders.md) for the full reasoning, including its amendments.

Security/compliance content lives here as overlays rather than as its own domain folder — there's currently no standalone security diagram planned beyond these two.

## Candidate entries (not yet built, not yet approved)

- **#1 — IT landscape (as-is)**: Meridian Rail's applications, integrations, and data stores as a single diagram, from an enterprise architect's as-is survey. Tagged (environment, data classification, owning team, regulatory scope, criticality tier, ...) so the overlays below have something to match against. Also the root that [`technical/`](../technical/README.md)'s C4 context diagram links from.
- **#2 — GDPR passenger-data flow overlay**: a highlight set matching personal-data-carrying elements, toggled over #1.
- **#3 — NIS2 essential-service scope overlay**: a grouped highlight set (NIS2 scope × criticality tier) toggled over #1.

## Status

Nothing built yet. Candidate list under review in epic 0022 — see there for current numbering and status.
