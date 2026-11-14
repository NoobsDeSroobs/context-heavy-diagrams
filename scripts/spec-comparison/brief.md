# Brief: the Harbour Retail platform

Draw one architecture diagram of an online shop, Harbour Retail. Use the content below as it is; do not add or drop elements. Where to put things, how big to make them and how to lay them out is yours to decide.

## Shape of the diagram
A layered architecture, top to bottom, all inside one boundary called "Harbour Retail platform". Outside the boundary, above it, are the people and systems that use it; outside, below it, are the two external providers.

1. **Clients** (outside, above the boundary): Web shopper, Mobile shopper.
2. **Edge layer** (a container inside the boundary): CDN, API gateway.
3. **Service layer** (a container inside the boundary): Catalogue service, Cart service, Order service, Payment service, Search service, Notification service.
4. **Data layer** (a container inside the boundary): Catalogue DB, Order DB, Session cache, Event bus.
5. **External providers** (outside, below the boundary): Card processor, Email provider.

The boundary holds the three layer containers. Every layer container has a label.

## Connections (every one has a label)
| From | To | Label |
|---|---|---|
| Web shopper | CDN | loads pages |
| Mobile shopper | API gateway | calls API |
| CDN | API gateway | forwards requests |
| API gateway | Catalogue service | browse |
| API gateway | Cart service | add to cart |
| API gateway | Order service | place order |
| API gateway | Search service | search |
| Catalogue service | Catalogue DB | reads and writes |
| Search service | Catalogue DB | indexes |
| Cart service | Session cache | stores carts |
| Order service | Order DB | saves orders |
| Order service | Payment service | requests payment |
| Order service | Event bus | publishes order events |
| Payment service | Card processor | charges card |
| Event bus | Notification service | delivers events |
| Notification service | Email provider | sends email |

## Done means
- The diagram is saved as the file named in your instructions.
- Every element and connection above is in it, with the labels shown.
- Nothing overlaps, no label is hidden by the elements it joins, and nothing sticks out of its container.
- Finish by asking for the remaining layout problems (inspect_diagram with issues_only) and report them, even if there are none.
