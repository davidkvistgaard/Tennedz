# PELOTONIA LOCAL DETAIL EXPANSION V1.4

> Codex implementation brief. Extend World 1.0 + V1.1 + V1.2 + V1.3. Reconcile existing IDs and names; never duplicate. No cycling-specific content.

## Purpose
Turn the discovery layer into real zoomable places. This package gives the 24 regional cities full L3 structure, selected towns compact L3 structure, and the strongest natural/engineered discoveries explicit L4 children.

## Rules
- Regional cities get 3–6 districts and 3–6 anchors; they must remain smaller and simpler than Aurelia.
- Towns get a centre plus 2–4 context-specific local places; do not over-urbanise them.
- L4 sub-sites are reserved for distinctive natural/engineered landmarks.
- Existing names from earlier versions take precedence; reconcile rather than duplicate.
- Do not invent historical lore. Names are working references.
- Geometry and continuity must follow the established physical world.

# 1. Regional cities — complete L3 structure
## RC-001 Greywatch
**Region:** Stormlands.
**Districts / local areas:** Old Inlet, Watch Hill, Breakwater, Moor Ward, North Quay.
**Landmarks / anchors:** Greywatch Lighthouse, Storm Hall, Black Teeth Lookout, Gale Market, North Rescue Station.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-002 Ternwick
**Region:** Stormlands.
**Districts / local areas:** Old Wick, Tern Harbour, Cliff Ward, East Moor.
**Landmarks / anchors:** Ternwick Pier, Whaleback Lookout, Moor Chapel, Stormglass Steps.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-003 Pinemere
**Region:** Northern Highlands.
**Districts / local areas:** Old Mere, Pine Shore, Station Ward, North Woods, Lake Heights.
**Landmarks / anchors:** Pinemere Station, Mirror Lake Pier, Highland Conservatory, Pine Hall, Seven Springs Park.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-004 Frostvale
**Region:** Northern Highlands.
**Districts / local areas:** Old Vale, Frostbank, Upper Vale, Southgate.
**Landmarks / anchors:** Frostvale Bridge, Raven Steps, Snowmelt Gardens, Vale Station.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-005 Stoneheath
**Region:** Northern Plateau.
**Districts / local areas:** Old Heath, Market Cross, North Ridge, Rail Ward, South Fields.
**Landmarks / anchors:** Sky Table Hall, Stoneheath Station, Heath Market, Long Ridge View, Plateau Reservoir.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-006 Windmere
**Region:** Northern Plateau.
**Districts / local areas:** Lake Ward, Old Windmere, West Heath, Dam Quarter.
**Landmarks / anchors:** Windmere Dam, Pale Lakes Walk, Windmere Station, North Wind Tower.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-007 Mistbay
**Region:** Emerald Coast.
**Districts / local areas:** Old Bay, Rain Quays, Upper Mist, Forest Ward, South Beach.
**Landmarks / anchors:** Mistbay Harbour, Cloud Forest Gate, Rain House, Mist Point Lighthouse, Emerald Steps.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-008 Fernhaven
**Region:** Emerald Coast.
**Districts / local areas:** Old Haven, Fernbank, River Mouth, Cloud Ward.
**Landmarks / anchors:** Fernhaven Bridge, Fern Point, Mosswood Hall, Rainwall View.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-009 Jadegrove
**Region:** Rainforest Belt.
**Districts / local areas:** River Core, Canopy Ward, Old Grove, Wetland Edge.
**Landmarks / anchors:** Cathedral Trees Gate, Jade River Pier, Canopy Hall, Orchid Wetlands Centre.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-010 Aurel Gate
**Region:** Great Range.
**Districts / local areas:** Lower Gate, Pass Ward, Station Shelf.
**Landmarks / anchors:** Aurel Gate Station, Mountain Rescue Hall, High Crown Cableway, Aurel Pass Portal.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-011 Willowford
**Region:** Central Plains.
**Districts / local areas:** Old Ford, River Market, East Fields, Station Ward, Willow Park.
**Landmarks / anchors:** Willowford Bridge, Great River Hall, Willow Station, Floodplain Gardens, Old Mill.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-012 Bellmere
**Region:** Central Plains.
**Districts / local areas:** Old Bellmere, Lakefront, North Fields, Rail Ward.
**Landmarks / anchors:** Bellmere Pier, Bellwood Park, Bellmere Station, Lake Hall.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-013 Goldenfield
**Region:** Central Plains.
**Districts / local areas:** Market Core, Rail Yards, North Meadow, South Fields.
**Landmarks / anchors:** Goldenfield Exchange, Meadow Hall, Central Grain Market, Goldenfield Station.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-014 Blackstone
**Region:** Volcanic Basin.
**Districts / local areas:** Old Stone, Steam Ward, Lava Edge, North Basin.
**Landmarks / anchors:** Blackstone Baths, Obsidian Hall, Steamworks, Glass Plain Gate.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-015 Steamvale
**Region:** Volcanic Basin.
**Districts / local areas:** Old Vale, Springs Quarter, East Terrace.
**Landmarks / anchors:** Steamvale Springs, White Terrace Walk, Geothermal Hall, Vale Station.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-016 Amberfield
**Region:** Eastern Steppe.
**Districts / local areas:** Old Amber, Station Ward, Wind Quarter, South Fields.
**Landmarks / anchors:** Amberfield Station, Grass Sea Park, Wind Hall, Steppe Market.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-017 Sagecross
**Region:** Eastern Steppe.
**Districts / local areas:** Old Cross, Escarpment Ward, Dry River, Eastgate.
**Landmarks / anchors:** Great Escarpment View, Sagecross Station, Dry River Bridge, Plateau Hall.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-018 Redgate
**Region:** Redlands.
**Districts / local areas:** Old Gate, Canyon Ward, Well Quarter, South Mesa.
**Landmarks / anchors:** Red Canyon Gate, Canyon Museum, Redgate Well, Scarlet Walls View.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-019 Saltwell
**Region:** Redlands.
**Districts / local areas:** Old Well, Salt Ward, Solar Edge.
**Landmarks / anchors:** Salt Mirror Centre, Great Well, Solar Field View, Desert Market.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-020 Greyhaven
**Region:** Southern Fjords.
**Districts / local areas:** Old Harbour, Fjord Ward, Upper Grey, South Quay.
**Landmarks / anchors:** Greyhaven Ferry Hall, Black Cliffs View, Fjord Museum, Mist Gate Pier.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-021 Brightport
**Region:** Southern Coast.
**Districts / local areas:** Old Port, Garden Ward, East Beach, Station Quarter, New Harbour.
**Landmarks / anchors:** Brightport Station, Garden Estuary Park, Old Harbour Hall, White Dunes Gate, South Pier.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-022 Olivehaven
**Region:** Southern Coast.
**Districts / local areas:** Old Haven, Olive Hills, Bay Ward, North Gardens.
**Landmarks / anchors:** Olive Market, Garden Shore Pier, Olive Hills Park, Cedar Wetlands Centre.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-023 Maravista
**Region:** Southeastern Islands.
**Districts / local areas:** Old Mara, Lagoon Ward, Link Gate, South Harbour, Crown Heights.
**Landmarks / anchors:** Azure Lagoon Promenade, Mara Crown View, Maravista Terminal, Link Visitor Centre, West Reef Pier.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

