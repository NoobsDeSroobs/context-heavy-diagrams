# 0175: Assistants make what a person can make

## Status
Accepted (2026-11-15)
Amends: the `add_connection_point` operation of [0138](0138-assistants-build-diagrams-like-a-person-through-one-implementation-behind-the-cli-and-the-mcp-server.md).
Superseded by: none

## Context
A diagram an assistant draws and one a person draws must look alike, so a person can pick either up and carry on in the app. The app spaces the connection points of a side evenly (N points sit at 1/(N+1) ... N/(N+1)) and re-spaces them whenever a point is added or removed. `add_connection_point` took an exact offset, so assistants produced uneven points that the app would never make.

## Decision
- **The tools follow the app's rules, not the file format's freedom.** A side's points are evenly spaced; `add_connection_point` re-spaces the side the way the app does, and its `offset` only says where in the order along the side the new point goes. The spacing code is shared with the app.
- **Routing writes only what a person can draw:** `step` edges with bend points on a right-angled path, and connection points as above.
- The file format still allows any offset (a person may drag a point); that is a person's choice, not something an assistant produces.

## Alternatives considered
- **Keep exact offsets for assistants:** gives straight edges by placing a point opposite its target, but the result does not look like a person's and a later point added in the app re-spaces them all anyway.
- **Align a point with another element by a stored offset:** the same exactness, rejected for the same reason. Straightness is meant to come from rendering instead: a point slides a few pixels off its even slot to line an edge up, for any author's diagram, and past that range the edge bends.

## Consequences
- An assistant gets a straight edge by placing the elements so, and by the small slide of a point where that is built, not by offsetting points.
- A file written earlier with uneven points is unchanged until a point on that side is added.
