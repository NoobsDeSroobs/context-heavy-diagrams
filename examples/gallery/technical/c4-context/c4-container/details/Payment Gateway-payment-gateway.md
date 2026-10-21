# Payment Gateway

A third-party payment service provider, external to Meridian Rail — not built or owned by Meridian Rail, integrated with via API.

## Role

Processes card and digital-wallet payments for ticket purchases, and refunds for cancellations/changes. Handles PCI-DSS-scoped cardholder data directly so the Ticketing & Booking Platform itself never stores raw card numbers.

## Why it matters here

The "charges fares via" relationship is one of the platform's most availability-critical dependencies — a payment gateway outage stops ticket sales outright, not just degrades them.
