# Legacy Reservation Mainframe

The system the Ticketing & Booking Platform is replacing. Still authoritative for seat inventory during the migration window — hence the dashed edge in this diagram, marking the relationship as transitional rather than a permanent architectural dependency.

## Role today

Holds the current seat/reservation inventory and historical booking records going back decades. Point-to-point integrated with several other legacy systems not shown at this level — see epic 0022 entry #1, the as-is landscape diagram, once built, for the fuller picture of what this system currently touches.

## Planned end state

Once the new platform's own inventory is proven reliable, this system is decommissioned and the "reads legacy seat inventory from" edge is removed entirely — it should not appear in the Container or Component-level diagrams' *target* architecture, only here at Context level as an honest depiction of the transition period.
