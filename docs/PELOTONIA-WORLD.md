# Pelotonia World 1.0

This is a versioned **data foundation only**. Nothing imports it into the live game yet. It adds no UI, cycling routes, simulation, API endpoints, dependencies or database migrations.

## Files and usage

- `lib/world/data-v1.mjs`: canonical seed records and dataset metadata.
- `lib/world/grid.mjs`: verbatim environmental matrix and deterministic generation of 192 macro cells.
- `lib/world/validate.mjs`: executable schema and cross-record validation.
- `lib/world/index.mjs`: validated, deeply frozen dataset and read-only lookup helpers.
- `tests/unit/world.test.mjs`: source fidelity, invariants, failure cases and extension tests.

```js
import { world, getWorldObject, getWorldChildren, getVisibleWorldObjects } from '../lib/world/index.mjs';
const capital = getWorldObject('CITY-001');
const details = getWorldChildren(capital.id);
const level3 = getVisibleWorldObjects(3); // Concepts excluded by default.
```

The exported `world` is JSON-serializable; generation needs no filesystem, network or database. The raw seed module is for data authoring. Applications should consume the validated public module.

## Object schema, version 1

Every object, including grid cells, has the same envelope:

| Field | Contract |
| --- | --- |
| `id` | Unique stable uppercase ID. Never derive references from an editable name or recycle an ID. |
| `name` | Nonempty working name, or explicit `null` with `properties.namePending: true`. |
| `status` | `fixed`, `canonical_editable`, or `concept`. |
| `type` | One of `WORLD_TYPES` exported by the executable schema. |
| `parentId` | One containing object's stable ID; only Earth has `null`. Containment must be acyclic. |
| `gridCells` | Unique A1–P12 IDs. Empty means location/coverage is not yet assigned. Multiple cells are normal. |
| `geometry` | `null` for unknown geometry, or the explicitly local geometry structure below. |
| `minZoom` | Integer 0–4: minimum semantic visibility level. |
| `maxZoom` | Inclusive maximum semantic level, or `null` for no upper limit. Must be ≥ minimum. |
| `description` | Text; empty when no description is established. |
| `relations` | Array of `{kind, targetId}` links; all targets must exist. |
| `properties` | JSON-compatible structured attributes, measurements and uncertainty. |

Levels are **L0 Earth, L1 whole country, L2 macro/local region, L3 local area/district, L4 landmark/site**. These are not a map library's numerical camera zoom; a future UI must map camera zoom to these levels. Regions can label the L1 country view. Child visibility does not imply inherited exact grid placement.

Measurements use `{value, unit, approximate}` or `{min, max, unit, approximate}`. Strict lower bounds use `minExclusive`, e.g. cathedral capacity >15,000. Use explicit units (`m`, `km`, `km2`, `ha`, `people`). City population scope is metropolitan only where the brief says so; regional and city populations must not be added together.

Region `properties.population` may be `null` when no count is established; this means unknown, not zero. `populationDensity` can retain a qualitative description. Region `elevation`, `landCover`, `landforms` and `climate` store physical characteristics independently of the editable name. All land grid cells, including P, must have `classificationStatus: defined` and a matching region reference; O remains ocean with no land region.

## Northern Plateau specification correction

The owner resolved the omitted P legend on 24 September 2026. World 1.0 now has **13 physical regions** (266 total records); schema version 1 and the original grid layout are unchanged. This completes the original specification rather than changing its grid or previously defined geography. Git history retains the earlier incomplete version.

- Stable ID: `REG-NORTHERN-PLATEAU`; working name: **Northern Plateau**, `canonical_editable`.
- Original cells: **L2, M2, K3, L3, M3, N3, J4, K4, L4, M4, N4**.
- Elevated transitional country east of Northern Highlands (`REG-002`), north/northeast of Central Plains (`REG-006`); these relationships use stable references.
- Elevation approximately **600–1,400 m**; cooler and substantially drier than the western highlands.
- Dominant open grassland/heath, scattered forest, broad valleys, ridges, upland lakes and river headwaters.
- Regular winter snow; generally dry summers, mild-to-warm at lower elevations.
- Relatively low population density. No numerical population or precise boundary has been invented. Existing regional and national population estimates remain unchanged pending demographic reconciliation.

P is distinct from C (Central Plains) and from the P column label. Its region reference cannot be replaced by Central Plains, omitted or marked unresolved. Renaming Northern Plateau preserves references.

Verification of this correction: all **31 unit tests**, lint and the full **41-route production build** pass. The complete existing local browser suite was also run: **5 passed, 3 failed** on pre-existing expectations (`Klar ✅` on the replaced calendar page; `/team` redirects for missing/duplicate-team accounts that now remain on `/onboarding`). No application or browser-test code was changed in this correction; world data is not imported by those pages. These unrelated test expectations are left for separate maintenance. No production deployment or database change is part of this correction.

