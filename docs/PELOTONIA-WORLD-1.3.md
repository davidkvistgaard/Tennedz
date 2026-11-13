# Pelotonia World 1.3

World 1.3 extends the preserved [World 1.0](./PELOTONIA-WORLD.md) and [World 1.1](./PELOTONIA-WORLD-1.1.md) data with the owner's [deep-world V1.2](./PELOTONIA_DEEP_WORLD_EXPANSION_V1_2.md) and [discovery V1.3](./PELOTONIA_DISCOVERY_EXPANSION_V1_3.md) specifications. The current public export is [World 1.5](./PELOTONIA-WORLD-1.5.md); this document describes the preserved 1.3 layer. No database migration or cycling content is involved.

## Content and identity

The complete 192-cell V1.2 index is preserved. Its repeated names within a region are one regional feature with references to all compatible cells; the older `CELL-*` records remain as source entries with their original stable IDs. Eight major cities retain their `CITY-*` IDs, with V1.2 district names replacing earlier provisional names on the existing district IDs. Aurelia retains its 14 `AUR-*` districts, cathedral dimensions and established landmark/site IDs. Named L4 sites extend those objects. Natural systems have child sites attached to their established parent where one exists, and the three principal southeastern islands are explicit parents for their named sites.

The 24 secondary cities use the requested `RC-*` IDs. Each has three provisional district concepts and three provisional local-anchor concepts. Their approximate population and geographic reason are preserved. The 119 `DISC-*` identifiers either identify a new discovery or resolve as a source alias to an existing physical, infrastructure, or V1.2 object. For example, `DISC-005` resolves to Crownfall `PHY-015`, `DISC-010` to Crown Dam `INF-003`, and `DISC-024` to Pelotonia Link `INF-001`. `DISC-029` is an alternate source label for `DISC-001` (“Wind Organ” / “The Wind Organ”). Names can change without changing IDs.

The Crownway, Emerald Highway, Eastern Way and Caldera Road, with their corresponding rail lines, each have one continuous local-km **prototype** line. A southeastern ferry ring is likewise a continuous prototype. Their ordered grid references derive from geometry and are validated. Earlier four river systems and national routes remain. The Pelotonia Link is still a concept: V1.2 supplies a preferred sequence and length but no exact alignment, so its geometry remains unresolved.

## Placement and remaining source questions

The documents give regions, broad grid coverage, landscape descriptions and named waypoints, but generally do not give surveyed point positions, urban boundaries or site footprints. The 24 regional cities occupy one terrain-compatible provisional cell each, with `geometry: null`; child districts/anchors inherit that cell. A regional discovery without a supported cell remains **region-only** with no fabricated point. The atlas can find these places and navigate to their known cell or parent region. L2/L3/L4 visibility is carried by each object's `minZoom`, while cartographic drawing remains limited to objects with geometry.

V1.2 conflicts with V1.1 in two cells: K3 is labelled Northern Highlands in V1.2 but Northern Plateau in V1.1, and O3 is labelled Northern Plateau in V1.2 but Ocean in V1.1. V1.1 is authoritative: K3 is Northern Plateau and O3 is Ocean. Their `GRID-*` IDs are unchanged. `SOURCE-008` records the resolved erratum; the conflicting V1.2 labels do not override those cells.

V1.3 also changes three settlement estimates from V1.2: Aurel Gate (~1,100 → ~41,000), Redgate (~21,000 → ~61,000) and Saltwell (~8,000 → ~37,000). `SOURCE-009` now records the owner's clarification: the later figures are wider settlement/municipal populations; the earlier figures are core-settlement subsets and must never be added separately to national population.

The city templates and route lines are explicit concepts/prototypes, not invented settlement history or precise cartography. Exact placement of regional discoveries, local street layouts, transport engineering and natural-site shapes remain future geography work. Sparse wilderness and marine areas are not padded with arbitrary attractions.

## Editing and verification

The checked-in Markdown files are authoritative sources. Regenerate the parsed inventory after editing them:

```
node scripts/build-world-expansions.mjs
node scripts/build-world-expansions.mjs --check
```

`lib/world/data-v1-3.mjs` merges that inventory onto immutable World 1.1 records. Keep both earlier datasets for regression tests. Before release, run world validation, unit and browser tests, lint and a production build. No production service was changed by this version.

New regional feature and natural-child IDs use fixed source positions, not editable display names. A name edit at the same source position keeps its ID. Reordering/removing entries or changing the grouping of repeated names requires an explicit ID migration and updated tests.
