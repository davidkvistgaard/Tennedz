# PELOTONIA VISUAL GEOGRAPHY SPECIFICATION V1.6

> Codex implementation brief. This extends World 1.0 and expansions V1.1–V1.5. It defines how canonical world data should LOOK in the interactive atlas. Reconcile existing IDs and world facts; do not create parallel geography. No cycling-specific content.

## 1. Core visual principle

Pelotonia should look like a premium illustrated/topographic game atlas: geographically legible, atmospheric and inviting to explore. It is not Google Maps, not a GIS dashboard and not a fantasy parchment map.

The atlas must render from structured world data. Visual layers are representations of canonical geography, never separate truth.

### Persistent visual language
- deep blue ocean with visible coastal shelf/bathymetric transition;
- shaded-relief terrain;
- natural green forest cover rather than uniform green land;
- pale alpine rock and white snow/ice;
- ochre/red arid terrain;
- distinct dark volcanic terrain;
- visible rivers, lakes, wetlands and estuaries;
- restrained roads/rail at appropriate zoom;
- urban footprints that reflect settlement density;
- labels progressively disclosed by importance;
- no permanent visible square-grid aesthetic in normal play.

## 2. Zoom rendering hierarchy

### L0 — Earth
Show Earth context, South Pacific and Pelotonia's position. Pelotonia reads as one island nation, not internal detail.

### L1 — Whole Pelotonia
Show:
- coastline and offshore archipelagos;
- bathymetric shelf;
- Great Range relief and Aurelia Icefield;
- major forests/rainforest;
- Central Plains;
- Great Caldera / Volcanic Basin;
- Eastern Steppe / Redlands;
- Southern Fjords;
- major rivers/lakes;
- nine major cities;
- national-scale infrastructure only;
- region labels when uncluttered.

Do NOT show minor roads, villages, small POIs or grid lines by default.

### L2 — Regional / macro-grid
Reveal:
- secondary cities and towns;
- regional roads and rail;
- secondary rivers/lakes;
- forest boundaries;
- wetlands;
- individual major peaks;
- local islands/reefs;
- dams, major bridges/tunnels;
- protected areas;
- urban footprints;
- regional discovery landmarks.

### L3 — Local
Reveal:
- villages;
- city districts;
- local roads;
- rail stations;
- ferry terminals;
- parks;
- beaches;
- individual bridges;
- reservoirs;
- local natural landmarks;
- harbours;
- detailed terrain transitions;
- selected building footprints for major civic sites.

### L4 — Site
Reveal:
- landmark/site footprint;
- paths/plazas/gardens;
- individual bridge spans/portals;
- dam components;
- cathedral precinct;
- observatory structures;
- geothermal terraces/pools;
- waterfall stages;
- caldera sub-features;
- summit/valley sub-features.

## 3. Region appearance rules

### Stormlands
Palette impression: cold grey-green.
Ground: moor/heath with exposed rock.
Coast: high dark cliffs, stacks, narrow coves.
Trees: sparse/sheltered.
Atmosphere: cloud shadows and strong ocean exposure.
Settlement footprint: compact ports/inlets.
L2 identifiers: cliff lines, moor blocks, lighthouse points, storm roads.

### Northern Highlands
Cool deep green uplands.
Mixed/conifer forest blocks, lakes, rounded ridges and broad valleys.
Winter snow can remain on higher ridges.
Settlement follows valleys and lakes.
Road/rail should visibly funnel through passes and valley floors.

### Northern Plateau
Muted olive/grass/heath.
Broad open ridges, shallow basins, scattered forest and upland lakes.
More exposed and drier than Highlands.
Snow cover seasonal rather than glacial.
Long roads and rail lines can be visually straighter than western terrain.

### Emerald Coast
Pelotonia's wettest visual region.
Very saturated but natural forest green; steep relief reaches ocean.
Dense forest canopy, deep ravines, many white-water streams.
Frequent waterfalls should appear as terrain consequences, not icons sprinkled randomly.
Narrow coastal settlement strips and dramatic engineered roads.

### Rainforest Belt
Warmer, darker broadleaf canopy with wetlands and meandering lower rivers.
More lush/lowland than Emerald Coast.
Use canopy texture, lagoons and swamp/wetland transitions.
Urban areas remain carved into river/coastal clearings rather than covering the forest.

### Great Range
Dominant relief.
Lower slopes: dark montane forest.
Mid slopes: open rock/alpine vegetation.
High slopes: pale rock, snowfields, glaciers.
Aurelia Massif should be visually recognizable at L1.
Glaciers flow through valleys rather than appearing as white blobs.
Mountain roads should visibly respect contour and passes.

### Central Plains
Light natural greens/gold agricultural mosaic.
Broad rivers, floodplains, wetlands, tree belts and low ridges.
Highest density of settlement/infrastructure.
Avoid checkerboard farm texture; fields should follow rivers, roads and terrain.
Great River is a strong visual organizing feature.

### Volcanic Basin
Mixed green/brown/black.
Dark lava fields, cones, caldera rims, geothermal pale mineral zones.
Great Caldera Lake is intense blue but not neon.
Steam effects can be subtle at L3/L4 only.
Vegetation can be surprisingly green on older volcanic soils.

