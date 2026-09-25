# PELOTONIA DEEP WORLD EXPANSION V1.2

> Codex implementation brief. Extend World 1.0 + Complete World Spec V1.1. Reconcile existing IDs; never duplicate them. Names are working `canonical_editable` names unless marked `concept`. No cycling content.

## Rules
- Keep the 16×12 A–P/1–12 grid, 13 physical regions, nine major cities and existing Aurelia IDs.
- Grid cells index data; they never form hard geographic borders.
- L1 nation → L2 grid/region → L3 local/district → L4 site/landmark.
- Every new object needs stable ID, name, status, type, parent, grid cells, geometry, min zoom and properties.
- Rivers, roads, rail, ranges, urban footprints and infrastructure must be continuous across cells.
- Sparse wilderness remains sparse. Do not manufacture POIs merely to equalize grids.

## National networks
- **Crownway / Crown Main Line:** Northwatch → Rivermere → Valedor → Aurelia → Southport.
- **Emerald Highway / Emerald Line:** Westhaven → Greenfall → Aurelia.
- **Eastern Way / Eastern Main:** Valedor → Kaen → Redlands → southeastern mainland.
- **Caldera Road / Ember Line:** Valedor → Ember → Kaen.
- Preserve existing concepts **Pelotonia Link**, **Great Range Base Tunnel**, **Crown Dam**, **Aurelia International Airport**, **Westhaven Deepwater Port**.


# Aurelia complete deep zoom
Aurelia (~2.45m metro) remains primarily I10/J10 around the Great River estuary.

- **AUR-01 Old Aurelia:** Cathedral Hill; Founders Square; Mercer Lane; Old Market; Citadel Hill; Verdan Quays; Cathedral Gardens; Museum Row; St. Oran Bridge; Lantern Court.
- **AUR-02 Crown District:** Crown Avenue; Assembly Square; Ministry Gardens; High Court Terrace; Embassy Row; Crown Gate Station.
- **AUR-03 Central Aurelia:** Aurelia Exchange; Glass Quarter; Central Cross; Station Ward; Riverline; Civic Arcade.
- **AUR-04 Grand Harbour:** King's Basin; New Quays; Pier Nine; Harbour Market; Breakwater Park; Mariner's Point.
- **AUR-05 Eastbank:** Eastbank Centre; Willow Ward; Bellwater; Eastbank Commons; Orchard Road; New Ferry.
- **AUR-06 Westbank:** Westbank Terraces; St. Mara; Greybridge; Cedar Park; Westgate; Old Tram Depot.
- **AUR-07 University Quarter:** University Green; Scholar's Row; Aurel Medical Centre; Science Gardens; College Wharf; Observatory Hill.
- **AUR-08 South Shore:** South Shore Beach; Azure Promenade; Marina Point; White Dunes Park; Bay Gardens; South Shore Pavilion.
- **AUR-09 Ironworks:** Old Furnaces; Foundry Basin; Forge Quarter; Ironworks Yard; South Freight Terminal; Black Crane.
- **AUR-10 North Gardens:** Grand Arboretum; North Gardens Village; Crown Lake; Embassy Woods; Garden Crescent.
- **AUR-11 Rivergate:** Rivergate Terminal; Great River Locks; Merchants' Wharf; Three Bridges; Floodplain Park; Rivergate Market.
- **AUR-12 Heights:** Aurelia Heights; Eagle View; Stone Steps; North Ridge Park; Summit Reservoir.
- **AUR-13 Airport Coast:** Aurelia International Airport; Skyport; Freight Coast; Runway Lagoon; East Terminal; Aviation Park.
- **AUR-14 Outer Aurelia:** Bellford; Maren; Eastmere; Cedar Vale; Bayfield; Crown Junction.

## AUR-LMK-001 Great Cathedral of Aurelia
Preserve existing dimensions. L4 children: Grand Cathedral Plaza; West Towers; Great Nave; Central Spire; North Cloister; Cathedral Gardens; Chapter House; Cathedral Library; South Terrace; River Steps.


# Other major cities

