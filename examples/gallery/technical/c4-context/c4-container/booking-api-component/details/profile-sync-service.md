# Profile Sync Service

Keeps the passenger's profile and loyalty points in sync with the external Loyalty & CRM System. Called by Booking Controller directly (not via Orchestration Service) since profile sync isn't part of the post-booking sequence — it can happen any time a passenger's details change, not just after a booking.