### Eastern Steppe
Dry olive/gold grassland.
Sparse tree cover, long ridges, dry channels.
Great Escarpment must be a clear relief break.
Wind infrastructure appears only at closer zoom.
Settlements cluster around water/transport.

### Redlands
Warm rust/red/ochre terrain with pale salt surfaces.
Mesas, canyon shadows, dry washes and exposed rock.
Very sparse vegetation.
Red Canyon must read as a continuous carved system.
Salt Mirror becomes bright/reflective only seasonally; base map should show salt-flat morphology.

### Southern Fjords
Dark wet greens, grey rock, deep navy/turquoise fjords.
Steep walls, hanging valleys, waterfalls, islands and local glaciers.
Settlements tiny and concentrated at sheltered water.
Road continuity often broken by tunnels/ferries.

### Southern Coast
Mild green/gold lowlands.
Estuaries, beaches, wetlands, orchards/agriculture and rolling hills.
Dense but not metropolitan outside Aurelia/Southport.
White Dunes should visibly contrast with adjacent wetlands/coast.

### Southeastern Islands
Blue-green maritime appearance.
Volcanic/rugged island interiors, reef shallows, lagoons and developed harbours.
Largest islands have real topographic relief.
Small islands remain visually distinct rather than merging into generic dots.

## 4. Water rendering

### Ocean
Use at least three perceived depth bands:
1. coastal shallows / shelf;
2. mid-depth blue;
3. deep Pacific navy.
No artificial contour spaghetti at normal play zoom.

### Rivers
Width derived from hierarchy/discharge.
Great River is visibly broad in Central Plains/Valedor/Aurelia.
Western rivers shorter, steeper and brighter/whiter in gorge sections.
Redlands rivers may show intermittent/dry-channel character.
Tributaries appear progressively with zoom.

### Lakes
Render true basin shape, shoreline wetlands where relevant and visible inflow/outflow at L2/L3.
Glacial lakes: cold blue/turquoise.
Volcanic caldera: deep blue.
Steppe/desert lakes: muted/saline edges.

### Wetlands
Use texture and channel pattern rather than one flat blue-green polygon.

## 5. Elevation and relief

Terrain shading must remain readable beneath land-cover textures.
Recommended conceptual elevation bands:
- 0–200 m lowland;
- 200–600 m rolling/upland;
- 600–1,200 m highland/plateau;
- 1,200–2,000 m mountain;
- 2,000–3,000 m high alpine;
- >3,000 m extreme alpine/glacial.

Do not render hard band boundaries; use continuous relief. Bands drive texture/vegetation/snow logic.

## 6. Snow and ice

Permanent ice is tied to canonical glacier/icefield geometry.
Seasonal snow can be a future dynamic overlay.
At base-map state:
- Aurelia Icefield and major glaciers always visible;
- highest Great Range summits snow-covered;
- Northern Highlands/Plateau do not display permanent broad snow cover;
- Southern Fjord glaciers occupy only suitable high valleys.

Glacier visual children: accumulation basin → icefall → glacier tongue → meltwater.

## 7. Vegetation

Use biome polygons plus elevation/moisture modifiers.
Forest should not stop at grid edges.
Transitions:
- rainforest → montane forest → alpine;
- Central Plains forest fragments along rivers/ridges;
- steppe → scrub → Redlands sparse vegetation;
- Southern Coast agriculture/orchard texture;
- fjords forest only where slope/climate permits.

Protected old-growth sites such as Cathedral Trees should have a visually denser canopy at L3.

## 8. Urban footprints

Population numbers must influence footprint size but geography constrains shape.

### Aurelia
Large continuous metro around estuary/bay, but water, hills, parks and industrial areas break the texture.
Old Aurelia = dense fine-grain core.
Central Aurelia = stronger vertical/CBD footprint.
Outer Aurelia = lower-density polycentric spread.
Airport Coast = runway/logistics geometry.
Grand Harbour/Ironworks = docks/basins/industrial geometry.

### Valedor
Broad inland river metropolis; development on both banks and Crown Island.

### Westhaven
Long/narrow urban footprint trapped between mountain and sea.

### Rivermere
Lake/river-shaped city, not circular sprawl.

### Kaen
Lower-density dry-city footprint organized around water/irrigation and transport.

### Greenfall
Coastal/river-mouth city constrained by rainforest and steep terrain.

### Northwatch
Compact highland valley city.

### Southport
Harbour-shaped southern city.

### Ember
Irregular volcanic-basin city avoiding active/geothermal hazard zones.

Regional cities/towns inherit equivalent geographic constraints.

## 9. Roads

Visual hierarchy:
- L1: national trunks only.
- L2: national + important regional roads.
- L3: local roads/urban arterials.
- L4: site access roads/paths where useful.

Road geometry:
- plains: longer smooth lines;
- mountains: contour-following curves/switchbacks;
- fjords: shoreline/tunnel/ferry discontinuities;
- Redlands: sparse long corridors;
- rainforest: valley/coast-following.