## RC-024 Ternport
**Region:** Southeastern Islands.
**Districts / local areas:** Old Port, White Bay, Link Ward, Forest Edge.
**Landmarks / anchors:** Ternport Harbour, White Bay Park, Tern Forest Gate, Link Terminal.
**Implementation:** create stable child IDs under the existing RC object; city footprint, transport and water/coast relationship must match parent geography.

# 2. Selected towns — compact L3 structure
## TOWN-001 — Ravenford
**Region:** Northern Highlands. **L3 places:** Old Centre, River/Lake Edge, Station, Highland Park.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-002 — Heatherdale
**Region:** Northern Highlands. **L3 places:** Old Centre, River/Lake Edge, Station, Highland Park.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-003 — Larkcross
**Region:** Northern Plateau. **L3 places:** Market Cross, Heath Edge, Station, Ridge View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-004 — Kaelor Vale
**Region:** Northern Plateau. **L3 places:** Market Cross, Heath Edge, Station, Ridge View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-005 — Cloudglen
**Region:** Emerald Coast. **L3 places:** Old Centre, River Mouth, Forest Gate, Coastal View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-006 — Mossreach
**Region:** Emerald Coast. **L3 places:** Old Centre, River Mouth, Forest Gate, Coastal View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-007 — Canopy Vale
**Region:** Rainforest Belt. **L3 places:** River Centre, Canopy Edge, Wetland Walk, Forest Gate.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-008 — Orchid Bay
**Region:** Rainforest Belt. **L3 places:** River Centre, Canopy Edge, Wetland Walk, Forest Gate.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-009 — Greywall
**Region:** Great Range. **L3 places:** Lower Village, Pass Road, Rescue/Service Point, Mountain View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-010 — Crown Village
**Region:** Great Range. **L3 places:** Lower Village, Pass Road, Rescue/Service Point, Mountain View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-011 — Rivercross
**Region:** Central Plains. **L3 places:** Old Centre, River Crossing, Station, Meadow Park.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-012 — Meadowbridge
**Region:** Central Plains. **L3 places:** Old Centre, River Crossing, Station, Meadow Park.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-013 — Ashfield
**Region:** Volcanic Basin. **L3 places:** Old Centre, Thermal Quarter, Basin Road, Lava View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-014 — Obsidian Gate
**Region:** Volcanic Basin. **L3 places:** Old Centre, Thermal Quarter, Basin Road, Lava View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-015 — Copper Ridge
**Region:** Eastern Steppe. **L3 places:** Old Centre, Dry River, Road/Station, Steppe View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-016 — Larkrun
**Region:** Eastern Steppe. **L3 places:** Old Centre, Dry River, Road/Station, Steppe View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-017 — Mesa Crossing
**Region:** Redlands. **L3 places:** Well Centre, Canyon/Mesa Edge, Roadhouse, Desert View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-018 — Dusthaven
**Region:** Redlands. **L3 places:** Well Centre, Canyon/Mesa Edge, Roadhouse, Desert View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-019 — Ternvik
**Region:** Southern Fjords. **L3 places:** Harbour, Upper Village, Ferry Point, Fjord View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-020 — Deepwater
**Region:** Southern Fjords. **L3 places:** Harbour, Upper Village, Ferry Point, Fjord View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-021 — Garden Shore
**Region:** Southern Coast. **L3 places:** Old Centre, Coast/Estuary, Station, Public Gardens.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-022 — Bayfield
**Region:** Southern Coast. **L3 places:** Old Centre, Coast/Estuary, Station, Public Gardens.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-023 — Beacon City
**Region:** Southeastern Islands. **L3 places:** Harbour, Island Centre, Beach/Lagoon, Ferry/Air Link.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-024 — Coral Haven
**Region:** Southeastern Islands. **L3 places:** Harbour, Island Centre, Beach/Lagoon, Ferry/Air Link.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-025 — Galehaven
**Region:** Stormlands. **L3 places:** Harbour/Centre, Moor Edge, Lighthouse Road, Storm View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

