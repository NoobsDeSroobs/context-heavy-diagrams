# Retry & Reconciliation Engine

The actual payment-orchestration logic: retries on transient Payment Gateway failures, and reconciles this service's own view of a charge's status against the gateway's, so a charge is never silently lost or double-applied.
