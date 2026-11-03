# Technical

Solution and technical architecture content: a C4 chain and a security matrix rollup.

## C4: Ticketing & Booking platform

Nine linked diagrams, one level each, opened by Ctrl/Cmd-clicking an element that links down.

- **`c4-context.chd`**: level 1, the platform, the people who use it and the systems it depends on. Links down to the container diagram.
- **`c4-context/c4-container.chd`**: level 2. It lives inside `c4-context/`, the context diagram's own folder, which is where the app puts a newly created link ([file format](../../../docs/file-format.md)). The system boundary is a container element holding eight internal elements (two frontends, five backend services and one data store), next to the four external systems and two people from the context diagram. Every element has a note, in `c4-context/c4-container/notes/`.
- **Level 3, seven component diagrams** in `c4-context/c4-container/`, one per container with an internal structure of its own (everything except the Platform Database), each linked from its container in `c4-container.chd` and each with its own `notes/` folder:
  - `booking-web-app-component.chd`: UI Layer, Local State Store, Booking Client
  - `staff-portal-component.chd`: Counter UI, Session/Auth, Booking Client
  - `notification-service-component.chd`: Trigger Listener, Template Renderer, Delivery Dispatcher
  - `booking-api-component.chd`: the hub, with Booking Controller, Search & Reservation Service, Orchestration Service and Profile Sync Service
  - `payment-orchestration-component.chd`: Charge Controller, Retry & Reconciliation Engine, Gateway Client
  - `interop-gateway-component.chd`: Validation Controller, Format Translator, Network Client
  - `legacy-sync-component.chd`: deliberately the thinnest, with Inventory Request Handler and Legacy Protocol Adapter, reflecting that the service is being retired and not built to last

The other containers, external systems and people shown in a component diagram reuse the container diagram's notes by relative path instead of duplicating them. Every diagram has a legend for its colours and arrows (show it from the legend panel).

## Security Matrix rollup

`security-rollup.chd` and [`security-rollup/`](security-rollup/README.md): a seven-file, three-layer tree (business domain, services, technical components) showing the recursive Security Matrix rollup ([ADR 0088](../../../docs/decisions/0088-recursive-security-matrix-rollup.md)): derived columns, a deliberately broken sub-diagram link, a directly assessed element that has no sub-diagram, a threat that only exists downstream, and calculation modes that flow down the whole tree.