## Coordinates, boundaries and uncertainty

`pelotonia-local-km` is an **unanchored local Cartesian system**: origin at the northwest grid corner, x east, y south, kilometers. The nominal envelope is 480 × 360 km, containing ocean as well as land. This is not the island's land area.

```js
{
  coordinateSystem: 'pelotonia-local-km',
  type: 'LineString',
  coordinates: [[195,75], [225,75], [225,105]]
}
```

Point, MultiPoint, LineString, MultiLineString, Polygon and MultiPolygon follow familiar GeoJSON **shapes**, but these are deliberately **not RFC 7946 GeoJSON**, not longitude/latitude, and must not be passed to a WGS84 renderer as such. Polygon rings must be closed. An explicit future georeferencing decision and coordinate transformation are required before exporting proper Earth GeoJSON. `earthAnchor` is therefore `null`.

Only index cells have assigned polygon geometry. No coastline, regional outline, city footprint, mountain position, river course or infrastructure alignment has been fabricated. The grid's region cells indicate indexing/climate coverage, not administrative or natural boundaries. The mountain backbone can cross cells independently of their environmental label. Nominal land area is 115,000 km²; **do not sum land-classified cell squares to derive it**.

Aurelia lists I10/J10 as primary cells, with possible neighboring extension explicitly documented. Districts and landmarks belong to its stable city ID, but have no invented placements or district-to-landmark assignments. Other cities and physical features are contained by the country until more precise containment is established. Four unnamed river systems and one unnamed ~800 m waterfall are intentional placeholders required by the brief, not invented names.

## Canon and editable names

The broad physical structure is fixed: South Pacific setting, nominal dimensions, W/SW prevailing weather, NW–SE Great Range, alpine/glacial backbone and wet-west/dry-east logic. Country/region `properties.physicalStatus` records that independently from editable object names. A name change never authorizes a physical rewrite; those changes require an explicit world revision. The broad coastline is fixed in intent, but no exact vector geometry has been supplied.

All supplied working place names use `canonical_editable`. The five infrastructure proposals use `concept`, as does reserved AUR-LMK-012. Concept objects are excluded from default visibility queries. Earth and grid indexing are `fixed`.

## Source decisions and unresolved items

Source: owner's attached world brief and reference map, received 24 September 2026. Text controls initial data; the map remains a visual concept reference and is not traced/georeferenced.

1. **P classification resolved:** the owner's clarification defines all 11 P cells as Northern Plateau. `SOURCE-001` remains as a resolved provenance record. No grid positions were changed.
2. **Population allocation pending:** the original 12 regional figures total **12,100,000**, matching the approximate national figure of **12.1 million**. Northern Plateau's count is unknown; the 13-region distribution needs future reconciliation. The automated test verifies the original known estimates without treating unknown population as zero. City figures are subsets of regional populations.
3. **Image/text differences:** some labels and city/grid positions differ. The image includes additional settlements not requested for this seed; they are not silently made canonical. The brief's Aurelia cells take precedence pending revision. An island centroid, exact coastline and latitude/longitude remain unassigned.
4. **Placeholder geometry:** null means unknown, not a zero-coordinate point. Do not fill gaps with randomly generated geography.
5. Names and physical attributes can have different stability: editorial renaming is routine; broad physical changes require an explicit versioned revision.

All source issues are also machine-readable in `world.issues`.

## Adding or revising content

1. Allocate a new stable ID within the relevant namespace; keep existing IDs unchanged, even after renaming. Never infer identity from `name`.
2. Add the record to the corresponding seed group. Provide the complete envelope, or use the seed constructor. Use `concept` for unapproved proposals and `null`/empty fields for unknown facts.
3. Set a real containment parent, valid cell IDs when known, and semantic visibility bounds. Cross-object relationships go in `relations`, not unvalidated name strings in properties.
4. Add local geometry only when explicitly designed; do not use grid cell coverage as a feature boundary.
5. For a new object type, extend `WORLD_TYPES`, document its properties and add validation/tests. Add field-specific property validation when introducing operational consumers.
6. For revised canon, retain the old version file and add a new versioned dataset plus revision notes. Update the public export deliberately. `schemaVersion` changes for incompatible model changes; `datasetVersion` changes for canon revisions.
7. Run `pnpm test`, `pnpm lint` and `pnpm build`. The module also validates immediately on import, so a broken dataset fails before a future map can consume it.

The validator checks duplicate IDs, root/parent/relation/grid references, containment cycles, type/status/zoom contracts, grid coverage and geometry structure. It does not claim geographic realism, self-intersection detection, demographic accounting or climatological simulation.
