# Data

Data-facing diagrams, for data architects, BI developers and analytics engineers.

- **`star-schema-powerbi.chd`**: a Power BI semantic model over Meridian Rail's new booking platform, with one fact table (`Fact Ticket Sales`) and five conformed dimensions (Date, Route, Station, Passenger, Channel). It shows multi-line labels for table columns, crow's-foot cardinality markers, and **edge direction sets** ([ADR 0081](../../../docs/decisions/0081-flippable-edge-direction-sets.md)) for the two ways a Power BI relationship reads: "Cardinality (1 to *)", the FK to PK structure, and "Filter direction", how filter context propagates at query time. They are the same five relationships with opposite arrows; switch between them in Diagram settings → Edge direction sets. Notes are on `Fact Ticket Sales` and `Dim Passenger`.
