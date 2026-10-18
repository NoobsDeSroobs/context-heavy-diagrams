# Security Matrix rollup demo

A three-layer worked example for the recursive Security Matrix rollup — see
[ADR 0088](../../../../docs/decisions/0088-recursive-security-matrix-rollup.md)
and [epic 0081](../../../../docs/planning/completed-epics.md#0081-recursive-matrix-population-and-automation).
Fictional Meridian Rail content.

## Layout

```
security-rollup.chd                        Layer 1 — Business domain
├─ domain-customer.chd                      Layer 2 — Services
│  ├─ identity-service.chd                  Layer 3 — Technical components (leaf, assessed)
│  └─ profile-service.chd                   Layer 3 (leaf, assessed)
├─ domain-payments.chd                      Layer 2 — Services
│  ├─ payment-gateway.chd                   Layer 3 (leaf, assessed)
│  └─ ledger-service.chd                    Layer 3 (leaf, assessed)
└─ domain-analytics.chd                     ← deliberately DOES NOT EXIST (broken link)
```

Open **`security-rollup.chd`** and switch to the **Security Matrix** persona
(toolbar, top-left).

## What each layer shows

| Layer | File | Matrix columns |
|---|---|---|
| Business domain | `security-rollup.chd` | Customer Management + Payments = **derived** (🔗, rolled up). Analytics & Reporting = **broken link** (red hatch, inert). Corporate Website = **assessed directly** (no sub-diagram). |
| Services | `domain-customer.chd` | Identity + Profile = derived. Notification Service = assessed directly. |
| Services | `domain-payments.chd` | Both columns derived. |
| Technical components | the four leaves | Every column assessed by hand — this is where the real probability/consequence numbers live. |

## Things to try

- **Recursion** — a cell in `security-rollup.chd` for "Payments" is the roll-up
  of `domain-payments.chd`, which is itself the roll-up of `payment-gateway.chd`
  and `ledger-service.chd`. Click a derived cell for the breakdown popup and an
  "Open linked diagram" link.
- **Calculation modes** — change **Cell score** (Multiply / Add / Average) and
  **Threat/vulnerability score** (Average / Sum / Max). Every derived number at
  every layer recomputes, because the modes belong to the matrix you're looking
  at and flow down the whole tree (they are never stored in a file). "Max" makes
  the Card Vault's catastrophic "Data breach" consequence and the PSP Connector's
  "Supply chain" risk jump out.
- **Broken link** — "Analytics & Reporting" points at a file that isn't there.
  Its column is hatched and can't be edited; the completeness banner counts those
  cells under "in linked diagrams". Fix it by relinking or removing the link on
  the shape.
- **Non-linked shape** — "Corporate Website" (Layer 1) and "Notification Service"
  (Layer 2) are ordinary editable columns sitting right next to derived ones.
- **Downstream-only threat** — `identity-service.chd` assesses "Insider misuse",
  which isn't in the Services-layer catalog. Open `domain-customer.chd`'s matrix:
  it's surfaced as a note under the completeness banner, not as a row. Add it as
  a threat there to pull it into the grid.
- **Refresh** — after editing a leaf, use **↻ Refresh links** in the matrix to
  re-read the sub-diagrams. (Derived values are never saved — they're recomputed
  every time.)
