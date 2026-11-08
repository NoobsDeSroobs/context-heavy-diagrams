# Payments

Charges a card through the payment provider and stores the result.

- Card data never leaves this service (PCI scope).
- Retries a failed charge twice, one minute apart.
- Owner: team-pay.
