# Technical

Solution/technical architecture content — merges what were previously separate "solution/technical," "integration," and "infrastructure/cloud" folders. Per the 2026-08-20 scope trim (see [epic 0022](../../../docs/planning/epics/0022-example-diagram-gallery.md#candidate-diagram-list-meridian-rail-scenario--under-review) Notes and [ADR 0028](../../../docs/decisions/0028-example-gallery-shared-landscape-and-domain-folders.md)'s amendments): a single well-built C4 diagram set already demonstrates most of what a separate integration-topology or cloud-architecture diagram would — containers, deployment shape, how systems connect — so those stay as backlog ideas rather than separate candidate entries for now.

## Candidate entries

- **#4 — Ticketing & Booking platform, C4 context**: `c4-context.chd`, **confirmed working** — opened and edited in the real app by the user (edge label color fix, custom connection points added). Links down to #5.
- **#5 — Ticketing & Booking platform, C4 container**: `c4-context/c4-container.chd` — note the path: it lives *inside* `c4-context/`, the Context diagram's own colocation folder, alongside `c4-context/details/`, per `docs/file-format.md`'s stated default ("`my-diagram/Database.chd` for a newly-created link"). Originally built as a flat sibling of `c4-context.chd` instead, which was wrong — fixed 2026-08-20. The system boundary is an actual `container`-type node (epic 0004) holding 8 internal shapes (two frontends, four backend services, one data store), plus the 4 external systems and 2 actors reused from #4 (their `details` paths point back at #4's own detail files rather than duplicating content). All 12 nodes have details, at `c4-context/c4-container/details/` (its own colocation folder, nested inside its parent's). **Awaiting the user opening it in the app.**
- **#6 — C4 component**: **7 sub-diagrams**, one per container from #5 with real internal structure — everything except Platform Database, which C4 doesn't decompose into components. All live inside `c4-context/c4-container/`, that diagram's own colocation folder, each with its own `details/` subfolder:
  - `booking-web-app-component.chd` — UI Layer, Local State Store, Booking Client
  - `staff-portal-component.chd` — Counter UI, Session/Auth, Booking Client
  - `notification-service-component.chd` — Trigger Listener, Template Renderer, Delivery Dispatcher
  - `booking-api-component.chd` — the hub, 4 components: Booking Controller, Search & Reservation Service, Orchestration Service, Profile Sync Service
  - `payment-orchestration-component.chd` — Charge Controller, Retry & Reconciliation Engine, Gateway Client
  - `interop-gateway-component.chd` — Validation Controller, Format Translator, Network Client
  - `legacy-sync-component.chd` — deliberately the thinnest, 2 components: Inventory Request Handler, Legacy Protocol Adapter — reinforcing its "being retired, not built to last" status

  Each is linked from its container node in `c4-container.chd`. External siblings (other containers, external systems, actors) reuse #4's/#5's detail files by relative path rather than duplicating content. All `linkedDiagram`/`details` paths across the full 9-file chain were swept and confirmed to resolve. **None of the 7 has been opened in the app yet.**

Together this is the gallery's main showcase of linked-diagram navigation (epic 0009) outside `self-documentation/` — the C4 chain is now content-complete top to bottom.

- **Security Matrix rollup demo**: `security-rollup.chd` + [`security-rollup/`](security-rollup/README.md) — a 7-file, three-layer tree (Business domain → Services → Technical components) showcasing the recursive Security Matrix rollup ([ADR 0088](../../../docs/decisions/0088-recursive-security-matrix-rollup.md) / [epic 0081](../../../docs/planning/completed-epics.md#0081-recursive-matrix-population-and-automation)): derived columns, a deliberately broken sub-diagram link, a directly-assessed non-linked shape, a downstream-only threat, and calculation modes that flow down the whole tree. Built 2026-09-09 alongside epic 0081 item 5; **not yet opened in the app.**

## Deferred (not dropped, just not in this round)

- Deployment diagram, integration/event topology, cloud/DR/multi-region variants, technology reference model / standards catalog, sequence diagram, class/object diagram, state machine, CI/CD pipeline, ER diagram — see epic 0022's original discipline checklist for the full list. Revisit once the C4 chain above is built and it's clearer what it does and doesn't already cover.

## Status

The full C4 chain (#4-#6, 9 files) is content-complete but not yet opened/reviewed in the app. Candidate list still under review in epic 0022 for the remaining entries.
