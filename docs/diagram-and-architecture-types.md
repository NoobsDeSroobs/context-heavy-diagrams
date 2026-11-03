# Diagram types and architecture types

A reference list, written to support the idea of checking a diagram against the architecture it claims to follow ([epic 0138](planning/epics/later/0138-architecture-conformance-checks.md)). Nothing here is built or decided; it is a map of what people draw and which rules each architecture implies, so a future rule format can be tested against real cases.

The tool is notation-agnostic by design ([ADR 0008](decisions/0008-tool-scope-includes-ea-adjacent-diagrams.md)): it has entities, containers, text, lines, edges, tags, notes and links, and no built-in metamodel. Both lists below are about what can be drawn with those, and what could be checked about it.

## 1. Diagram types

"Fit" says how well the tool draws the type today: **Good** (drawn naturally, an example exists or is easy), **Workable** (possible with a convention or a workaround), **Awkward** (possible but laborious), **Not supported**. The tool's shapes are rectangular, with icons and labels carrying meaning ([ADR 0080](decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md)).

### Software and system architecture

| Type | What it shows | Fit | Notes |
|---|---|---|---|
| C4 context, container, component | Systems, containers and components at three zoom levels | Good | Drill-down maps onto linked diagrams; the gallery has the full chain |
| Component or module diagram | Modules and their dependencies | Good | |
| Layered or tier diagram | Layers stacked, with what sits in each | Good | One container per layer |
| Deployment or infrastructure | Software placed on nodes, environments and zones | Good | Containers for nodes and zones |
| System landscape or integration map | Applications and the interfaces between them | Good | Gallery landscape diagrams |
| Data-flow diagram | Processes, data stores, external entities and flows | Workable | Classic notation uses circles for processes; shapes here are rectangular |
| Network topology | Devices, links, segments | Workable | Icons help; no vendor icon packs are bundled |
| Cloud architecture | Services inside accounts, regions and networks | Workable | Same icon limitation |
| ER or data model | Entities, attributes, relationships with cardinality | Good | Crow's foot markers exist |
| Data pipeline or lineage | Sources, transformations, sinks | Good | |
| State machine | States and transitions | Workable | No initial or final pseudo-state shapes |
| Event storming or event flow | Events, commands, policies, aggregates | Workable | Coloured notes with labels |
| UML class diagram | Classes with attributes and operations | Awkward | No compartments; usually better generated from code |
| Sequence diagram | Ordered messages between lifelines | Not supported | Needs lifelines and message ordering; see the comparison page |

### Enterprise architecture

| Type | What it shows | Fit | Notes |
|---|---|---|---|
| Business capability map | Capability hierarchy, often with a maturity or investment heatmap | Good | Containers and fill colour |
| Application portfolio | Applications grouped by a disposition (tolerate, invest, migrate, eliminate) | Good | Colour and tags |
| Motivation or goals view | Drivers, goals, principles and how they relate | Good | Gallery organisation example |
| Value stream map | Stages of delivering value | Workable | |
| Roadmap or transition architecture | States over time | Workable | No time axis |
| Information or data architecture | Data domains, ownership, flows | Good | |
| Organisation chart or RACI | Roles, teams, responsibilities | Workable | A RACI grid needs a table, which the tool does not have |

### Process and flow

| Type | What it shows | Fit | Notes |
|---|---|---|---|
| Flowchart | Steps and decisions | Good | No diamond shape; a decision is a labelled rectangle |
| BPMN process | Events, tasks, gateways, flows | Workable | Vocabulary only, nothing validated |
| Swimlane or cross-functional flow | Steps grouped by actor or team | Workable | Containers as lanes |
| Activity diagram with fork and join | Parallel branches that split and merge | Workable | A thin filled rectangle works as the bar |
| Customer journey | Stages, actions, touchpoints, feelings | Good | Gallery business example |
| Service blueprint | Customer actions with front-stage and back-stage processes | Workable | Containers as lanes |
| User flow | Screens and transitions | Good | |
| Decision tree | Choices and outcomes | Good | |

### Security

| Type | What it shows | Fit | Notes |
|---|---|---|---|
| Threat model with trust boundaries | Components, data flows, boundaries, threats | Good | Curved lines for boundaries, plus the security matrix view |
| Attack tree | Goals decomposed into attack steps | Workable | |
| Network segmentation or zero-trust zones | Zones and the controls between them | Good | Containers for zones |

### Not a good fit

Gantt charts (need a time axis), floor plans and other scaled drawings, and anything whose layout is computed (large call graphs, dependency graphs) are outside what a hand-drawn canvas does well.

## 2. Architecture types

An architecture style is a set of rules about what may depend on what. A diagram "follows" a style when its elements and connections obey those rules. The rules below are written so each can be expressed as one of a few shapes, using the sketch in epic 0138:

- **F** Forbidden edge: no edge from elements of role A to elements of role B.
- **R** Required edge: every element of role A has at least one edge to an element of role B.
- **C** Containment: elements of role A must (or must not) sit inside a container of kind C.
- **D** Direction or cycles: dependencies run one way only, checked over the whole graph.
- **N** Cardinality (not in the sketch): an element has at most or exactly one of something.
- **X** Crossing (not in the sketch): an edge that crosses a container boundary must go through an element of a given role ([epic 0088](planning/epics/later/0088-cross-container-edge-detection.md)).

Every style also depends on **what an edge means**. In a "depends on" diagram an arrow points from the user to the thing used; in a "flows to" diagram it follows the data or the call. A style's rules only make sense if the diagram says which it is.