Do not auto-generate dense road meshes across wilderness.

## 10. Rail

Distinct but visually quieter than primary roads.
Show stations only when zoom permits.
Mountain rail must use valleys/tunnels.
Industrial port spurs visible L3.
Aurelia metropolitan rail only L3 except major national terminals.

## 11. Bridges/tunnels/dams

At L1 only Pelotonia Link / nationally exceptional structures may be visible.
At L2 use clear but restrained structure symbols/geometry.
At L3/L4 render approaches and physical footprint.

Pelotonia Link must visually cross actual water and connect actual island/mainland road/rail geometry.
Crown Dam must visibly block the Great River and create Crown Reservoir.
Tunnel portals must intersect their carried route.

## 12. Labels

Priority:
1. PELOTONIA / ocean;
2. major regions and nine major cities;
3. major physical features;
4. secondary cities;
5. towns / local features;
6. L3/L4 objects.

Labels should fade/appear by zoom and collision priority.
Do not rotate every label with geometry; preserve readability.
No slogans or decorative prose on atlas imagery.

## 13. Icons

Use icons sparingly.
At L1: capital, major cities, major national infrastructure.
L2: secondary city, airport, port, major landmark.
L3: station, ferry, dam, lighthouse, park, selected POIs.
L4: site-specific components.

Natural features should preferably be communicated by actual map geometry/terrain rather than excessive icons.

## 14. Grid visualization

The A–P / 1–12 grid is primarily internal.
Normal atlas: grid invisible.
Optional developer/debug overlay: thin grid lines + cell IDs.
Optional user feature later: subtle grid selection/highlight when a macro area is selected.
Never permanently tile-shade Pelotonia by grid class.

## 15. Seasonal/dynamic-ready layers

Architecture should allow future overlays without requiring them now:
- seasonal snow;
- current weather;
- rainfall/storms;
- wildfire/drought;
- flood state;
- vegetation season;
- road closure;
- eventually cycling events.

Base geography remains stable beneath dynamic overlays.

## 16. Visual state examples

### L1 Pelotonia
Immediate read: wet green west → huge white/grey central range → fertile central belt → dry gold/red east/southeast; fjorded southwest; island chain southeast. Aurelia visible as dominant southern metro. Great Caldera, Lake Verdan, Great River, Aurelia Icefield and Red Canyon recognizable without labels doing all the work.

### L2 I10/J10 Aurelia
Estuary/bay geometry, urban footprint, river channels, major districts, harbour basins, airport, Crownway/rail approaches, surrounding hills and coast.

### L3 Old Aurelia
Dense historic street/block texture, Cathedral Hill, Founders Square, Verdan Quays, Old Market, Citadel Hill, Museum Row, St. Oran Bridge and major green spaces.

### L4 Great Cathedral
Cathedral footprint, Grand Cathedral Plaza, West Towers, Great Nave, Central Spire footprint, North Cloister, Chapter House, Library, Cathedral Gardens, South Terrace and River Steps.

### L2 Great Caldera
Full rim, lake, breached east wall, Ember urban footprint, volcanic cones, geothermal fields and access routes.

### L3 Crownfall
Upper catchment, multi-stage fall, gorge, rainforest, viewing/access infrastructure and downstream river.

## 17. Performance / rendering architecture requirements

Codex should choose implementation appropriate to current project, but:
- geometry/data must remain separate from presentation;
- use vector layers where useful for roads/water/boundaries/labels;
- use terrain/land-cover rendering that can scale smoothly;
- avoid one giant raster image as the only map source;
- allow selective loading by zoom/bounds;
- atlas must remain responsive on desktop and mobile;
- progressive disclosure must be data-driven;
- visual fallback must remain useful if an advanced rendering layer fails.

## 18. Acceptance tests

Visual/data tests should verify:
- no permanent grid seams in forest/water/terrain;
- rivers align across cells;
- roads/rail align across cells;
- urban footprints do not extend implausibly into ocean/glacier/extreme slopes;
- glaciers occupy valid high terrain;
- Redlands does not render lush;
- Emerald Coast does not render arid;
- Great Caldera lake stays inside caldera geometry;
- Crown Dam/reservoir intersect Great River correctly;
- Pelotonia Link connects land endpoints;
- label priority changes with zoom;
- L3/L4 objects do not clutter L1;
- debug grid can be toggled independently of normal atlas.

## 19. Definition of done

1. Region-specific visual rules are represented in the atlas rendering/data style layer.
2. Whole-island L1 visually communicates Pelotonia's climate/topographic diversity.
3. L2 reveals meaningful regional texture and secondary networks.
4. L3/L4 reveal local/site detail from existing world data.
5. Aurelia, Great Cathedral, Great Caldera, Crownfall, Red Canyon, Great Range and Southeastern Islands each demonstrate correct progressive visual detail.
6. No map layer becomes a second source of truth separate from world data.
7. Existing V1.0–V1.5 objects are reconciled.
8. Relevant visual/data validation, tests, lint and production build pass.
9. No cycling-specific world content or historical lore is introduced.
