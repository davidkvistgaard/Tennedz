# PELOTONIA CONNECTIVITY & SYSTEMS EXPANSION V1.5

> Codex implementation brief. This extends World 1.0 + V1.1 + V1.2 + V1.3 + V1.4. Reconcile existing objects; never duplicate stable IDs. No cycling-specific content.

## 1. Purpose

V1.5 makes Pelotonia behave like one continuous country rather than 192 detailed cells. Rivers, watersheds, lakes, roads, railways, ferries, ports, airports, bridges, tunnels, dams and settlement corridors must connect coherently across the full map.

The network itself becomes explorable: selecting a river, railway or highway should allow the atlas to show its entire path and reveal more detail as the user zooms.

## 2. Global rules

- Grid borders never terminate continuous features unless the geography genuinely terminates them.
- Every continuous network object has one stable parent ID and child segments.
- Child segments inherit the parent name/root where useful.
- A lake must have plausible inflow/outflow or a documented closed-basin status.
- Major rivers need headwaters, tributaries, confluences, floodplains and mouths.
- Roads and railways must connect actual settlements/infrastructure.
- Tunnels/bridges belong to the route they carry.
- Ferry routes require terminals at both ends.
- Airports require a settlement/region role; do not add airports merely for coverage.
- Avoid perfect network symmetry. Geography creates bottlenecks, dead ends and sparse regions.
- All exact geometry remains fictional-world geometry until Pelotonia receives explicit Earth coordinates.

# 3. National watershed model

## HYD-R01 — Verdan River System
**Source:** Northern Highlands / upper lake country.
**Core path:** highland tributaries → Lake Verdan → Rivermere → northeastern lowlands → Pacific outlet.
**Character:** cool, reliable, forest-fed.
**Major children:**
- HYD-R01-A Frost River
- HYD-R01-B Pine River
- NAT-LAK-001 Lake Verdan
- HYD-R01-C Rivermere Reach
- HYD-R01-D Lower Verdan
- HYD-R01-M Verdan Estuary
**L3 sites:** Ravenford Bridge, Verdan Marshes, Rivermere Lake Gates, Lower Verdan Wetlands.

## HYD-R02 — Great River System
Pelotonia's largest and most economically important drainage.
**Sources:** Aurelia Icefield, central Great Range and Three Lakes Basin.
**Path:** mountain tributaries → Crown Reservoir/Dam corridor → Central Plains → Valedor → broad lower floodplain → Aurelia estuary → Great Bay.
**Children:**
- HYD-R02-A Aurel River — glacier-fed headwater.
- HYD-R02-B Crown River — western high-mountain tributary.
- HYD-R02-C Greywall River — southern mountain tributary.
- HYD-R02-D Upper Great River.
- INF-03 Crown Dam / Crown Reservoir.
- HYD-R02-E Valedor Reach.
- HYD-R02-F Crown Island Channels.
- HYD-R02-G Lower Great River.
- HYD-R02-H Aurelia Reach.
- HYD-R02-M Great River Estuary.
**L3/L4:** Crown Dam works, Willowford crossing, Valedor Great Locks, Crown Island, Great River Marshes, Rivergate Locks, Verdan Quays (Aurelia; local historical name does not imply Verdan watershed), Aurelia harbour mouth.

## HYD-R03 — Emerald River System
**Sources:** western Great Range / rainforest escarpment.
**Path:** Crownfall country → deep gorges → Greenfall → southwestern ocean.
**Character:** short, extremely high discharge, waterfalls and hydro potential.
**Children:** Cloud River, Crownfall River, Moss River, Greenfall Reach, Emerald Estuary.
**Sites:** Crownfall, Seven Veils catchment, Moss Gorge, Greenfall Cascades, Fern Bridge.

## HYD-R04 — Kaen–Red River System
**Sources:** Volcanic Basin / Great Escarpment.
**Path:** eastern uplands → Kaen irrigation basin → steppe → Red Canyon → terminal lower desert river / southeastern coast depending seasonal discharge.
**Character:** highly seasonal; historic canyon-forming river.
**Children:** Ember Creek, Kaen River, Sage River, Upper Red River, Red Canyon Reach, Lower Red.
**Sites:** Kaen Reservoir, Copper Narrows, Great Bend, Saltwell diversion, canyon flood terraces.

## HYD-R05 — Southern Short Rivers
Family of independent maritime rivers draining Southern Coast and Southern Fjords.
Parent collection, not one river.
Named systems: Garden River, Cedar River, Southport River, Greyfjord River, Deepwater River, Tern River.

# 4. Lakes and basins

