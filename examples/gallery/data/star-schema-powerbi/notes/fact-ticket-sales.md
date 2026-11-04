# Fact Ticket Sales

**Grain:** one row per ticket line sold (a single passenger, single journey leg).

**Source:** the booking platform's `sales.ticket_line` table, loaded into the
Power BI semantic model in Import mode, refreshed nightly.

## Foreign keys

| Column | Joins to | Notes |
|---|---|---|
| `DateKey` | Dim Date | Sale date, not travel date (a separate role-playing date dimension for travel date is out of scope for this example). |
| `RouteKey` | Dim Route | The booked route. |
| `OriginStationKey` | Dim Station | Boarding station. Destination station is an attribute of the route here, deliberately not a second Station relationship, to keep the star single-level. |
| `PassengerKey` | Dim Passenger | Pseudonymised passenger key — see the Dim Passenger note. |
| `ChannelKey` | Dim Channel | Where the sale happened (web, app, station counter, partner). |

## Measures (defined on this table)

- **Net Revenue** = `SUM(NetRevenue)`
- **Tickets Sold** = `SUM(Quantity)`
- **Average Fare** = `DIVIDE([Net Revenue], [Tickets Sold])`
- **Discount Rate** = `DIVIDE(SUM(DiscountAmount), SUM(GrossFare))`

All measures are additive across every dimension in the model.

## Why this is the centre of the star

Every dimension filters *into* this table and nothing filters out of it —
that one-directional filter flow is what the **"Filter direction"** reading
of the relationships shows. The **"Cardinality"** reading shows the same five
relationships as `*—1` (many fact rows to one dimension row).