## Valedor — ~1.18m
**Districts:** Old Valedor; Grand Bend; East Meadows; West Locks; University Fields; Crown Island; Northgate; Southbank; Outer Vale.

**Landmarks:** Great River Hall; Valedor Central Station; Crown Island Bridge; River Conservatory; Great Locks; Plains Museum; Valedor University; Meadow Park.


## Westhaven — ~760k
**Districts:** Old Harbour; Deepwater; Rainwall; West Cliff; Mossbank; Upper Haven; Shipyards; Cloudgate.

**Landmarks:** Westhaven Deepwater Port; Stormbreak Lighthouse; Rainwall Viaduct; Pacific Market; Cloudgate Tunnel Portal; West Cliff Gardens; Maritime Museum.


## Rivermere — ~620k
**Districts:** Old Mere; Lakefront; River Ward; Pine Heights; North Docks; University Shore; Verdan Gardens; Southgate.

**Landmarks:** Verdan Lake Pier; Great Lake Station; Verdan Botanical Gardens; Northwater Museum; Lake Bridge; Rivermere University.


## Kaen — ~510k
**Districts:** Old Kaen; Copper Quarter; East Fields; Reservoir Ward; Windgate; Dry River; South Works; Plateau Heights.

**Landmarks:** Kaen Reservoir; Windgate Station; Steppe Hall; Copper Market; Great Wind Park; Eastern Observatory.


## Greenfall — ~390k
**Districts:** Harbour; Falls Quarter; Canopy; Old Greenfall; River Mouth; Upper Falls; Fernbank.

**Landmarks:** Greenfall Cascades; Canopy Gardens; Rainforest Museum; Greenfall Harbour; Upper Falls Funicular; Fern Bridge.


## Northwatch — ~310k
**Districts:** Watch Hill; Old Northwatch; Pinegate; Lake Ward; Moorbank; North Station; Crown Heights.

**Landmarks:** Northwatch Tower; Crown Main Station; Highland Hall; Pine Lake Park; Storm Observatory.


## Southport — ~280k
**Districts:** Old Port; South Bay; Garden Ward; Lighthouse Point; River Mouth; New Harbour.

**Landmarks:** Southport Lighthouse; Garden Promenade; Southern Maritime Hall; Bay Station; Old Harbour Market.


## Ember — ~220k
**Districts:** Old Ember; Caldera Gate; Steam Quarter; Blackstone; Lake Ward; Ashfield; Observatory Heights.

**Landmarks:** Caldera Gate; Ember Geothermal Station; Blackstone Baths; Volcanic Institute; Caldera Lake Pier; Ember Observatory.


# Major natural deep-zoom systems

## Great Range / Aurelia Massif
**Aurelia Icefield:** Crown Glacier; Aurel Glacier; White River Glacier; Serac Basin; North Crown Snowfield; South Col Icefall.
**Mount Aurelia:** North Face; Summit Ridge; South Col; Black Needle; Crown Bowl; High Aurel Valley; Crown Observatory; Aurelia Base Station.
**Frostpeak:** Frost Glacier; Mirror Tarn; East Couloir; Frostpass; Silver Ridge.
**White Crown:** West Crown; Central Crown; East Crown; Crown Pass; White Crown Glacier.
Other named places: Greywall Valley; High Crown Pass; Aurel Gate; Serac Valley; Blackwater Gorge; Mirror Valley; Three Lakes Basin; Southwatch Pass.
Settlements: Crown Village (~2.4k); Aurel Gate (~1.1k); Greywall (~3.6k); Southwatch (~1.8k); Serac Camp (<500).

## Great Caldera / Volcanic Basin
Great Caldera Lake children: North Rim; Black Rim; Ember Rim; Collapsed East Gate; Blue Depths; Steam Shore; Obsidian Peninsula; Ash Islands.
Geothermal sites: Steam Valley; White Terraces; Sulphur Springs; Black Geyser Field; Cinder Pools; Glass Plain.
Additional cones: Mount Cinder; Ash Crown; Little Nyx. Protected area: Caldera National Reserve.

