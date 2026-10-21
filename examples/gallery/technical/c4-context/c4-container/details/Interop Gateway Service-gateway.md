# Interop Gateway Service

Sits between the Booking API and the external National Rail Interop Network. Translates the platform's own ticket/booking model into whatever format the shared multi-operator network expects, and back.

Same isolation rationale as Payment Orchestration Service: keep an external integration's quirks out of the Booking API's own core logic.
