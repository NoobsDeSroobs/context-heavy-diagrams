# 0125: Outline / table view of all elements

## Status
Not Started — idea bucket, logged 2026-09-19. The user is **hesitant**: risk
of adding noise/complexity without enough strong use cases. If built, it
should sit behind the [feature toggle system (0124)](0124-feature-toggle-system.md),
default off.

## Goal
A read-only, sortable/filterable list of every element in the open diagram —
label, type, tags, has-details, has-link, security score — where clicking a row
selects and frames the element (same reveal mechanism as Diagnostics). Answers
"everything tagged X that lacks Y" faster than a canvas can.

## Guardrails
- Strictly read-only/navigational in v1; editable cells would make it a second
  editor to maintain.
- Could share its row component with the "Changes since last save" panel
  ([epic 0117](../0117-changes-since-last-save.md)).

## Note: use case to validate before building
Note what real question this answers that search (0062) + highlights +
isolate (0063) don't. If nothing concrete comes up in real use, don't build it.