## Red Canyon / Redlands
Main sectors: Upper Red Canyon; Cathedral Gorge; Copper Narrows; Great Bend; Scarlet Walls; Lower Canyon.
Landforms: Seven Mesas; Salt Mirror; Dust Basin; Sun Arch; Black Wash; Dry Cathedral; Copper Steps.
Settlements: Redgate (~21k); Saltwell (~8k); Mesa Crossing (~4k); Dusthaven (~2k).
Protected area: Red Canyon National Reserve.

## Emerald Coast / waterfall country
Crownfall (~800 m) remains signature fall.
Other systems: Seven Veils Falls; Cloudfall; Moss Gorge; Rainwall Falls; Fern Cascade; Green Stair.
Protected landscapes: Emerald Crown Reserve; Mosswood; Cloud Forest; Rain Gorge.
Coastal places: Stormglass Bay; Fern Point; Rainhaven; Moss Harbour.

## Southern Fjords
Major fjords: Greyfjord; Deepfjord; Southwatch Sound; Tern Fjord; Icewater Reach; Seal Sound.
Glaciers: Southwatch Glacier; Grey Ice; Tern Glacier.
Settlements: Greyhaven; Ternvik; Deepwater; Sealholm.
Landmarks: Black Cliffs; Mist Gate; Southwatch Falls; Needle Island.

## Southeastern Islands
**Mara Island** (~1,000 km²): Maravista (~190k), Mara Crown, Azure Lagoon, West Reef, South Head.
**Tern Island** (~600 km²): Ternport (~110k), High Tern, White Bay, Tern Forest.
**Beacon Island** (~320 km²): Beacon City (~65k), Beacon Hill, Coral Sound, East Light.
Secondary islands: Pelican Key; Coral Cay; Long Isle; Twin Islands; Reefholm; South Key.
Pelotonia Link preferred concept alignment: southeastern mainland → Mara approach → midpoint/artificial-island option → Tern/Beacon corridor; total fixed-link system 35–45 km. At L1 one national line; L2 named bridge/tunnel sections; L3 junctions/service islands; L4 individual engineering structures.


# Complete 192-grid L2/L3 dossier index
These entries supplement V1.1. Codex should create stable IDs for newly introduced local objects and connect repeated/adjacent systems rather than treating each label as isolated.

