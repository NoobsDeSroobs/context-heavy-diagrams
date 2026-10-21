# Legacy Sync Service

A transitional container, not a permanent part of the target architecture — reads seat inventory from the external Legacy Reservation Mainframe on the Booking API's behalf during the migration window. Same "being retired" status as the mainframe it talks to (dashed edge, matching the Context-level convention).

Planned to be deleted entirely, not just disconnected, once the mainframe is decommissioned — there's no future state where this container still exists but does nothing.
