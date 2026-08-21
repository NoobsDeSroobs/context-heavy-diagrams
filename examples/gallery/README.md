# Example gallery

Skeleton for [epic 0022](../../docs/planning/epics/0022-example-diagram-gallery.md) — a broad, illustrative example set, distinct from the minimal round-trip fixtures in the parent [`examples/`](../README.md) folder. Nothing here is about this tool itself except `self-documentation/`; everything else is fictional content used to find out where the tool's flexibility holds up and where it breaks down.

See [ADR 0028](../../docs/decisions/0028-example-gallery-shared-landscape-and-domain-folders.md) (and its amendments, especially the 2026-08-20 one on domain-over-persona framing and trimming) for why the gallery is shaped this way.

## Structure

Every entry shares one fictional setting — see [epic 0022's candidate diagram list](../../docs/planning/epics/0022-example-diagram-gallery.md#candidate-diagram-list-meridian-rail-scenario--under-review) — but most entries are **genuinely separate, independently-drawn diagrams**, not mechanically derived from one master file. The one place a single base diagram *is* reused is **compliance/regulatory dimensions**: a GDPR view and an NIS2 view are tag-based highlight overlays toggled on top of the base landscape diagram in `landscape/`, not separate flat diagrams.

Folders are organized **by domain — who'd actually make or use the diagram — not by architect job title.** The tool should be useful to as many people as possible, not to as many specialist roles as possible; a PO reading a business capability map doesn't care that a "business architect" is the nominal persona. Folders were consolidated 2026-08-20 to cut duplication (a cloud-architecture diagram isn't meaningfully different from a technical one; a portfolio-rationalization view isn't meaningfully different from a capability heatmap) — see epic 0022's Notes.

| Folder | Covers |
|---|---|
| [`landscape/`](landscape/README.md) | The base system-landscape diagram + its compliance highlight overlays (GDPR, NIS2) |
| [`technical/`](technical/README.md) | C4 context/container/component — absorbs what would've been separate integration and infrastructure/cloud folders |
| [`business/`](business/README.md) | Capability heatmap, customer journey |
| [`organisation/`](organisation/README.md) | Motivation/goals view, RACI matrix — people, accountability, process |
| [`self-documentation/`](self-documentation/README.md) | This tool's own technical + functional views, built with its own features (dogfooding) — unrelated to the Meridian Rail scenario |

Deferred, not dropped: a dedicated data-domain folder, a hello-world tier, and a standalone limits-tests folder (a genuinely useful entry like the RACI matrix above can double as a limits-test without needing its own category). Revisit once the trimmed candidate list above is actually built.

## Status

Skeleton only — no `.chd` files yet, and the candidate list itself isn't approved. See [epic 0022](../../docs/planning/epics/0022-example-diagram-gallery.md#candidate-diagram-list-meridian-rail-scenario--under-review) for the current list, and each folder's own README for its specific candidate entries.
