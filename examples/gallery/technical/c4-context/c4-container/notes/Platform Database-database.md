# Platform Database

The Ticketing & Booking Platform's own data store — bookings, seat/ticket inventory, and a working copy of passenger data needed for active bookings (not the system of record for full passenger profiles; that's still the external Loyalty & CRM System).

Only the Booking API talks to it directly — no other container reads or writes this database, deliberately, to keep a single owner of the platform's core data model.