## TOWN-026 — Rookhaven
**Region:** Stormlands. **L3 places:** Harbour/Centre, Moor Edge, Lighthouse Road, Storm View.
Create 1 local landmark whose type is driven by actual geography (bridge, pier, reservoir, park, lighthouse, thermal site, viewpoint, station, etc.).

# 3. Signature sites — explicit L4 children
## DISC-001 The Wind Organ
**L4 children:** Cliff Gallery, North Pipes, Storm Terrace, Lower Caverns, Weather Station.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-003 Mirror Tarn
**L4 children:** North Shore, Black Water, Raven Ridge, Tarn Path.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-004 Sky Table
**L4 children:** West Rim, Table Top, Long View, Stone Shelter.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-005 Crownfall
**L4 children:** Upper Crownfall, Middle Veil, Lower Plunge, Crownfall Gorge, Rainforest View.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-006 Seven Veils
**L4 children:** Veil One, Veil Two, Veil Three, Veil Four, Veil Five, Veil Six, Veil Seven, Hanging Valley.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-007 Cathedral Trees
**L4 children:** Great Grove, Cathedral Trunk, Canopy Walk, Forest Floor Reserve, Mara Creek.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-120 Aurelia Icefield
**L4 children:** Crown Glacier, Aurel Glacier, White River Glacier, Serac Basin, North Crown Snowfield, South Col Icefall.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-121 Three Lakes Basin
**L4 children:** Blue Lake, Green Lake, Black Lake, Three Lakes Pass, Basin Hut.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-122 Great River Marshes
**L4 children:** North Reed Sea, Willow Channels, Great Heron Pools, Flood Meadow, Marsh Observatory.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-123 Great Caldera
**L4 children:** North Rim, Black Rim, Ember Rim, Collapsed East Gate, Steam Shore, Obsidian Peninsula, Ash Islands, Blue Depths.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-124 White Terraces
**L4 children:** Upper Terraces, Lower Terraces, Steam Steps, Mineral Pools, Terrace Walk.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-125 Glass Plain
**L4 children:** Black Glass Field, Obsidian Ridge, Glass Edge, Ash Trail.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-126 Great Escarpment
**L4 children:** North Wall, High Step, Sage Gap, Copper Face, South Break.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-127 Red Canyon
**L4 children:** Upper Canyon, Cathedral Gorge, Copper Narrows, Great Bend, Scarlet Walls, Lower Canyon.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-128 Salt Mirror
**L4 children:** North Pan, Mirror Basin, Salt Islands, Dry Shore.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-129 Dry Cathedral
**L4 children:** Great Nave, West Spires, Sun Window, Cathedral Floor, Red Steps.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-130 Black Cliffs
**L4 children:** North Face, Great Wall, Seal Ledge, Cliff Falls, Black Head.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-131 Mist Gate
**L4 children:** West Pillar, East Pillar, Gate Channel, Mist Light.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-132 Needle Island
**L4 children:** Needle Peak, North Landing, Sea Arch, Light Station.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-133 White Dunes
**L4 children:** Great Dune, Dune Lakes, South Beach, White Dunes Reserve, Estuary Edge.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-134 Azure Lagoon
**L4 children:** Inner Lagoon, West Reef, Mara Channel, Blue Hole, Lagoon Islands.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-135 East Light
**L4 children:** Main Tower, Keeper Houses, East Head, Signal Terrace.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-136 Rainwall Viaduct
**L4 children:** West Approach, Great Span, Rain Gorge Pier, East Portal, View Terrace.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