## A1 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B1 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## C1 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## D1 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Rook Point, Breaker Bay, Greywatch, Ternholm, Galehaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E1 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Breaker Bay, Greywatch, Ternholm, Galehaven, Rook Point. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F1 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Heatherdale, Silverbrook, Pinemere, Frostvale, Ravenford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G1 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Silverbrook, Pinemere, Frostvale, Ravenford, Heatherdale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H1 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Pinemere, Frostvale, Ravenford, Heatherdale, Silverbrook. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I1 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Frostvale, Ravenford, Heatherdale, Silverbrook, Pinemere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J1 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Ravenford, Heatherdale, Silverbrook, Pinemere, Frostvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K1 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## L1 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## M1 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## N1 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## O1 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## P1 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A2 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B2 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## C2 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Greywatch, Ternholm, Galehaven, Rook Point, Breaker Bay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D2 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Ternholm, Galehaven, Rook Point, Breaker Bay, Greywatch. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Pinemere, Frostvale, Ravenford, Heatherdale, Silverbrook. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Frostvale, Ravenford, Heatherdale, Silverbrook, Pinemere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Ravenford, Heatherdale, Silverbrook, Pinemere, Frostvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Heatherdale, Silverbrook, Pinemere, Frostvale, Ravenford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Silverbrook, Pinemere, Frostvale, Ravenford, Heatherdale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Pinemere, Frostvale, Ravenford, Heatherdale, Silverbrook. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K2 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Frostvale, Ravenford, Heatherdale, Silverbrook, Pinemere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L2 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Windmere, Kaelor Vale, Longridge, Stoneheath, Larkcross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M2 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Kaelor Vale, Longridge, Stoneheath, Larkcross, Windmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N2 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## O2 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## P2 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A3 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B3 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Galehaven, Rook Point, Breaker Bay, Greywatch, Ternholm. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C3 — Stormlands
**Landscape:** wind-scoured moor and sea cliffs. **Working named places:** Rook Point, Breaker Bay, Greywatch, Ternholm, Galehaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D3 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Ravenford, Heatherdale, Silverbrook, Pinemere, Frostvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E3 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Heatherdale, Silverbrook, Pinemere, Frostvale, Ravenford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F3 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Silverbrook, Pinemere, Frostvale, Ravenford, Heatherdale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G3 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Greywall, Serac Valley, Crown Pass, Aurel Gate, Black Needle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H3 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Serac Valley, Crown Pass, Aurel Gate, Black Needle, Greywall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I3 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Crown Pass, Aurel Gate, Black Needle, Greywall, Serac Valley. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J3 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Heatherdale, Silverbrook, Pinemere, Frostvale, Ravenford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K3 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Silverbrook, Pinemere, Frostvale, Ravenford, Heatherdale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L3 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Stoneheath, Larkcross, Windmere, Kaelor Vale, Longridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M3 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Larkcross, Windmere, Kaelor Vale, Longridge, Stoneheath. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N3 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Windmere, Kaelor Vale, Longridge, Stoneheath, Larkcross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O3 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Kaelor Vale, Longridge, Stoneheath, Larkcross, Windmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P3 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A4 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B4 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Mossreach, Rainfall, Mistbay, Fernhaven, Cloudglen. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C4 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Rainfall, Mistbay, Fernhaven, Cloudglen, Mossreach. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D4 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Pinemere, Frostvale, Ravenford, Heatherdale, Silverbrook. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E4 — Northern Highlands
**Landscape:** cool wooded uplands and lake valleys. **Working named places:** Frostvale, Ravenford, Heatherdale, Silverbrook, Pinemere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F4 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Crown Pass, Aurel Gate, Black Needle, Greywall, Serac Valley. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G4 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Aurel Gate, Black Needle, Greywall, Serac Valley, Crown Pass. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H4 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Black Needle, Greywall, Serac Valley, Crown Pass, Aurel Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I4 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Greywall, Serac Valley, Crown Pass, Aurel Gate, Black Needle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J4 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Larkcross, Windmere, Kaelor Vale, Longridge, Stoneheath. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K4 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Windmere, Kaelor Vale, Longridge, Stoneheath, Larkcross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L4 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Kaelor Vale, Longridge, Stoneheath, Larkcross, Windmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M4 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Longridge, Stoneheath, Larkcross, Windmere, Kaelor Vale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N4 — Northern Plateau
**Landscape:** open heath/grassland and broad ridges. **Working named places:** Stoneheath, Larkcross, Windmere, Kaelor Vale, Longridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O4 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## P4 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A5 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B5 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Fernhaven, Cloudglen, Mossreach, Rainfall, Mistbay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C5 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Cloudglen, Mossreach, Rainfall, Mistbay, Fernhaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D5 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Mossreach, Rainfall, Mistbay, Fernhaven, Cloudglen. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E5 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Black Needle, Greywall, Serac Valley, Crown Pass, Aurel Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F5 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Greywall, Serac Valley, Crown Pass, Aurel Gate, Black Needle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G5 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Serac Valley, Crown Pass, Aurel Gate, Black Needle, Greywall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H5 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Crown Pass, Aurel Gate, Black Needle, Greywall, Serac Valley. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I5 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Rivercross, Meadowbridge, Willowford, Bellmere, Goldenfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J5 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Meadowbridge, Willowford, Bellmere, Goldenfield, Rivercross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K5 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Willowford, Bellmere, Goldenfield, Rivercross, Meadowbridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L5 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Steamvale, Ashfield, Obsidian Gate, Cinder Lake, Blackstone. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M5 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Ashfield, Obsidian Gate, Cinder Lake, Blackstone, Steamvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N5 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Larkrun, Sunvale, Amberfield, Sagecross, Copper Ridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O5 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## P5 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A6 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B6 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Rainfall, Mistbay, Fernhaven, Cloudglen, Mossreach. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C6 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Mistbay, Fernhaven, Cloudglen, Mossreach, Rainfall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D6 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Fernhaven, Cloudglen, Mossreach, Rainfall, Mistbay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E6 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Crown Pass, Aurel Gate, Black Needle, Greywall, Serac Valley. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F6 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Aurel Gate, Black Needle, Greywall, Serac Valley, Crown Pass. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G6 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Black Needle, Greywall, Serac Valley, Crown Pass, Aurel Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H6 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Willowford, Bellmere, Goldenfield, Rivercross, Meadowbridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I6 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Bellmere, Goldenfield, Rivercross, Meadowbridge, Willowford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J6 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Goldenfield, Rivercross, Meadowbridge, Willowford, Bellmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K6 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Obsidian Gate, Cinder Lake, Blackstone, Steamvale, Ashfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L6 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Cinder Lake, Blackstone, Steamvale, Ashfield, Obsidian Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M6 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Amberfield, Sagecross, Copper Ridge, Larkrun, Sunvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N6 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Sagecross, Copper Ridge, Larkrun, Sunvale, Amberfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O6 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Copper Ridge, Larkrun, Sunvale, Amberfield, Sagecross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P6 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A7 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B7 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Cloudglen, Mossreach, Rainfall, Mistbay, Fernhaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C7 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Mossreach, Rainfall, Mistbay, Fernhaven, Cloudglen. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D7 — Rainforest Belt
**Landscape:** warm rainforest and wetlands. **Working named places:** Verdant Pool, Jadegrove, Canopy Vale, Mara Creek, Orchid Bay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E7 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Greywall, Serac Valley, Crown Pass, Aurel Gate, Black Needle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F7 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Serac Valley, Crown Pass, Aurel Gate, Black Needle, Greywall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G7 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Goldenfield, Rivercross, Meadowbridge, Willowford, Bellmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H7 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Rivercross, Meadowbridge, Willowford, Bellmere, Goldenfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I7 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Meadowbridge, Willowford, Bellmere, Goldenfield, Rivercross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J7 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Willowford, Bellmere, Goldenfield, Rivercross, Meadowbridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K7 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Steamvale, Ashfield, Obsidian Gate, Cinder Lake, Blackstone. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L7 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Copper Ridge, Larkrun, Sunvale, Amberfield, Sagecross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M7 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Larkrun, Sunvale, Amberfield, Sagecross, Copper Ridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N7 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Sunvale, Amberfield, Sagecross, Copper Ridge, Larkrun. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O7 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Amberfield, Sagecross, Copper Ridge, Larkrun, Sunvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P7 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A8 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B8 — Emerald Coast
**Landscape:** steep rainforest coast and gorges. **Working named places:** Mistbay, Fernhaven, Cloudglen, Mossreach, Rainfall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C8 — Rainforest Belt
**Landscape:** warm rainforest and wetlands. **Working named places:** Canopy Vale, Mara Creek, Orchid Bay, Verdant Pool, Jadegrove. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D8 — Rainforest Belt
**Landscape:** warm rainforest and wetlands. **Working named places:** Mara Creek, Orchid Bay, Verdant Pool, Jadegrove, Canopy Vale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E8 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Aurel Gate, Black Needle, Greywall, Serac Valley, Crown Pass. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F8 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Meadowbridge, Willowford, Bellmere, Goldenfield, Rivercross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G8 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Willowford, Bellmere, Goldenfield, Rivercross, Meadowbridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H8 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Bellmere, Goldenfield, Rivercross, Meadowbridge, Willowford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I8 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Goldenfield, Rivercross, Meadowbridge, Willowford, Bellmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J8 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Obsidian Gate, Cinder Lake, Blackstone, Steamvale, Ashfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K8 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Cinder Lake, Blackstone, Steamvale, Ashfield, Obsidian Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L8 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Amberfield, Sagecross, Copper Ridge, Larkrun, Sunvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M8 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Sagecross, Copper Ridge, Larkrun, Sunvale, Amberfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N8 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Red Gate, Dustwell, Scarlet Canyon, Saltwash, Copper Mesa. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O8 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Dustwell, Scarlet Canyon, Saltwash, Copper Mesa, Red Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P8 — Ocean
**Character:** marine shelf/basin. **Named features:** South Passage, Outer Bank. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## A9 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B9 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Grey Reach, Ternvik, Deepfjord, Mist Sound, Sealholm. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C9 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Ternvik, Deepfjord, Mist Sound, Sealholm, Grey Reach. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D9 — Rainforest Belt
**Landscape:** warm rainforest and wetlands. **Working named places:** Jadegrove, Canopy Vale, Mara Creek, Orchid Bay, Verdant Pool. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E9 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Serac Valley, Crown Pass, Aurel Gate, Black Needle, Greywall. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F9 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Goldenfield, Rivercross, Meadowbridge, Willowford, Bellmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G9 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Rivercross, Meadowbridge, Willowford, Bellmere, Goldenfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H9 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Meadowbridge, Willowford, Bellmere, Goldenfield, Rivercross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I9 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Willowford, Bellmere, Goldenfield, Rivercross, Meadowbridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J9 — Volcanic Basin
**Landscape:** lava plateau and geothermal valleys. **Working named places:** Steamvale, Ashfield, Obsidian Gate, Cinder Lake, Blackstone. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K9 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Copper Ridge, Larkrun, Sunvale, Amberfield, Sagecross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L9 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Larkrun, Sunvale, Amberfield, Sagecross, Copper Ridge. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M9 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Scarlet Canyon, Saltwash, Copper Mesa, Red Gate, Dustwell. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N9 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Saltwash, Copper Mesa, Red Gate, Dustwell, Scarlet Canyon. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O9 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Copper Mesa, Red Gate, Dustwell, Scarlet Canyon, Saltwash. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P9 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Azure Bay, Beacon Holm, Coral Point, Mara Isle, Tern Key. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## A10 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B10 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Mist Sound, Sealholm, Grey Reach, Ternvik, Deepfjord. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C10 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Sealholm, Grey Reach, Ternvik, Deepfjord, Mist Sound. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D10 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Grey Reach, Ternvik, Deepfjord, Mist Sound, Sealholm. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E10 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Black Needle, Greywall, Serac Valley, Crown Pass, Aurel Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F10 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Greywall, Serac Valley, Crown Pass, Aurel Gate, Black Needle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G10 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Bellmere, Goldenfield, Rivercross, Meadowbridge, Willowford. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H10 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Goldenfield, Rivercross, Meadowbridge, Willowford, Bellmere. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I10 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Rivercross, Meadowbridge, Willowford, Bellmere, Goldenfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J10 — Central Plains
**Landscape:** fertile river plain and wetlands. **Working named places:** Meadowbridge, Willowford, Bellmere, Goldenfield, Rivercross. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K10 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Amberfield, Sagecross, Copper Ridge, Larkrun, Sunvale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L10 — Eastern Steppe
**Landscape:** dry grassland and escarpments. **Working named places:** Sagecross, Copper Ridge, Larkrun, Sunvale, Amberfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M10 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Red Gate, Dustwell, Scarlet Canyon, Saltwash, Copper Mesa. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N10 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Dustwell, Scarlet Canyon, Saltwash, Copper Mesa, Red Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O10 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Scarlet Canyon, Saltwash, Copper Mesa, Red Gate, Dustwell. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P10 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Mara Isle, Tern Key, Azure Bay, Beacon Holm, Coral Point. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## A11 — Ocean
**Character:** marine shelf/basin. **Named features:** Tern Shoal, South Passage. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B11 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Ternvik, Deepfjord, Mist Sound, Sealholm, Grey Reach. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## C11 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Deepfjord, Mist Sound, Sealholm, Grey Reach, Ternvik. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D11 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Mist Sound, Sealholm, Grey Reach, Ternvik, Deepfjord. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E11 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Sealholm, Grey Reach, Ternvik, Deepfjord, Mist Sound. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## F11 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Aurel Gate, Black Needle, Greywall, Serac Valley, Crown Pass. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## G11 — Great Range
**Landscape:** alpine/glacial relief. **Working named places:** Black Needle, Greywall, Serac Valley, Crown Pass, Aurel Gate. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H11 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Bayfield, Olivehaven, Garden Shore, Brightport, Cedar Vale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I11 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Olivehaven, Garden Shore, Brightport, Cedar Vale, Bayfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J11 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Garden Shore, Brightport, Cedar Vale, Bayfield, Olivehaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K11 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Brightport, Cedar Vale, Bayfield, Olivehaven, Garden Shore. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L11 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Scarlet Canyon, Saltwash, Copper Mesa, Red Gate, Dustwell. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M11 — Redlands
**Landscape:** hot mesas, salt flats and canyon country. **Working named places:** Saltwash, Copper Mesa, Red Gate, Dustwell, Scarlet Canyon. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N11 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Tern Key, Azure Bay, Beacon Holm, Coral Point, Mara Isle. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O11 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Azure Bay, Beacon Holm, Coral Point, Mara Isle, Tern Key. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P11 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Beacon Holm, Coral Point, Mara Isle, Tern Key, Azure Bay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## A12 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## B12 — Ocean
**Character:** marine shelf/basin. **Named features:** Pacific Rise, Tern Shoal. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## C12 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Grey Reach, Ternvik, Deepfjord, Mist Sound, Sealholm. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## D12 — Southern Fjords
**Landscape:** deep fjords and wet mountains. **Working named places:** Ternvik, Deepfjord, Mist Sound, Sealholm, Grey Reach. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## E12 — Ocean
**Character:** marine shelf/basin. **Named features:** Outer Bank, Blue Trench. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## F12 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

