# Orchestration Service

Everything that needs to happen after a reservation succeeds, in one place: requesting a charge (Payment Orchestration Service), requesting cross-operator validation (Interop Gateway Service), requesting legacy inventory sync during the migration window (Legacy Sync Service), and triggering passenger notifications (Notification Service).

Centralizing this here — rather than having Search & Reservation Service call all four itself — keeps the core booking logic free of post-booking workflow concerns, and gives the whole post-booking sequence one place to reason about if it needs to change (e.g. once Legacy Sync Service is finally decommissioned, this is the one component that changes).
