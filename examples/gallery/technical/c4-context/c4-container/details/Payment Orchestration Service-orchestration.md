# Payment Orchestration Service

Sits between the Booking API and the external Payment Gateway. Handles the charge/refund request lifecycle, retries, and reconciliation — logic the Booking API itself shouldn't need to know about.

Exists as its own container specifically so payment-specific compliance concerns (PCI-DSS scope) stay contained to one place rather than spreading across the Booking API.