- **NAT-LAK-001 Lake Verdan:** open freshwater lake; Frost/Pine inflows; Verdan River outflow.
- **NAT-LAK-002 Lake Aurel:** glacial headwater lake feeding HYD-R02-A.
- **NAT-LAK-003 Lake Kaen:** semi-arid lake/reservoir-linked natural basin; seasonal levels; connected to HYD-R04 during wet periods.
- **NAT-LAK-004 Great Caldera Lake:** volcanic basin; limited surface outlet through Collapsed East Gate feeding a tributary of HYD-R04.
- **Crown Reservoir:** artificial lake behind INF-03.
- **Mirror Tarn:** closed/small overflow alpine basin.
- **Three Lakes Basin:** connected alpine lakes feeding Great River headwaters.
- **Salt Mirror:** closed ephemeral basin; no permanent outflow.

# 5. National road network

## ROAD-N01 — Crownway
Northwatch → Pinemere → Rivermere → Willowford → Valedor → Crown Junction → Aurelia → Southport.
Primary divided trunk where terrain allows.
Segments:
N01-01 Northwatch–Pinemere
N01-02 Pinemere–Rivermere
N01-03 Rivermere–Willowford
N01-04 Willowford–Valedor
N01-05 Valedor–Aurelia
N01-06 Aurelia–Southport

## ROAD-N02 — Emerald Highway
Westhaven → Mistbay → Fernhaven → Greenfall → southern range crossing → Aurelia.
Key structures: Rainwall Viaduct, Cloudgate Tunnel, Fern Bridge.

## ROAD-N03 — Eastern Way
Valedor → Sagecross → Kaen → Redgate → southeastern mainland terminal.
Key structures: Great Escarpment switchback/viaduct section; Canyon Bridge branch.

## ROAD-N04 — Caldera Road
Valedor → Blackstone → Steamvale → Ember → Kaen.
Includes caldera rim spur and geothermal access roads.

## ROAD-N05 — Highland Ring
Northwatch → Frostvale → Stoneheath → Windmere → Rivermere.
Lower-standard all-weather route through northern uplands.

## ROAD-N06 — Fjord Road
Greenfall → Greyhaven → Deepwater → Southport, interrupted by fjords and supplemented by ferries/tunnels.
Key structures: Deepwater Tunnel, Mist Gate Ferry, multiple short fjord bridges.

## ROAD-N07 — Redlands Loop
Kaen → Redgate → Saltwell → Mesa Crossing → Dusthaven → southeastern coast → rejoin Eastern Way.
Sparse service intervals.

## ROAD-N08 — Island Ring
Road system on Mara/Tern/Beacon islands. Future INF-01 connects it to mainland.

# 6. Rail network

## RAIL-N01 — Crown Main Line
Northwatch → Rivermere → Valedor → Aurelia → Southport.
Principal passenger/freight spine.
Major stations: Northwatch Crown, Rivermere Great Lake, Valedor Central, Aurelia Central, Southport Bay.

## RAIL-N02 — Emerald Line
Westhaven → Mistbay → Greenfall → Great Range crossing → Aurelia.
Freight-heavy western line with tunnels.

## RAIL-N03 — Eastern Main
Valedor → Sagecross → Kaen → southeastern logistics terminal.
Potential future extension across Pelotonia Link.

## RAIL-N04 — Ember Line
Valedor → Blackstone → Ember. Passenger + geothermal/industrial freight.

## RAIL-N05 — Northern Plateau Line
Rivermere → Stoneheath → Windmere → Northwatch connection.
Secondary scenic/utility line.

## RAIL-N06 — Aurelia Metropolitan Rail
Parent system for Aurelia Central, Crown Gate, Rivergate, Airport Coast and outer satellite connections. Metro/tram detail remains city-level data.

# 7. Great Range crossings

Only three primary all-weather cross-range corridors:
1. **Crown Pass Corridor** — high road; weather-sensitive.
2. **Aurel Gate Corridor** — road + conventional rail tunnels; connects mountain settlements.
3. **INF-02 Great Range Base Tunnel** — concept future/major engineered low-level corridor, 30–40 km.

Secondary mountain roads may dead-end at valleys/reserves; do not make every valley traversable.

# 8. Ports and ferry system

## Major ports
- INF-05 Westhaven Deepwater Port — container/deepwater western gateway.
- Aurelia Grand Harbour — national passenger/commercial harbour.
- Southport Harbour — southern commercial/ferry port.
- Greenfall Harbour — western regional port.
- Maravista Terminal — largest island port.
- Ternport Harbour — island freight/passenger port.
- Greyhaven — fjord regional port.

## FERRY-N01 — Southeastern Island Ferry Ring
Mainland SE terminal → Maravista → Ternport → Beacon City → return/branch services.
Remains even if Pelotonia Link is built.

