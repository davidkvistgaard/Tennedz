# Pelotonia World 1.5

World 1.5 applies the owner's [V1.4 local-detail](./PELOTONIA_LOCAL_DETAIL_EXPANSION_V1_4.md) and [V1.5 connectivity](./PELOTONIA_CONNECTIVITY_SYSTEMS_EXPANSION_V1_5.md) specifications after the preserved [World 1.3](./PELOTONIA-WORLD-1.3.md). `lib/world/index.mjs` exports the validated 1.5 world; `lib/world/atlas-data.mjs` adds illustrative map artwork. This is fictional geography and infrastructure, with no cycling-specific content or database migration.

The current exported graph includes the owner's later [Baseline 1.6.2 semantic decisions](./PELOTONIA-WORLD-BASELINE-1.6.2.md). The original World 1.0–1.4 source datasets remain versioned history; the paragraphs below describe the 1.5 implementation before those decisions.

The separate [V1.6 visual layer](./PELOTONIA-VISUAL-GEOGRAPHY-1.6.md) renders this same dataset and does not change its stable IDs or source facts.

## Local detail and identity

All **192 grid cells** receive a local-detail index. Its category reflects the existing population/geography evidence: major city, regional city, town, populated rural, wilderness or ocean. Each populated or wilderness land cell selects appropriately sparse **already named** `CELL-*` features from the V1.2 dossier and links any supported L3/L4 children. Ocean cells are not filled with invented attractions. The cell index references stable object IDs and does not invent exact coordinates.

The 24 `RC-*` regional cities receive their specified named districts and anchors on their established child IDs. The 26 selected towns receive compact L3 areas and an L4 site concept. **20 `TOWN-*` source labels** resolve to earlier settlement IDs; the six truly new towns use the supplied IDs. All earlier objects remain. The 24 signature sites and five engineered sites receive named children under their existing parents.

V1.4 reused **18 `DISC-*` numbers** for places with different meanings in V1.3. The corrected V1.4 source uses `DISC-120`–`DISC-137`; these resolve as source aliases to the already-reconciled parents. No stable repository ID, including the older `V14-SITE-*` child IDs, was renamed. `SOURCE-010` is resolved and `worldV1_4Reconciliation.discoveryCollisions` is empty. `SOURCE-011` records the town aliases. See the [Baseline 1.6.1 audit](./PELOTONIA-WORLD-BASELINE-1.6.1.md).

## Cross-grid systems

The V1.5 layer defines ordered, connected prototype segments for national roads and rail, ferry terminals and crossings, tributary-to-mainstem confluences, watershed outlets, lake outflows, bridges/tunnels, airports and population corridors. Existing V1.2 road/rail lines and river IDs are retained; new V1.5 labels are aliases where they name the same object. The main national lines can be traversed from one named waypoint to the next, and route relationships allow the atlas to open connected places. A multimodal collection records the ferry transfer rather than pretending that a road crosses open sea.

Network coordinates are **schematic local-km prototypes**, not surveyed alignments. V1.5 needed six earlier provisional single-cell settlement placements revised for coherent named waypoint topology: `RC-010` F10, `RC-023` N11, `RC-024` O11, `TOWN-023` P11, `TOWN-018` O9 and `RC-019` M9. Each record retains its prior cell in `placementRevision`; no established object ID or explicit physical classification changed. Exact road junctions, watercourse shapes, ferry lanes and site footprints remain unresolved. K3/O3 and the three settlement-population scopes are now resolved; national/regional population totals still need an editorial decision.

## Validation and regeneration

`scripts/build-world-systems.mjs` parses the checked-in V1.4/V1.5 Markdown into `lib/world/systems-sources.mjs`; use `--check` to verify it has not drifted. The world validator checks all 192 cells, object references, zoom/parent relationships and V1.5 continuity, including missing route legs, endpoints, confluences, lake outlets, engineering attachments and invalid grid placement. Unit tests cover ID preservation, local-detail coverage and broken-network rejection; the atlas browser test checks discovery and navigation. The specifications are the editorial source; new exact geography should update those sources and the corresponding topology together.
