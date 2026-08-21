# Booking API

The core backend service — the actual "brain" of the Ticketing & Booking Platform, and the container everything else in this diagram ultimately routes through or reports to.

## Responsibilities

- Route and fare search
- Seat/ticket reservation and inventory management (via Platform Database)
- Ticket issuance
- Orchestrating dependent operations: requesting a charge from Payment Orchestration Service, requesting cross-operator validation from Interop Gateway Service, requesting legacy inventory reads from Legacy Sync Service during the migration window
- Triggering Notification Service after a booking-affecting action
- Syncing passenger profile and loyalty points directly with the (external, pre-existing) Loyalty & CRM System

## Why it's drawn as a hub

Every other internal container either serves this one (the two frontends) or is called by this one (the backend services and the database) — deliberately centralized rather than choreographed, which keeps the failure modes easier to reason about at this stage of the platform's design, at the cost of this service carrying a great deal of responsibility. Worth revisiting if/when a Component-level diagram (epic 0022 entry #6) shows this needs splitting further.

## See also

The Context-level view of this same system (one level up) has fuller non-functional notes — PCI-DSS/GDPR scope, peak-load expectations — that still apply here, just not restated per-container.