## FERRY-N02 — Southern Fjord Service
Greenfall/outer coast → Greyhaven → Ternvik → Deepwater → Sealholm.
Mix of road-replacement ferries and community service.

## FERRY-N03 — Aurelia Bay Ferries
Urban/regional ferry network across Great Bay and lower estuary.

## FERRY-N04 — Northern Coastal Service
Greywatch → Ternwick → selected northern island/coastal settlements.

# 9. Airports

## AIR-001 — Aurelia International Airport
National hub; existing INF-04/local AUR object.

## AIR-002 — Westhaven International
Secondary international/long-range capable airport on limited coastal shelf; engineering-constrained.

## AIR-003 — Valedor Airport
Large domestic/regional airport on Central Plains.

## AIR-004 — Kaen Airport
Eastern regional airport.

## AIR-005 — Northwatch Airport
Northern domestic airport; weather-sensitive.

## AIR-006 — Maravista Airport
Southeastern Islands regional/international gateway.

## AIR-007 — Greenfall Airport
Shorter runway regional airport on reclaimed/limited coastal land.

## AIR-008 — Southport Airport
Southern regional airport.

Small airstrips: Greyhaven, Redgate, Beacon Island, emergency Great Range strip. Do not promote them to major airports.

# 10. Power and water infrastructure

- **Crown Dam:** major hydroelectric generation + flood management.
- **Emerald Hydro Cascade:** several smaller hydro stations on high-rainfall western rivers; avoid one giant dam in pristine Crownfall catchment.
- **Ember Geothermal Field:** principal geothermal generation cluster.
- **Kaen Wind Park:** large steppe wind-generation landscape.
- **Saltwell Solar Field:** large Redlands solar installation.
- **Aurelia Water System:** Summit Reservoir + Great River intake + upland storage.
- **Island Water System:** Mara reservoirs + desalination backup; smaller islands rely on local catchments/desalination.
- National high-voltage corridor broadly follows major transport/settlement corridors; detailed pylons appear only at close zoom.

# 11. Bridges and tunnels registry

Nationally/regionally notable:
- St. Oran Bridge — Old Aurelia.
- Crown Island Bridge — Valedor.
- Willowford Bridge — Great River.
- Fern Bridge — Greenfall.
- Rainwall Viaduct — Emerald Coast.
- Canyon Bridge — Redlands.
- Lake Bridge — Rivermere.
- Greybridge — Aurelia Westbank.
- Three Bridges — Aurelia Rivergate complex.
- Cloudgate Tunnel — Emerald Highway.
- Deepwater Tunnel — Southern Fjords.
- Crown Pass tunnels — short alpine galleries.
- Great Range Base Tunnel — concept.
- Pelotonia Link structures — concept.

# 12. Settlement corridor logic

- **Primary demographic belt:** Rivermere → Central Plains → Valedor → Aurelia → Southport.
- **Western coastal belt:** Westhaven → Mistbay → Fernhaven → Greenfall.
- **Eastern belt:** Sagecross → Kaen → Redgate; much lower density.
- **Volcanic belt:** Blackstone → Steamvale → Ember.
- **Island belt:** Maravista → Ternport → Beacon City.
- **Fjord settlements:** discontinuous; ports rather than continuous urbanization.
- Great Range, Redlands interior and rainforest reserves retain very low density.

# 13. Atlas interaction for networks

Selecting any major river/road/rail/ferry route should:
1. highlight its full parent route at current zoom;
2. show named segments and junctions when zoomed;
3. reveal bridges/tunnels/stations/locks at closer zoom;
4. allow clicking connected settlements/features;
5. preserve breadcrumb context.

Network labels should declutter automatically. Do not show every segment name at L1.

# 14. Cross-grid validation

Codex should implement/extend validators so:
- a river segment ending on a grid edge has a matching continuation or valid mouth/lake/source;
- road/rail segment endpoints connect to another segment, settlement or explicit dead end;
- ferry routes have valid terminals;
- bridge/tunnel children intersect the parent route;
- dams intersect a valid river and create/reference a reservoir;
- lakes do not have impossible duplicate outlets;
- airports belong to plausible land cells and parent settlements/regions;
- population corridors do not contradict wilderness/protected-area parents.

# 15. Definition of done

1. Hydrology is continuous from source to sea/closed basin.
2. All national road and rail corridors connect their stated settlements.
3. Ports, ferries and airports form a coherent national transport system.
4. Major engineering structures are children of actual networks.
5. Water/power infrastructure is geographically plausible.
6. Atlas can highlight complete networks and progressively reveal children.
7. Existing V1.0–V1.4 IDs are reconciled, not duplicated.
8. All validation, tests, lint and production build pass.
9. No cycling-specific content or unnecessary historical lore is added.
