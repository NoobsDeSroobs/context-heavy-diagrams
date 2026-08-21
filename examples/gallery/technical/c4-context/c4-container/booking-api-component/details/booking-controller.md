# Booking Controller

The API surface both frontends call — Booking Web/Mobile App and Staff Portal alike, the same endpoints for both. Deliberately thin: validates and routes requests to Search & Reservation Service, Orchestration Service, or Profile Sync Service, with no business logic of its own.
