# Notification Service

Sends e-tickets, booking confirmations, and change/cancellation notices to passengers, triggered by the Booking API after a booking-affecting action completes.

Deliberately decoupled from the request/response path of booking itself — a slow or failing notification should never block or fail a booking.
