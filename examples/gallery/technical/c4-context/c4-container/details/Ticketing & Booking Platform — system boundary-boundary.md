# Ticketing & Booking Platform

The system in scope for Meridian Rail's modernization program — the target replacement for the legacy point-to-point ticketing estate, and the reason the task force exists (see the motivation/goals view, epic 0022 entry #9, once built).

## Responsibilities

- Route and fare search across Meridian Rail's own network and interoperable services from other operators
- Seat/ticket inventory and reservation
- Ticket issuance (digital e-ticket, and printed via station staff)
- Payment orchestration (fare charges, refunds) — see Payment Gateway
- Passenger profile and loyalty point sync — see Loyalty & CRM System
- Cross-operator ticket validation for journeys that leave Meridian Rail's own network — see National Rail Interop Network
- During the migration window: reads seat inventory from the Legacy Reservation Mainframe until the platform's own inventory is authoritative (see that system's own details for the cutover plan)

## Boundary

Everything *inside* this box is out of scope at the Context level — that's what the Container-level diagram (epic 0022 entry #5, not yet built) exists to show: the platform's own internal services (booking API, payment orchestration service, notification service, its own database) and how they talk to each other.

## Non-functional notes

- In scope for PCI-DSS (handles payment card data indirectly via the Payment Gateway) and GDPR (passenger PII — names, journey history, payment metadata)
- Needs to handle sharp peak load around commuter hours and public-holiday travel surges
- Availability matters more here than for most of Meridian Rail's back-office systems — this is customer-facing and revenue-generating

## Status in the scenario

Being actively designed by the modernization task force; this Context diagram represents the *target* state, not what exists today. The current as-is estate is covered separately by the base landscape diagram (epic 0022 entry #1, not yet built).