### Structural styles

| Style | Core idea | Checkable rules | Needs from the diagram |
|---|---|---|---|
| Layered (n-tier) | Layers stacked; each uses only the layers below | D: dependencies point down only. F: no upward edge. Strict variant: only to the next layer. | A container or tag per layer; "depends on" edges |
| Hexagonal (ports and adapters) | A domain core, ports on its boundary, adapters outside | F: adapters do not depend on each other; the domain depends on no adapter. D: dependencies point inward. R: every port has at least one adapter. | Roles `domain`, `port`, `adapter`; driving versus driven ports; "depends on" edges |
| Onion and clean architecture | Concentric rings with the dependency rule: source dependencies point inward | D: inward only across rings (entities, use cases, interface adapters, frameworks). F: no inner element names an outer one. | A ring per container or tag; "depends on" edges |
| Modular monolith | One deployable, with modules that expose a public interface | F: no edge into a module except to its public interface element. D: no cycles between modules. | A role for public interface versus internal |
| Microkernel or plug-in | A small core and independent plug-ins | F: plug-ins do not depend on each other. D: plug-ins depend on the core, not the reverse. | Roles `core` and `plugin` |
| Client-server and three-tier | Clients, application servers, data stores | F: clients do not reach the data store directly. | Roles by tier |
| Pipes and filters | Stages connected in a line | D: acyclic, flowing one way. N: each filter has one input and one output. | "Flows to" edges |

### Distributed and integration styles

| Style | Core idea | Checkable rules | Needs from the diagram |
|---|---|---|---|
| Microservices | Small services, each owning its data | N: each data store belongs to exactly one service. F: no service reads another's store. D: no cycles between services (a warning, not always an error). | Roles `service` and `datastore`; ownership as an edge or containment |
| Event-driven | Producers and consumers communicate through a broker | F: no direct edge from a producer to a consumer. R: every consumer subscribes to a topic or queue. | Roles `producer`, `consumer`, `broker`; "flows to" edges |
| CQRS and event sourcing | Separate write and read models; the event log is the record | F: queries do not write; commands do not read the read model. R: a projection exists for every read model. | Roles for command side, query side, event store |
| Hub and spoke (ESB) | All integration passes through a central hub | X: any edge between two systems goes through the hub. | A `hub` role |
| API gateway and backend-for-frontend | Clients reach services only through a gateway | F: no direct client-to-service edge. | Roles `client`, `gateway`, `service` |
| Serverless | Functions triggered by events, using managed services | F: no function calls another function directly (a common rule). | Roles `function` and `trigger` |
| Domain-driven design context map | Bounded contexts related by named patterns (shared kernel, customer and supplier, anti-corruption layer, conformist) | F: no unnamed edge between contexts. R: a stated relationship type for each pair of related contexts. | Contexts as containers; relationship types as edge tags |

### Security and data styles

| Style | Core idea | Checkable rules | Needs from the diagram |
|---|---|---|---|
| Zones and DMZ | Network zones with controlled crossings | X: traffic crossing a zone boundary passes through a gateway or firewall. F: no direct internet-to-data-store edge. | Zones as containers; a `gateway` role |
| Zero trust | No implicit trust between zones; every hop authenticated | X: every crossing has an authentication control. | Controls as tagged edges or elements |
| Threat model completeness | Every trust-boundary crossing is considered | X: every crossing has at least one linked threat entry. | Boundaries and threats, as in the security matrix view |
| Medallion or lakehouse layers | Bronze, silver and gold data layers | D: data flows forward only, never gold back to bronze. | A layer tag; "flows to" edges |
| Lambda and kappa | Batch and speed layers (lambda), or a single stream (kappa) | R: both layers feed the serving layer (lambda). | Roles by layer |
| Data mesh | Domain-owned data products | N: each data product has one owning domain. | Ownership as containment or tag |

### Notation-level consistency

These are not architecture styles but well-formedness rules that a checker could also cover.

| Notation | Checkable rules |
|---|---|
| C4 | Every container belongs to exactly one system (N, C). Every element has a description and a technology tag where the level requires it. A linked diagram at the next level shows the same element (consistency across links). |
| BPMN-flavoured flows | Every process has a start and an end. Split and join gateways are paired. No dangling steps. |
| ArchiMate-flavoured landscapes | Only the relationships the layer pairing allows (for example, business uses application, application uses technology). |

## 3. What this suggests for the rule language

- **Four rule shapes cover the structural styles** (layered, hexagonal, onion, plug-in, three-tier), but not the distributed and security styles. Those need **cardinality (N)** ("each data store belongs to one service") and **crossing (X)** ("a boundary crossing goes through a gateway").
- **Roles are the common currency.** Almost every rule is phrased as "elements with role A and role B". A profile therefore needs a stable way to give an element a role, and a defined result for elements with none.
- **Edge meaning is the biggest risk.** A hexagonal diagram drawn as a call flow points the opposite way from one drawn as dependencies. The rule format must say which, per diagram or per edge set.
- **Some rules cross diagrams.** C4 consistency and "every threat is linked" need the link tree, not one file.
- **Limits.** A check only says the diagram follows the style. It cannot say the code does. That is a different category of tool.

## 4. Open items

- Decide which of the styles above ship as built-in profiles first. Hexagonal and layered are the simplest and exercise the whole mechanism.
- Add one deliberately wrong example diagram per profile, so a rule has something to fail on.
- Keep this list in step with the gallery: each diagram type marked **Good** should eventually have an example.
