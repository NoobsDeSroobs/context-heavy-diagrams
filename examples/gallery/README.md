# Example gallery

A broader set of example diagrams, distinct from the minimal round-trip fixtures in the parent [`examples/`](../README.md) folder (start there for an index of what to open). Everything here is fictional content about one rail operator, "Meridian Rail", written to find where the tool's flexibility holds up and where it breaks down.

Most entries are separate, independently drawn diagrams. The one diagram that is reused is the full IT landscape: the GDPR and NIS2 views are tag-based highlights switched on over it, not separate diagrams, because a highlight only means something over the same underlying diagram. [ADR 0028](../../docs/decisions/0028-example-gallery-shared-landscape-and-domain-folders.md) explains why the gallery is shaped this way.

Folders are organised by domain, meaning who would make or use the diagram, not by job title.

| Folder | Covers |
|---|---|
| [`landscape/`](landscape/README.md) | The full IT landscape with its GDPR and NIS2 highlights, and the same estate as a drill-down by business domain |
| [`technical/`](technical/README.md) | A C4 chain from context to container to component, and a security matrix that rolls up through three layers of diagrams |
| [`business/`](business/README.md) | A customer journey |
| [`data/`](data/README.md) | A Power BI star schema |
| [`organisation/`](organisation/README.md) | A motivation view of drivers, goals and objectives |
