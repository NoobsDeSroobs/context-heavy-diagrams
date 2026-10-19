# Customer Profile Service

The single source of truth for who a passenger is: identity, contact details, accessibility needs, loyalty number and consent choices. Booking, notifications and the mobile app all read from it rather than keeping their own copies.

## Data and legal position

| Item | Value |
| --- | --- |
| GDPR class | **PII** |
| Lawful basis | Contract (the account) and consent (marketing, journey updates) |
| Retention | Account lifetime plus 24 months after last activity |
| NIS2 | Important entity |

Erasure and access requests go through the Data Subject Request workflow and are answered within one month. Consent is stored per purpose with a timestamp, so withdrawing marketing consent does not touch the booking history.

## Who depends on it

- **Booking Session Manager** reads the profile to prefill passenger details.
- **Loyalty Rewards Engine** reads the loyalty number and tier.
- **Customer Notifications Service** reads contact details and consent flags before sending anything.

## Open points

- Accessibility preferences are special-category data in some readings of the regulation; the data owner has asked for a legal review before the service leaves development.
- Profile merges after a passenger registers twice still need a manual step.
