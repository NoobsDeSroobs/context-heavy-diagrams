# Identity & Access Management

Staff and service identity for the whole estate: single sign-on, multi-factor authentication and role-based access. It is run by an external provider, which is why the owning team is shown as **External**.

## Data and legal position

| Item | Value |
| --- | --- |
| GDPR class | **PII** (staff identities, sign-in history) |
| NIS2 | **Essential entity** |
| Owning team | External |
| Contract | Reviewed yearly; the data processing agreement is held by Corporate IT |

Passenger accounts are **not** held here; they live in the Customer Profile Service.

## Why it matters for the rest of the landscape

Almost every other service trusts the tokens issued here. If it is unavailable, nobody can sign in to operational systems, so it carries the strictest recovery target in the estate.

## Controls

- Multi-factor authentication is required for every human account.
- Privileged roles are time-limited and approved by a second person.
- Sign-in logs are kept for 12 months and reviewed monthly by Safety & Compliance.

## Open points

- Service-to-service credentials are still partly static; the plan is to move them to short-lived tokens.
