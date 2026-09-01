# Dim Passenger

A conformed passenger dimension, deliberately **narrow and non-identifying**
so the analytics model carries no direct personal data (Meridian Rail is
under GDPR scope for passenger data).

| Column | Notes |
|---|---|
| `PassengerKey` | Surrogate key. The natural key (booking account id) is hashed in the load and not stored here. |
| `LoyaltyTier` | None / Silver / Gold / Platinum. |
| `AgeBand` | Banded (`<18`, `18–25`, `26–40`, `41–60`, `60+`) — never a date of birth. |
| `HomeRegion` | Region only, never a postcode or address. |
| `ConsentMarketing` | Whether the passenger has opted in to marketing analytics; rows without consent are still counted in revenue measures but excluded from behavioural segmentation reports by a separate RLS role. |

This is the dimension most likely to grow into a snowflake later (a
`Dim Loyalty Programme` behind `LoyaltyTier`), which is why it's worth its
own detail note.
