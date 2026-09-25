# Pelotonia World 1.1

World 1.1 is the authoritative expansion of [the owner's complete specification](./PELOTONIA_COMPLETE_WORLD_SPEC_V1_1.md). The immutable World 1.0 source remains in `lib/world/data-v1.mjs` for regression tests. `lib/world/index.mjs` exports the validated 1.1 dataset; the atlas prototype adds schematic visual geometry to the same objects. There is no database migration.

## Content and identity

The 16 × 12 grid retains every `GRID-*` ID. All 192 dossiers and all 1,561 listed L2 entries are represented. Nine major-city entries resolve to the nine existing `CITY-*` objects, so the expansion adds 1,552 cell entries with new `CELL-<cell>-<ordinal>` IDs. The 155 land cells each have an independently editable local identity; 37 ocean cells may be sparse. Repeated working names remain separate source entries when the specification lists them separately. Never use a display name as an ID or use a name to join geography. Existing World 1.0 records and their stable IDs are retained.

The national IDs printed in the new document (`NAT-MTN-001`, `NAT-WAT-001`, `INF-01`, etc.) are stable **aliases** for existing `PHY-*` and `INF-00*` records. They resolve through `getWorldObject`; creating second copies would fragment references. `PHY-015` now has the supplied working name Crownfall, and `INF-003` has Crown Dam. The airport and Westhaven port are editable canonical places. The unbuilt bridge, tunnel and dam remain concepts. Aurelia's existing district and landmark IDs, including reserved `AUR-LMK-012`, remain intact. Its specified Old Aurelia places and cathedral components have their own new stable IDs; the three already drawn cathedral site IDs are reconciled with the new canonical names.

Four cells change environmental classification in this **new version**: J10 becomes Central Plains, L10 becomes Eastern Steppe, O10 becomes Redlands and O12 becomes Southeastern Islands. This follows the complete 1.1 dossiers; the World 1.0 classification remains available unchanged in `data-v1.mjs`. Northern Plateau keeps `REG-NORTHERN-PLATEAU` and its 11 P cells.

## Geography and limits

The cell descriptions and elevation ranges are source data. Adjacent land-cell elevation ranges overlap, which the validator now checks. Cell boundaries remain indexing containers, never physical borders. Four inherited river systems, the Great Range backbone, two road corridors, two rail corridors, a southern ferry corridor and two associated settlement corridors have continuous **prototype** local-km lines. Each route's ordered cell references are derived from its own geometry and validated, so a broken corridor reference fails. A local road, rail line or ferry landing only claims a relation to a national corridor when the latter actually passes through its source cell.

Most individual dossier entries have no supplied coordinate. They are deliberately cell-indexed with `geometry: null` rather than placed at fabricated points. The atlas can list and select them by cell; selecting one does not claim an exact location. The original illustrative coastline and the authored network lines remain marked as prototypes. The new specification locates the nine major cities by cell, so the atlas's old proposed city points were moved into those cells. Those points are still provisional.

Outside Aurelia, each major city has three role-specific L3 district **concepts**, to support later design without claiming that boundaries or names were supplied. Signature natural sites have comparable concept-level local areas. The specification does not provide the exact layouts, settlement histories or thousands of L4 features required for a finished street-level atlas. These unknowns remain explicit. New types and features use the existing object envelope and validator. No cycling geography is added.

## Editing

The checked-in source is `docs/PELOTONIA_COMPLETE_WORLD_SPEC_V1_1.md`. After an authorized editorial change to its dossier lists, run:

```
node scripts/build-world-dossiers.mjs
node scripts/build-world-dossiers.mjs --check
```

The parser verifies 192 cells, 1,561 entries and region names. **Do not reorder or remove existing source entries without a stable-ID migration:** new `CELL-*` IDs use their original ordinal, but a name edit alone preserves identity. Extend `data-v1-1.mjs` with new objects and types while retaining all existing IDs. Run tests, lint and production build before release. This work is on the recovery branch; no production database or site changes were made for World 1.1.
