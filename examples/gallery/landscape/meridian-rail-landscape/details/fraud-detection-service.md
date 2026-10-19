# Fraud Detection Service

Scores every booking and payment attempt for fraud risk and tells the booking flow to accept, challenge or block it.

## Data and legal position

| Item | Value |
| --- | --- |
| GDPR class | **PII** (device and behaviour signals tied to an account) |
| Lawful basis | Legitimate interest: preventing fraud against passengers and the company |
| NIS2 | Important entity |
| Status | In development |

Automated decisions that block a booking must be explainable and reviewable by a person, so every block records which signals contributed to it and goes to the fraud analysts' queue.

## Inputs and outputs

- **In:** booking attempts, payment results, device signals, account age and history.
- **Out:** a risk score from 0 to 100 and one of *accept*, *challenge* (extra verification) or *block*.

## Open points

- The false-positive rate on group bookings is too high; the thresholds need tuning before release.
- A decision on how long behaviour signals are kept is still needed; the working proposal is 90 days.
