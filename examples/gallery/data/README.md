# Data

Content aimed at whoever produces or reads a data-facing diagram — data
architects, BI developers, analytics engineers.

This folder was **deferred** in the 2026-08-20 gallery trim (see
[epic 0022](../../../docs/planning/epics/0022-example-diagram-gallery.md#candidate-diagram-list-meridian-rail-scenario--under-review)),
then created 2026-09-01 for the first data entry below, at the user's
request.

## Candidate entries

- **Power BI star schema — `star-schema-powerbi.chd`**: content done. A
  data architect laying out a Power BI semantic model over Meridian Rail's
  new booking platform — one fact table (`Fact Ticket Sales`), five
  conformed dimensions (Date, Route, Station, Passenger, Channel).
  Exercises: multi-line labels for table columns, crow's-foot cardinality
  markers, and **edge direction sets** (ADR 0081) for the two ways a Power
  BI relationship reads — *"Cardinality (1 to *)"* (the FK→PK structure)
  vs. *"Filter direction"* (how filter context propagates at query time),
  the same five relationships with opposite arrows. Switch between the
  readings in Diagram settings → Edge direction sets. Two detail notes
  (`fact-ticket-sales`, `dim-passenger`). **Awaiting the user opening it
  in-app.**

## Deferred (not dropped)

- Conceptual / logical data model, data lineage, data-flow (system-to-
  system), data-governance / ownership map, snowflake schema — see epic
  0022's data-architect checklist. The snowflake variant would extend the
  star above (e.g. `Dim Loyalty Programme` behind `Dim Passenger`).

## Status

Star schema content-complete, not yet opened in-app.