## DISC-137 Canyon Bridge
**L4 children:** North Approach, Main Span, South Approach, Canyon Deck View, Service Gallery.
Children must be spatially nested inside/adjacent to the parent site and only appear at close zoom.

# 4. Engineering deep zoom
## INF-01 Pelotonia Link (`concept`)
Preferred components:
- **Link Mainland Interchange**
- **Mara Approach Viaduct**
- **Mara Strait Suspension Bridge**
- **Mara Portal**
- **Mid-Sea Tunnel**
- **Service Island**
- **Tern Channel Viaduct**
- **Tern Link Terminal**
- optional future continuation toward Beacon Island

L1: one national connection. L2: named sections. L3: junctions, portals and service island. L4: individual spans/portals/visitor structures.

## INF-02 Great Range Base Tunnel (`concept`)
Children: **West Portal**, **East Portal**, **Base Tunnel**, **Emergency Gallery**, **Aurel Junction**, **Range Control Centre**.

## INF-03 Crown Dam (`concept` until status changed elsewhere)
Children: **Main Dam**, **Spillway**, **Power Hall**, **Crown Reservoir**, **Visitor Terrace**, **Lower River Works**.

## INF-04 Aurelia International Airport
Children: **Central Terminal**, **East Terminal**, **Cargo Apron**, **Airport Rail Station**, **Runway Lagoon**, **Aviation Park**.

## INF-05 Westhaven Deepwater Port
Children: **Outer Breakwater**, **Container Basin**, **Deepwater Berths**, **Ferry Terminal**, **Port Rail Yard**, **Stormbreak Light**.

# 5. All-grid local-detail completion rule
V1.1–V1.3 already provide the 192 macro-grid base. Complete local zoom according to these rules:

- **Major-city grid:** 12–30 L3/L4 children across city + surrounding geography.
- **Regional-city grid:** 8–18 children.
- **Town-dominated grid:** 5–12 children.
- **Populated rural grid:** 4–9 children.
- **Wilderness land grid:** 2–7 natural/infrastructure children; zero settlements is valid.
- **Ocean grid:** 0–4 children; empty deep ocean is valid.
- At least one child in a populated grid must explain why people settled there.
- At least one child in a wilderness grid should express its defining geography when such a feature exists.
- Never satisfy counts by duplicating generic parks/viewpoints. Counts are guidance, not quotas.

# 6. Local object naming
Use working names consistently. Prefer ordinary place names mixed with a smaller number of memorable names. Avoid fantasy-name saturation. Reuse geographic roots where appropriate: a river, town, station and valley may legitimately share a root. Never rename existing stable objects merely to make names more dramatic.

# 7. Definition of done
1. Add stable children for all 24 RC cities above.
2. Add compact L3 structure for all 26 selected towns.
3. Add L4 children for all listed signature sites.
4. Add deep-zoom components for major infrastructure.
5. Apply the all-grid completion rule to the full 192-cell world without artificial filler.
6. Reconcile all collisions with V1.0–V1.3 and report them.
7. Validate parents, grids, zoom levels, geometry placeholders and route continuity.
8. Run all world tests, lint and production build.
9. Do not add cycling-specific content or historical lore.