## G12 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Garden Shore, Brightport, Cedar Vale, Bayfield, Olivehaven. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## H12 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Brightport, Cedar Vale, Bayfield, Olivehaven, Garden Shore. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## I12 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Cedar Vale, Bayfield, Olivehaven, Garden Shore, Brightport. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## J12 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Bayfield, Olivehaven, Garden Shore, Brightport, Cedar Vale. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## K12 — Southern Coast
**Landscape:** mild estuaries, farmland and beaches. **Working named places:** Olivehaven, Garden Shore, Brightport, Cedar Vale, Bayfield. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## L12 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Azure Bay, Beacon Holm, Coral Point, Mara Isle, Tern Key. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## M12 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Beacon Holm, Coral Point, Mara Isle, Tern Key, Azure Bay. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## N12 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Coral Point, Mara Isle, Tern Key, Azure Bay, Beacon Holm. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## O12 — Southeastern Islands
**Landscape:** rugged maritime islands, reefs and channels. **Working named places:** Mara Isle, Tern Key, Azure Bay, Beacon Holm, Coral Point. **L3 requirement:** resolve these into a context-appropriate mix of settlement + natural feature + local landmark/infrastructure, respecting V1.1 objects already in this cell. **Continuity:** all water/transport/range features must connect coherently to neighboring cells. **L4:** at least one distinctive site where justified; wilderness cells may have none.

## P12 — Ocean
**Character:** marine shelf/basin. **Named features:** Blue Trench, Pacific Rise. **Zoom:** intentionally sparse; expose reef/islet/navigation/research details only where geometry supports them.

# Implementation / definition of done
1. Merge this expansion into the existing versioned world-data architecture.
2. Preserve/reconcile all V1.0/V1.1 stable IDs.
3. Assign stable IDs to every new named object.
4. Build parent/child relationships for cities, districts, natural systems and L4 sites.
5. Add geometry placeholders only when exact geometry is unresolved; never invent fake WGS84 coordinates.
6. Ensure national transport and hydrology are continuous.
7. Keep names editable independently of IDs.
8. Update atlas progressive-disclosure data so L1/L2/L3/L4 visibility is data-driven.
9. Run schema validation, all world tests, lint and production build.
10. Report collisions/reconciliations instead of silently duplicating.
11. Do not add cycling-specific world objects.
12. Do not invent historical lore.
