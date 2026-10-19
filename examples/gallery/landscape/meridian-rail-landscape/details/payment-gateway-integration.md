# Payment Gateway Integration

Connects Meridian Rail to the external card acquirers. It never sees full card numbers: the acquirer's hosted fields tokenise them in the browser or app, and only the token and a masked reference reach this service.

## Data and legal position

| Item | Value |
| --- | --- |
| GDPR class | Pseudonymized |
| What is stored | Token, masked card reference, amount, currency, authorisation result |
| NIS2 | **Essential entity** |
| Owning team | Finance Systems |

Because a failed payment path stops ticket sales, the service is treated as essential for NIS2: it has its own incident runbook and is part of the quarterly resilience test.

## Behaviour worth knowing

1. A payment is authorised first and captured only when the ticket is issued.
2. Authorisations that are not captured within 30 minutes are released automatically.
3. Refunds are requested by the **Refund Processing Service** and always go back to the original token.

## Open points

- The second acquirer is wired in but not yet enabled in production.
- Chargeback data arrives by file and is reconciled by hand each morning.
