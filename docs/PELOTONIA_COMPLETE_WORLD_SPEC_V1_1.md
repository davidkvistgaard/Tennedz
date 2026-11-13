# PELOTONIA COMPLETE WORLD SPECIFICATION V1.1

> **For Codex:** Expand the existing Pelotonia World 1.0. Preserve every existing stable ID and reconcile rather than duplicate. Names below are working names and may later change without changing stable IDs.

## 1. World rules

- Pelotonia is a fictional sovereign island nation in the South Pacific.
- Main-island land area: ~115,000 km². Population: ~12.1 million.
- Macro-grid: 16×12, columns A–P west→east and rows 1–12 north→south.
- Grid cells are indexing/climate containers, never hard geographic boundaries.
- L1 = whole country; L2 = macro-grid/region; L3 = local area/city district; L4 = landmark/site.
- Zooming must reveal new data, not simply enlarge labels.
- Rivers, ranges, roads, railways, cities and infrastructure can cross any number of cells.
- No cycling-specific geography is included here.
- New world features should be data additions, not require bespoke map code.
- Physical continuity between adjacent cells is mandatory.

## 2. Existing national features to preserve

- **NAT-MTN-001 Mount Aurelia** — 4,372 m; highest point.
- **NAT-MTN-002 Frostpeak** — ~3,850 m.
- **NAT-MTN-003 White Crown** — ~3,600 m multi-summit ice ridge.
- **NAT-MTN-004 Mount Nyx** — 3,106 m volcanic massif.
- **NAT-MTN-005 Southwatch** — ~3,050 m; southern fjord landmark.
- **NAT-VOL-001 Ember Peak** — 2,418 m active volcano.
- **NAT-ICE-001 Aurelia Icefield** — ~1,000–1,500 km².
- **NAT-LAK-001 Lake Verdan** — major northern-central lake.
- **NAT-LAK-002 Lake Aurel** — high alpine glacial lake.
- **NAT-LAK-003 Lake Kaen** — dry eastern lake.
- **NAT-LAK-004 Great Caldera Lake** — ~18–22 km diameter.
- **NAT-GEO-001 Great Escarpment** — ~150 km; locally 800–900 m relief.
- **NAT-GEO-002 Red Canyon** — ~150–200 km; maximum depth ~1,000–1,200 m.
- **NAT-WAT-001 Crownfall** — signature western waterfall; ~800 m total drop.

## 3. Infrastructure concepts / national infrastructure

- **INF-01 Pelotonia Link** (`concept`) — ~35–45 km bridge/tunnel/viaduct connection toward Southeastern Islands. If canonised, visible at L1 and decomposed into sections at L2–L4.
- **INF-02 Great Range Base Tunnel** (`concept`) — ~30–40 km trans-mountain corridor.
- **INF-03 Crown Dam** (`concept`) — major hydroelectric dam/reservoir.
- **INF-04 Aurelia International Airport** (`canonical_editable`) — principal international airport.
- **INF-05 Westhaven Deepwater Port** (`canonical_editable`) — national-scale western harbour.

## 4. Major cities already established

- **Aurelia** — ~2.45m metro; capital; primarily I10/J10.
- **Valedor** — ~1.18m; Central Plains / Great River.
- **Westhaven** — ~760k; western deepwater port.
- **Rivermere** — ~620k; Lake Verdan/river city.
- **Kaen** — ~510k; Eastern Steppe centre.
- **Greenfall** — ~390k; wet southwestern coastal city.
- **Northwatch** — ~310k; northern regional centre.
- **Southport** — ~280k; southern maritime city.
- **Ember** — ~220k; Volcanic Basin city.

## 5. Aurelia — existing deep-zoom canon

### Districts
- **AUR-01 Old Aurelia** — historic core; Cathedral Hill, Old Market, Verdan Quays, Citadel Hill, Museum Row.
- **AUR-02 Crown District** — government and civic centre.
- **AUR-03 Central Aurelia** — modern CBD.
- **AUR-04 Grand Harbour** — commercial waterfront.
- **AUR-05 Eastbank** — dense mixed urban area.
- **AUR-06 Westbank** — older residential city.
- **AUR-07 University Quarter** — university/research/culture.
- **AUR-08 South Shore** — coastal residential/leisure.
- **AUR-09 Ironworks** — former industrial waterfront.
- **AUR-10 North Gardens** — green affluent inner suburb.
- **AUR-11 Rivergate** — river commerce and transport.
- **AUR-12 Heights** — hills and viewpoints.
- **AUR-13 Airport Coast** — airport/logistics/new development.
- **AUR-14 Outer Aurelia** — suburban belt and satellite centres.

### Landmarks
- **AUR-LMK-001 Great Cathedral of Aurelia** — 188×92 m; 171 m central spire; 143 m western towers; >15,000 capacity; ~35 ha precinct.
- **AUR-LMK-002 Parliament Complex**
- **AUR-LMK-003 Aurelia Central Station**
- **AUR-LMK-004 University of Aurelia**
- **AUR-LMK-005 National Stadium** — ~80,000 seats.
- **AUR-LMK-006 Old Citadel**
- **AUR-LMK-007 Aurelia Tower**
- **AUR-LMK-008 Grand Market**
- **AUR-LMK-009 National Gardens**
- **AUR-LMK-010 Harbour Arch**
- **AUR-LMK-011 National Museum**
- **AUR-LMK-012 Reserved** — intentionally unresolved.

### Old Aurelia L3
Cathedral Hill; Founders Square; Mercer Lane; Old Market; Citadel Hill; Verdan Quays; Cathedral Gardens; Museum Row; St. Oran Bridge.

### Great Cathedral L4
Grand Cathedral Plaza; West Towers; Great Nave; Central Spire; North Cloister; Cathedral Gardens; Chapter House; Cathedral Library.

## 6. Complete macro-grid dossiers

The 192 dossiers below intentionally name places so the world is understandable during design. Codex must create stable IDs for newly introduced objects. These names remain `canonical_editable`.


### A1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **PelotoniaRise** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **SouthBank** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D1 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **TernHaven** — town.
  - **GaleHaven** — headland.
  - **StormWick** — cliff.
  - **TernWick** — cliff.
  - **StormBay** — headland.
  - **GaleWick** — moor.
  - **GreyPoint** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E1 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **RookWick** — town.
  - **RookHaven** — bay.
  - **GreyHaven** — cliff.
  - **RookCliff** — moor.
  - **GaleBay** — moor.
  - **TernPoint** — cliff.
  - **StormPoint** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F1 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **VerdanDale** — town.
  - **VerdanRidge** — village.
  - **PineRidge** — village.
  - **CrownFord** — river.
  - **VerdanVale** — river.
  - **HeatherDale** — lake.
  - **FrostRidge** — lake.
  - **PineMere** — river.
  - **VerdanFord** — lake.
  - **FrostFord** — regional road.
  - **HeatherFord** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G1 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **CrownRidge** — town.
  - **CrownDale** — village.
  - **HeatherVale** — village.
  - **HeatherRidge** — river.
  - **VerdanMere** — valley.
  - **FrostVale** — ridge.
  - **HeatherMere** — ridge.
  - **PineVale** — ridge.
  - **PineDale** — valley.
  - **PineFord** — regional road.
  - **CrownMere** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H1 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **CrownVale** — town.
  - **FrostMere** — village.
  - **FrostDale** — village.
  - **Crown 50** — ridge.
  - **Crown 50** — ridge.
  - **Frost 50** — ridge.
  - **Frost 50** — valley.
  - **Pine 50** — ridge.
  - **Crown 50** — valley.
  - **Crown 50** — regional road.
  - **Frost 50** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I1 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Verdan 50** — town.
  - **Crown 50** — village.
  - **Crown 50** — village.
  - **Frost 50** — lake.
  - **Pine 50** — ridge.
  - **Frost 50** — forest.
  - **Heather 50** — forest.
  - **Frost 50** — valley.
  - **Pine 50** — ridge.
  - **Crown 50** — regional road.
  - **Crown 50** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J1 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Pine 50** — town.
  - **Frost 50** — village.
  - **Frost 50** — village.
  - **Crown 50** — river.
  - **Frost 50** — valley.
  - **Verdan 50** — valley.
  - **Verdan 50** — lake.
  - **Crown 50** — valley.
  - **Pine 50** — valley.
  - **Heather 50** — regional road.
  - **Verdan 50** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **OuterShelf** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **DeepShoal** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P1 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A2 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B2 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **BlueTrench** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C2 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **GreyCliff** — town.
  - **GreyBay** — moor.
  - **TernCliff** — cliff.
  - **StormCliff** — cliff.
  - **GalePoint** — moor.
  - **GreyWick** — headland.
  - **RookBay** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D2 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **GaleCliff** — town.
  - **StormHaven** — bay.
  - **TernBay** — headland.
  - **RookPoint** — cliff.
  - **Rook 64** — bay.
  - **Gale 64** — headland.
  - **Gale 64** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Heather 64** — town.
  - **Frost 64** — village.
  - **Frost 64** — village.
  - **Pine 64** — river.
  - **Frost 64** — river.
  - **Crown 64** — valley.
  - **Frost 64** — valley.
  - **Heather 64** — valley.
  - **Crown 64** — forest.
  - **Crown 64** — regional road.
  - **Crown 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Heather 64** — town.
  - **Heather 64** — village.
  - **Frost 64** — village.
  - **Pine 64** — ridge.
  - **Verdan 64** — ridge.
  - **Frost 64** — forest.
  - **Crown 64** — forest.
  - **Heather 64** — ridge.
  - **Frost 64** — forest.
  - **Frost 64** — regional road.
  - **Crown 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Northwatch — 310k** — major city.
  - **Crown 64** — village.
  - **Heather 64** — village.
  - **Crown 64** — village.
  - **Crown 64** — forest.
  - **Crown 64** — ridge.
  - **Pine 64** — river.
  - **Frost 64** — forest.
  - **Frost 64** — river.
  - **Frost 64** — forest.
  - **Verdan 64** — regional road.
  - **Crown 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Crown 64** — town.
  - **Verdan 64** — village.
  - **Heather 64** — village.
  - **Pine 64** — valley.
  - **Verdan 64** — valley.
  - **Heather 64** — forest.
  - **Frost 64** — ridge.
  - **Heather 64** — valley.
  - **Crown 64** — ridge.
  - **Crown 64** — regional road.
  - **Heather 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Heather 64** — town.
  - **Verdan 64** — village.
  - **Pine 64** — village.
  - **Frost 64** — river.
  - **Crown 64** — valley.
  - **Frost 64** — lake.
  - **Crown 64** — lake.
  - **Heather 64** — lake.
  - **Pine 64** — valley.
  - **Frost 64** — regional road.
  - **Crown 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Heather 64** — town.
  - **Pine 64** — village.
  - **Crown 64** — village.
  - **Heather 64** — valley.
  - **Heather 64** — river.
  - **Pine 64** — ridge.
  - **Pine 64** — valley.
  - **Verdan 64** — river.
  - **Frost 64** — ridge.
  - **Frost 64** — regional road.
  - **Verdan 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K2 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 64** — town.
  - **Verdan 64** — village.
  - **Pine 64** — village.
  - **Pine 64** — forest.
  - **Heather 64** — ridge.
  - **Heather 64** — valley.
  - **Pine 64** — ridge.
  - **Crown 64** — valley.
  - **Pine 64** — forest.
  - **Pine 64** — regional road.
  - **Frost 64** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L2 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **KaelorField** — town.
  - **StoneCross** — village.
  - **StonePlain** — headwater.
  - **SagePlain** — upland lake.
  - **SageHeath** — heath.
  - **LarkField** — upland lake.
  - **StoneRidge** — upland lake.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M2 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **KaelorRidge** — town.
  - **WindCross** — village.
  - **LarkCross** — ridge.
  - **StoneHeath** — heath.
  - **WindRidge** — headwater.
  - **KaelorPlain** — heath.
  - **KaelorHeath** — ridge.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N2 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **OuterBank** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O2 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **DeepShelf** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P2 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **PelotoniaShoal** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A3 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B3 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Gale 81** — town.
  - **Tern 81** — cliff.
  - **Storm 81** — moor.
  - **Storm 81** — moor.
  - **Storm 81** — cliff.
  - **Rook 81** — moor.
  - **Storm 81** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C3 — Stormlands
- **Physical character:** cool storm coast; elevation 2–820 m. Dominant region: Stormlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 81** — town.
  - **Storm 81** — moor.
  - **Tern 81** — moor.
  - **Grey 81** — headland.
  - **Gale 81** — moor.
  - **Tern 81** — moor.
  - **Rook 81** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D3 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 81** — town.
  - **Frost 81** — village.
  - **Frost 81** — village.
  - **Frost 81** — river.
  - **Heather 81** — river.
  - **Pine 81** — ridge.
  - **Verdan 81** — river.
  - **Crown 81** — forest.
  - **Crown 81** — river.
  - **Verdan 81** — regional road.
  - **Frost 81** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E3 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Verdan 81** — town.
  - **Frost 81** — village.
  - **Crown 81** — village.
  - **Frost 81** — river.
  - **Verdan 81** — lake.
  - **Pine 81** — river.
  - **Pine 81** — forest.
  - **Frost 81** — valley.
  - **Pine 81** — river.
  - **Frost 81** — regional road.
  - **Heather 81** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F3 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Verdan 81** — town.
  - **Pine 81** — village.
  - **Frost 81** — village.
  - **Verdan 81** — valley.
  - **Crown 81** — ridge.
  - **Heather 81** — valley.
  - **Verdan 81** — valley.
  - **Heather 81** — ridge.
  - **Heather 81** — river.
  - **Heather 81** — regional road.
  - **Heather 81** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G3 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **SeracNeedle** — village.
  - **WhiteGlacier** — valley.
  - **FrostGlacier** — ridge.
  - **FrostPass** — pass.
  - **GreyWall** — pass.
  - **AurelPass** — pass.
  - **FrostWall** — peak.
  - **SeracWall** — alpine lake.
  - **WhiteWall** — ridge.
  - **GreyGlacier** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H3 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Rivermere — 620k** — major city.
  - **GreyPass** — village.
  - **WhitePeak** — peak.
  - **GreyNeedle** — valley.
  - **AurelWall** — alpine lake.
  - **AurelPeak** — glacier.
  - **FrostNeedle** — ridge.
  - **SeracPass** — ridge.
  - **AurelNeedle** — glacier.
  - **FrostPeak** — alpine lake.
  - **WhiteNeedle** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I3 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **SeracPeak** — village.
  - **GreyPeak** — ridge.
  - **AurelGlacier** — glacier.
  - **WhitePass** — alpine lake.
  - **SeracGlacier** — pass.
  - **Frost 106** — glacier.
  - **Aurel 106** — ridge.
  - **Aurel 106** — valley.
  - **White 106** — ridge.
  - **Grey 106** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J3 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Crown 106** — town.
  - **Heather 106** — village.
  - **Pine 106** — village.
  - **Pine 106** — river.
  - **Frost 106** — ridge.
  - **Frost 106** — river.
  - **Frost 106** — ridge.
  - **Pine 106** — ridge.
  - **Verdan 106** — valley.
  - **Heather 106** — regional road.
  - **Heather 106** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K3 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **LarkHeath** — town.
  - **StoneField** — village.
  - **SageCross** — headwater.
  - **WindHeath** — headwater.
  - **SageField** — upland lake.
  - **KaelorCross** — upland lake.
  - **WindPlain** — heath.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L3 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **LarkPlain** — town.
  - **SageRidge** — village.
  - **WindField** — ridge.
  - **LarkRidge** — headwater.
  - **Sage 117** — heath.
  - **Stone 117** — ridge.
  - **Wind 117** — upland lake.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M3 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Sage 117** — town.
  - **Wind 117** — village.
  - **Stone 117** — heath.
  - **Kaelor 117** — upland lake.
  - **Lark 117** — ridge.
  - **Stone 117** — ridge.
  - **Stone 117** — heath.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N3 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaelor 117** — town.
  - **Lark 117** — village.
  - **Lark 117** — ridge.
  - **Wind 117** — upland lake.
  - **Stone 117** — heath.
  - **Kaelor 117** — ridge.
  - **Sage 117** — headwater.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O3 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **DeepBank** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P3 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **SouthTrench** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A4 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **DeepTrench** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B4 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **MossWood** — town.
  - **MossHaven** — village.
  - **RainWood** — river.
  - **RainHaven** — forest.
  - **EmeraldFall** — gorge.
  - **MistVale** — bay.
  - **FernVale** — river.
  - **FernWood** — waterfall.
  - **MossFall** — river.
  - **FernFall** — regional road.
  - **EmeraldHaven** — viaduct.
  - **MistHaven** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C4 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **MossGlen** — town.
  - **FernGlen** — village.
  - **EmeraldWood** — forest.
  - **MistWood** — gorge.
  - **EmeraldVale** — forest.
  - **RainVale** — bay.
  - **MistGlen** — bay.
  - **EmeraldGlen** — waterfall.
  - **RainGlen** — bay.
  - **MossVale** — regional road.
  - **MistFall** — geothermal plant.
  - **FernHaven** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D4 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Crown 144** — town.
  - **Frost 144** — village.
  - **Verdan 144** — village.
  - **Pine 144** — valley.
  - **Heather 144** — ridge.
  - **Heather 144** — lake.
  - **Frost 144** — river.
  - **Pine 144** — river.
  - **Frost 144** — ridge.
  - **Verdan 144** — regional road.
  - **Frost 144** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E4 — Northern Highlands
- **Physical character:** cool forested uplands; elevation 180–1,650 m. Dominant region: Northern Highlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Pine 144** — town.
  - **Frost 144** — village.
  - **Verdan 144** — village.
  - **Crown 144** — forest.
  - **Crown 144** — valley.
  - **Verdan 144** — ridge.
  - **Frost 144** — ridge.
  - **Frost 144** — river.
  - **Crown 144** — river.
  - **Frost 144** — regional road.
  - **Heather 144** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F4 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 144** — village.
  - **Frost 144** — pass.
  - **Serac 144** — pass.
  - **White 144** — peak.
  - **White 144** — glacier.
  - **Serac 144** — glacier.
  - **Frost 144** — ridge.
  - **Serac 144** — pass.
  - **Frost 144** — alpine lake.
  - **Grey 144** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G4 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Serac 144** — village.
  - **White 144** — peak.
  - **Frost 144** — peak.
  - **Frost 144** — pass.
  - **White 144** — pass.
  - **Grey 144** — pass.
  - **White 144** — pass.
  - **Frost 144** — pass.
  - **Frost 144** — alpine lake.
  - **Frost 144** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H4 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 144** — village.
  - **Frost 144** — alpine lake.
  - **Frost 144** — ridge.
  - **Grey 144** — ridge.
  - **Frost 144** — glacier.
  - **Serac 144** — alpine lake.
  - **Aurel 144** — valley.
  - **Frost 144** — valley.
  - **Frost 144** — glacier.
  - **Frost 144** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I4 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 144** — village.
  - **Serac 144** — peak.
  - **Serac 144** — glacier.
  - **Grey 144** — alpine lake.
  - **Grey 144** — ridge.
  - **Grey 144** — alpine lake.
  - **Aurel 144** — valley.
  - **White 144** — alpine lake.
  - **Serac 144** — ridge.
  - **Aurel 144** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J4 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Sage 144** — town.
  - **Stone 144** — village.
  - **Wind 144** — ridge.
  - **Kaelor 144** — ridge.
  - **Kaelor 144** — ridge.
  - **Kaelor 144** — ridge.
  - **Lark 144** — upland lake.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K4 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Stone 144** — town.
  - **Sage 144** — village.
  - **Wind 144** — upland lake.
  - **Kaelor 144** — upland lake.
  - **Wind 144** — heath.
  - **Kaelor 144** — headwater.
  - **Lark 144** — heath.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L4 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Lark 144** — town.
  - **Wind 144** — village.
  - **Sage 144** — upland lake.
  - **Kaelor 144** — upland lake.
  - **Lark 144** — ridge.
  - **Kaelor 144** — heath.
  - **Wind 144** — heath.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M4 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Sage 144** — town.
  - **Sage 144** — village.
  - **Lark 144** — headwater.
  - **Kaelor 144** — heath.
  - **Lark 144** — heath.
  - **Stone 144** — ridge.
  - **Lark 144** — heath.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N4 — Northern Plateau
- **Physical character:** dry snowy plateau; elevation 600–1,400 m. Dominant region: Northern Plateau.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Stone 144** — town.
  - **Lark 144** — village.
  - **Kaelor 144** — headwater.
  - **Kaelor 144** — heath.
  - **Sage 144** — upland lake.
  - **Wind 144** — ridge.
  - **Kaelor 144** — headwater.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O4 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **SouthShoal** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P4 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **OuterRise** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A5 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **OuterShoal** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B5 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **RainFall** — town.
  - **Mist 148** — village.
  - **Rain 148** — bay.
  - **Emerald 148** — river.
  - **Fern 148** — waterfall.
  - **Moss 148** — bay.
  - **Fern 148** — waterfall.
  - **Rain 148** — river.
  - **Rain 148** — bay.
  - **Rain 148** — regional road.
  - **Moss 148** — tunnel.
  - **Rain 148** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C5 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Westhaven — 760k** — major city.
  - **Fern 148** — village.
  - **Rain 148** — village.
  - **Emerald 148** — bay.
  - **Fern 148** — bay.
  - **Rain 148** — gorge.
  - **Emerald 148** — gorge.
  - **Rain 148** — bay.
  - **Rain 148** — forest.
  - **Moss 148** — gorge.
  - **Mist 148** — regional road.
  - **Mist 148** — geothermal plant.
  - **Emerald 148** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D5 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mist 148** — town.
  - **Rain 148** — village.
  - **Moss 148** — bay.
  - **Mist 148** — waterfall.
  - **Emerald 148** — gorge.
  - **Fern 148** — bay.
  - **Rain 148** — river.
  - **Fern 148** — forest.
  - **Emerald 148** — forest.
  - **Emerald 148** — regional road.
  - **Emerald 148** — geothermal plant.
  - **Emerald 148** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E5 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 148** — village.
  - **Frost 148** — alpine lake.
  - **Aurel 148** — peak.
  - **Grey 148** — pass.
  - **Frost 148** — glacier.
  - **Grey 148** — peak.
  - **Frost 148** — pass.
  - **Grey 148** — alpine lake.
  - **Aurel 148** — alpine lake.
  - **Grey 148** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F5 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurel 148** — village.
  - **Frost 148** — alpine lake.
  - **Frost 148** — peak.
  - **Serac 148** — pass.
  - **White 148** — valley.
  - **Serac 148** — glacier.
  - **Aurel 148** — alpine lake.
  - **Aurel 148** — valley.
  - **Aurel 148** — valley.
  - **Aurel 148** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G5 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Serac 148** — village.
  - **Aurel 148** — alpine lake.
  - **White 148** — glacier.
  - **Serac 148** — glacier.
  - **Grey 148** — glacier.
  - **Grey 148** — valley.
  - **Grey 148** — pass.
  - **Serac 148** — valley.
  - **Frost 148** — ridge.
  - **Grey 148** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H5 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 148** — village.
  - **White 148** — alpine lake.
  - **Serac 148** — pass.
  - **Aurel 148** — peak.
  - **Frost 148** — alpine lake.
  - **Frost 148** — pass.
  - **Serac 148** — glacier.
  - **White 148** — glacier.
  - **Serac 148** — glacier.
  - **Frost 148** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I5 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **RiverMere** — town.
  - **MeadowMere** — village.
  - **WillowVale** — village.
  - **MeadowBridge** — village.
  - **GoldenFord** — river.
  - **GoldenVale** — lake.
  - **MeadowFord** — meadow.
  - **MeadowField** — wetland.
  - **ValeBridge** — wetland.
  - **WillowBridge** — regional road.
  - **GoldenField** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J5 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **WillowField** — town.
  - **ValeFord** — village.
  - **GoldenMere** — village.
  - **MeadowVale** — village.
  - **RiverVale** — meadow.
  - **RiverBridge** — meadow.
  - **WillowFord** — meadow.
  - **WillowMere** — meadow.
  - **ValeMere** — river.
  - **ValeVale** — regional road.
  - **GoldenBridge** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K5 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **RiverField** — town.
  - **ValeField** — village.
  - **RiverFord** — village.
  - **Meadow 173** — village.
  - **Vale 173** — river.
  - **Vale 173** — woodland.
  - **River 173** — woodland.
  - **River 173** — woodland.
  - **Willow 173** — lake.
  - **Golden 173** — regional road.
  - **Meadow 173** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L5 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **AshSpring** — town.
  - **EmberLake** — village.
  - **CinderPeak** — hot spring.
  - **AshPeak** — geothermal field.
  - **AshField** — geothermal field.
  - **AshLake** — geothermal field.
  - **NyxField** — caldera.
  - **EmberField** — hot spring.
  - **NyxSpring** — volcano.
  - **ObsidianField** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M5 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **ObsidianBasin** — town.
  - **CinderField** — village.
  - **EmberPeak** — geothermal field.
  - **ObsidianSpring** — geothermal field.
  - **CinderSpring** — caldera.
  - **CinderLake** — caldera.
  - **NyxLake** — lava field.
  - **EmberSpring** — lava field.
  - **CinderBasin** — caldera.
  - **ObsidianPeak** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N5 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **SunRidge** — town.
  - **CopperRidge** — village.
  - **WindFord** — seasonal river.
  - **CopperCross** — seasonal river.
  - **CopperRun** — ridge.
  - **SunRun** — grassland.
  - **AmberFord** — escarpment.
  - **AmberRidge** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O5 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **BlueShelf** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P5 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A6 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **SouthRise** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B6 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Fern 203** — town.
  - **Rain 203** — village.
  - **Fern 203** — river.
  - **Moss 203** — forest.
  - **Moss 203** — gorge.
  - **Rain 203** — river.
  - **Rain 203** — forest.
  - **Fern 203** — waterfall.
  - **Moss 203** — bay.
  - **Fern 203** — regional road.
  - **Mist 203** — geothermal plant.
  - **Fern 203** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C6 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Fern 203** — town.
  - **Rain 203** — village.
  - **Moss 203** — river.
  - **Emerald 203** — waterfall.
  - **Emerald 203** — river.
  - **Fern 203** — forest.
  - **Rain 203** — forest.
  - **Mist 203** — river.
  - **Moss 203** — river.
  - **Fern 203** — regional road.
  - **Emerald 203** — hydro works.
  - **Fern 203** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D6 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mist 203** — town.
  - **Moss 203** — village.
  - **Fern 203** — gorge.
  - **Rain 203** — forest.
  - **Mist 203** — forest.
  - **Rain 203** — gorge.
  - **Fern 203** — bay.
  - **Mist 203** — forest.
  - **Mist 203** — river.
  - **Rain 203** — regional road.
  - **Fern 203** — tunnel.
  - **Moss 203** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E6 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Serac 203** — village.
  - **White 203** — pass.
  - **White 203** — valley.
  - **Grey 203** — pass.
  - **Serac 203** — ridge.
  - **Serac 203** — ridge.
  - **White 203** — ridge.
  - **Frost 203** — peak.
  - **Grey 203** — glacier.
  - **Aurel 203** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F6 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Serac 203** — village.
  - **White 203** — alpine lake.
  - **Frost 203** — glacier.
  - **Grey 203** — ridge.
  - **Grey 203** — glacier.
  - **Frost 203** — glacier.
  - **Serac 203** — valley.
  - **Aurel 203** — glacier.
  - **Frost 203** — pass.
  - **Grey 203** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G6 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 203** — village.
  - **Aurel 203** — peak.
  - **Grey 203** — valley.
  - **White 203** — pass.
  - **Frost 203** — pass.
  - **Aurel 203** — pass.
  - **Frost 203** — valley.
  - **White 203** — ridge.
  - **Serac 203** — alpine lake.
  - **Frost 203** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H6 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Valedor — 1.18m** — major city.
  - **Willow 203** — village.
  - **Meadow 203** — village.
  - **River 203** — village.
  - **Vale 203** — village.
  - **River 203** — meadow.
  - **Meadow 203** — river.
  - **River 203** — lake.
  - **Golden 203** — wetland.
  - **Vale 203** — wetland.
  - **Golden 203** — regional road.
  - **Vale 203** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I6 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Golden 203** — town.
  - **Vale 203** — village.
  - **Willow 203** — village.
  - **Willow 203** — village.
  - **Willow 203** — lake.
  - **Meadow 203** — woodland.
  - **River 203** — wetland.
  - **Vale 203** — meadow.
  - **Golden 203** — river.
  - **River 203** — regional road.
  - **Golden 203** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J6 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Golden 203** — town.
  - **Golden 203** — village.
  - **Willow 203** — village.
  - **River 203** — village.
  - **Meadow 203** — lake.
  - **Meadow 203** — woodland.
  - **Willow 203** — lake.
  - **River 203** — wetland.
  - **Meadow 203** — woodland.
  - **River 203** — regional road.
  - **Golden 203** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K6 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **ObsidianLake** — town.
  - **NyxPeak** — village.
  - **EmberBasin** — geothermal field.
  - **AshBasin** — geothermal field.
  - **NyxBasin** — caldera.
  - **Ash 208** — volcano.
  - **Ember 208** — caldera.
  - **Nyx 208** — caldera.
  - **Obsidian 208** — volcano.
  - **Obsidian 208** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L6 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Ember — 220k** — major city.
  - **Ember 208** — village.
  - **Obsidian 208** — village.
  - **Nyx 208** — lava field.
  - **Obsidian 208** — geothermal field.
  - **Ash 208** — caldera.
  - **Cinder 208** — lava field.
  - **Nyx 208** — geothermal field.
  - **Ember 208** — volcano.
  - **Ash 208** — geothermal field.
  - **Cinder 208** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M6 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **SunCross** — town.
  - **KaenFord** — village.
  - **CopperPlain** — ridge.
  - **CopperFord** — dry lake.
  - **AmberRun** — escarpment.
  - **KaenRidge** — escarpment.
  - **AmberPlain** — ridge.
  - **KaenPlain** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N6 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **SunFord** — town.
  - **WindRun** — village.
  - **KaenCross** — dry lake.
  - **SunPlain** — ridge.
  - **AmberCross** — escarpment.
  - **KaenRun** — escarpment.
  - **Kaen 222** — dry lake.
  - **Kaen 222** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O6 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Wind 222** — town.
  - **Sun 222** — village.
  - **Wind 222** — seasonal river.
  - **Sun 222** — grassland.
  - **Amber 222** — grassland.
  - **Kaen 222** — dry lake.
  - **Amber 222** — grassland.
  - **Copper 222** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P6 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A7 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **PelotoniaShelf** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B7 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mist 223** — town.
  - **Rain 223** — village.
  - **Fern 223** — river.
  - **Rain 223** — bay.
  - **Moss 223** — waterfall.
  - **Emerald 223** — forest.
  - **Moss 223** — bay.
  - **Fern 223** — bay.
  - **Rain 223** — bay.
  - **Rain 223** — regional road.
  - **Mist 223** — viaduct.
  - **Moss 223** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C7 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Moss 223** — town.
  - **Mist 223** — village.
  - **Rain 223** — forest.
  - **Emerald 223** — forest.
  - **Mist 223** — waterfall.
  - **Emerald 223** — bay.
  - **Mist 223** — river.
  - **Fern 223** — gorge.
  - **Mist 223** — forest.
  - **Rain 223** — regional road.
  - **Moss 223** — viaduct.
  - **Moss 223** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D7 — Rainforest Belt
- **Physical character:** warm rainforest; elevation 0–1,650 m. Dominant region: Rainforest Belt.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **OrchidPool** — town.
  - **MaraGrove** — village.
  - **MaraPool** — waterfall.
  - **MaraRiver** — rainforest.
  - **OrchidBay** — lagoon.
  - **CanopyFall** — rainforest.
  - **CanopyGrove** — waterfall.
  - **JadePool** — lagoon.
  - **OrchidGrove** — waterfall.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E7 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **White 232** — village.
  - **Aurel 232** — alpine lake.
  - **Aurel 232** — ridge.
  - **White 232** — ridge.
  - **Frost 232** — pass.
  - **White 232** — peak.
  - **White 232** — peak.
  - **Frost 232** — valley.
  - **White 232** — valley.
  - **Aurel 232** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F7 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Serac 232** — village.
  - **Aurel 232** — ridge.
  - **Aurel 232** — alpine lake.
  - **Aurel 232** — valley.
  - **Aurel 232** — alpine lake.
  - **Grey 232** — valley.
  - **White 232** — pass.
  - **White 232** — valley.
  - **Grey 232** — peak.
  - **Aurel 232** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G7 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Golden 232** — town.
  - **Vale 232** — village.
  - **Willow 232** — village.
  - **Vale 232** — village.
  - **Vale 232** — wetland.
  - **River 232** — river.
  - **Willow 232** — meadow.
  - **Meadow 232** — river.
  - **Meadow 232** — meadow.
  - **Willow 232** — regional road.
  - **River 232** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H7 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **River 232** — town.
  - **Willow 232** — village.
  - **River 232** — village.
  - **Willow 232** — village.
  - **Golden 232** — wetland.
  - **Vale 232** — woodland.
  - **Vale 232** — meadow.
  - **Vale 232** — woodland.
  - **Vale 232** — river.
  - **River 232** — regional road.
  - **Golden 232** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I7 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Willow 232** — town.
  - **Vale 232** — village.
  - **Willow 232** — village.
  - **Golden 232** — village.
  - **Meadow 232** — wetland.
  - **River 232** — wetland.
  - **Meadow 232** — wetland.
  - **River 232** — river.
  - **Golden 232** — lake.
  - **Vale 232** — regional road.
  - **Golden 232** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J7 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Willow 232** — town.
  - **Golden 232** — village.
  - **Vale 232** — village.
  - **Meadow 232** — village.
  - **River 232** — lake.
  - **Golden 232** — lake.
  - **Vale 232** — woodland.
  - **Willow 232** — river.
  - **Meadow 232** — meadow.
  - **Meadow 232** — regional road.
  - **River 232** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K7 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Nyx 232** — town.
  - **Ember 232** — village.
  - **Obsidian 232** — hot spring.
  - **Ember 232** — volcano.
  - **Obsidian 232** — volcano.
  - **Ember 232** — geothermal field.
  - **Ember 232** — caldera.
  - **Ash 232** — geothermal field.
  - **Cinder 232** — hot spring.
  - **Ember 232** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L7 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaen 232** — town.
  - **Kaen 232** — village.
  - **Sun 232** — dry lake.
  - **Copper 232** — seasonal river.
  - **Copper 232** — seasonal river.
  - **Amber 232** — dry lake.
  - **Copper 232** — seasonal river.
  - **Wind 232** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M7 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Sun 232** — town.
  - **Sun 232** — village.
  - **Kaen 232** — dry lake.
  - **Kaen 232** — dry lake.
  - **Copper 232** — seasonal river.
  - **Copper 232** — seasonal river.
  - **Wind 232** — grassland.
  - **Wind 232** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N7 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaen — 510k** — major city.
  - **Amber 232** — village.
  - **Copper 232** — village.
  - **Copper 232** — dry lake.
  - **Wind 232** — dry lake.
  - **Kaen 232** — escarpment.
  - **Kaen 232** — dry lake.
  - **Kaen 232** — grassland.
  - **Wind 232** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O7 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaen 232** — town.
  - **Wind 232** — village.
  - **Kaen 232** — ridge.
  - **Copper 232** — grassland.
  - **Amber 232** — seasonal river.
  - **Wind 232** — grassland.
  - **Kaen 232** — dry lake.
  - **Kaen 232** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P7 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **BlueShoal** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A8 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **OuterTrench** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B8 — Emerald Coast
- **Physical character:** hyper-wet oceanic forest; elevation 0–1,900 m. Dominant region: Emerald Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Fern 234** — town.
  - **Rain 234** — village.
  - **Rain 234** — river.
  - **Rain 234** — waterfall.
  - **Fern 234** — forest.
  - **Mist 234** — river.
  - **Mist 234** — river.
  - **Moss 234** — gorge.
  - **Emerald 234** — bay.
  - **Mist 234** — regional road.
  - **Fern 234** — viaduct.
  - **Mist 234** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C8 — Rainforest Belt
- **Physical character:** warm rainforest; elevation 0–1,650 m. Dominant region: Rainforest Belt.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **VerdantFall** — town.
  - **MaraBay** — village.
  - **JadeBay** — waterfall.
  - **OrchidFall** — river.
  - **CanopyPool** — river.
  - **VerdantGrove** — waterfall.
  - **JadeGrove** — rainforest.
  - **CanopyRiver** — lagoon.
  - **CanopyBay** — lagoon.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D8 — Rainforest Belt
- **Physical character:** warm rainforest; elevation 0–1,650 m. Dominant region: Rainforest Belt.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **VerdantRiver** — town.
  - **MaraFall** — village.
  - **JadeRiver** — river.
  - **JadeFall** — river.
  - **OrchidRiver** — wetland.
  - **VerdantPool** — river.
  - **VerdantBay** — waterfall.
  - **Orchid 250** — river.
  - **Mara 250** — river.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E8 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 250** — village.
  - **Aurel 250** — valley.
  - **Serac 250** — peak.
  - **White 250** — alpine lake.
  - **Frost 250** — glacier.
  - **Grey 250** — ridge.
  - **Frost 250** — peak.
  - **Serac 250** — pass.
  - **White 250** — peak.
  - **Aurel 250** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F8 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Vale 250** — town.
  - **Meadow 250** — village.
  - **Golden 250** — village.
  - **River 250** — village.
  - **Golden 250** — wetland.
  - **Meadow 250** — lake.
  - **Meadow 250** — river.
  - **Golden 250** — lake.
  - **Willow 250** — woodland.
  - **Meadow 250** — regional road.
  - **River 250** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G8 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Meadow 250** — town.
  - **Vale 250** — village.
  - **Willow 250** — village.
  - **River 250** — village.
  - **Meadow 250** — river.
  - **Golden 250** — meadow.
  - **Willow 250** — woodland.
  - **Meadow 250** — river.
  - **Vale 250** — lake.
  - **Willow 250** — regional road.
  - **Willow 250** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H8 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Willow 250** — town.
  - **Meadow 250** — village.
  - **Vale 250** — village.
  - **River 250** — village.
  - **Meadow 250** — woodland.
  - **Meadow 250** — woodland.
  - **Golden 250** — wetland.
  - **River 250** — meadow.
  - **River 250** — woodland.
  - **Vale 250** — regional road.
  - **Meadow 250** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I8 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Vale 250** — town.
  - **Willow 250** — village.
  - **Golden 250** — village.
  - **River 250** — village.
  - **Vale 250** — river.
  - **Meadow 250** — meadow.
  - **River 250** — meadow.
  - **Willow 250** — river.
  - **Golden 250** — meadow.
  - **River 250** — regional road.
  - **Golden 250** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J8 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Obsidian 250** — town.
  - **Ash 250** — village.
  - **Nyx 250** — caldera.
  - **Obsidian 250** — lava field.
  - **Ember 250** — volcano.
  - **Obsidian 250** — hot spring.
  - **Ember 250** — lava field.
  - **Obsidian 250** — caldera.
  - **Cinder 250** — lava field.
  - **Ash 250** — geothermal plant.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K8 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Obsidian 250** — town.
  - **Obsidian 250** — village.
  - **Cinder 250** — hot spring.
  - **Nyx 250** — geothermal field.
  - **Cinder 250** — geothermal field.
  - **Obsidian 250** — hot spring.
  - **Ash 250** — volcano.
  - **Nyx 250** — caldera.
  - **Cinder 250** — hot spring.
  - **Ember 250** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L8 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Wind 250** — town.
  - **Copper 250** — village.
  - **Wind 250** — ridge.
  - **Sun 250** — ridge.
  - **Sun 250** — grassland.
  - **Kaen 250** — escarpment.
  - **Kaen 250** — escarpment.
  - **Amber 250** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M8 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Wind 250** — town.
  - **Copper 250** — village.
  - **Kaen 250** — escarpment.
  - **Wind 250** — ridge.
  - **Amber 250** — grassland.
  - **Copper 250** — grassland.
  - **Kaen 250** — seasonal river.
  - **Wind 250** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N8 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **CopperCanyon** — village.
  - **DustWash** — salt flat.
  - **CopperWell** — wadi.
  - **MesaMesa** — canyon.
  - **CopperFlat** — salt flat.
  - **MesaFlat** — salt flat.
  - **MesaWell** — mesa.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O8 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **DustWell** — village.
  - **DustCanyon** — canyon.
  - **CopperMesa** — wadi.
  - **SaltWell** — canyon.
  - **SaltFlat** — mesa.
  - **DustMesa** — wadi.
  - **MesaCanyon** — mesa.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P8 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **PelotoniaBank** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A9 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **BlueRise** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B9 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **TernFjord** — village.
  - **IcePoint** — peak.
  - **FjordHaven** — fjord.
  - **FjordSound** — sound.
  - **IceBay** — peak.
  - **FjordPoint** — peak.
  - **GreyFjord** — glacier.
  - **GreySound** — waterfall.
  - **FjordFjord** — viaduct.
  - **IceHaven** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C9 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Greenfall — 390k** — major city.
  - **SouthFjord** — village.
  - **SouthBay** — waterfall.
  - **TernSound** — peak.
  - **IceFjord** — sound.
  - **FjordBay** — waterfall.
  - **IceSound** — waterfall.
  - **SouthSound** — waterfall.
  - **SouthHaven** — fjord.
  - **SouthPoint** — viaduct.
  - **South 285** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D9 — Rainforest Belt
- **Physical character:** warm rainforest; elevation 0–1,650 m. Dominant region: Rainforest Belt.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Jade 285** — town.
  - **Canopy 285** — village.
  - **Jade 285** — rainforest.
  - **Orchid 285** — waterfall.
  - **Orchid 285** — rainforest.
  - **Orchid 285** — waterfall.
  - **Jade 285** — river.
  - **Mara 285** — river.
  - **Mara 285** — rainforest.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E9 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 285** — village.
  - **Serac 285** — glacier.
  - **Frost 285** — peak.
  - **Aurel 285** — alpine lake.
  - **Frost 285** — alpine lake.
  - **Serac 285** — valley.
  - **Aurel 285** — peak.
  - **White 285** — pass.
  - **Aurel 285** — ridge.
  - **Serac 285** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F9 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Golden 285** — town.
  - **Golden 285** — village.
  - **Golden 285** — village.
  - **Golden 285** — village.
  - **Willow 285** — meadow.
  - **Golden 285** — wetland.
  - **Vale 285** — wetland.
  - **River 285** — wetland.
  - **River 285** — lake.
  - **Vale 285** — regional road.
  - **Golden 285** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G9 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **River 285** — town.
  - **Willow 285** — village.
  - **Vale 285** — village.
  - **River 285** — village.
  - **Meadow 285** — meadow.
  - **Golden 285** — lake.
  - **Willow 285** — meadow.
  - **Meadow 285** — woodland.
  - **Willow 285** — lake.
  - **Vale 285** — regional road.
  - **Vale 285** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H9 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Willow 285** — town.
  - **Golden 285** — village.
  - **Golden 285** — village.
  - **Meadow 285** — village.
  - **Meadow 285** — woodland.
  - **Vale 285** — woodland.
  - **Meadow 285** — woodland.
  - **Vale 285** — meadow.
  - **Meadow 285** — wetland.
  - **Meadow 285** — regional road.
  - **Meadow 285** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I9 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Willow 285** — town.
  - **Willow 285** — village.
  - **Meadow 285** — village.
  - **Vale 285** — village.
  - **Willow 285** — lake.
  - **River 285** — lake.
  - **River 285** — lake.
  - **Willow 285** — river.
  - **Golden 285** — woodland.
  - **River 285** — regional road.
  - **Willow 285** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J9 — Volcanic Basin
- **Physical character:** volcanic/geothermal; elevation 250–2,700 m. Dominant region: Volcanic Basin.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Ember 285** — town.
  - **Ember 285** — village.
  - **Obsidian 285** — caldera.
  - **Nyx 285** — caldera.
  - **Cinder 285** — caldera.
  - **Nyx 285** — hot spring.
  - **Nyx 285** — geothermal field.
  - **Obsidian 285** — geothermal field.
  - **Ember 285** — caldera.
  - **Nyx 285** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K9 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Wind 285** — town.
  - **Sun 285** — village.
  - **Wind 285** — ridge.
  - **Amber 285** — ridge.
  - **Copper 285** — grassland.
  - **Amber 285** — ridge.
  - **Kaen 285** — grassland.
  - **Amber 285** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L9 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaen 285** — town.
  - **Sun 285** — village.
  - **Kaen 285** — seasonal river.
  - **Amber 285** — dry lake.
  - **Amber 285** — grassland.
  - **Sun 285** — grassland.
  - **Sun 285** — seasonal river.
  - **Wind 285** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M9 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **RedWell** — village.
  - **RedCanyon** — natural arch.
  - **MesaWash** — mesa.
  - **RedWash** — mesa.
  - **RedMesa** — natural arch.
  - **CopperWash** — wadi.
  - **SaltCanyon** — salt flat.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N9 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **DustFlat** — village.
  - **SaltMesa** — salt flat.
  - **SaltWash** — natural arch.
  - **RedFlat** — wadi.
  - **Copper 296** — mesa.
  - **Dust 296** — mesa.
  - **Dust 296** — natural arch.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O9 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Red 296** — village.
  - **Copper 296** — wadi.
  - **Copper 296** — canyon.
  - **Red 296** — natural arch.
  - **Copper 296** — mesa.
  - **Salt 296** — salt flat.
  - **Salt 296** — canyon.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P9 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **MaraKey** — town.
  - **CoralReef** — village.
  - **CoralHaven** — village.
  - **TernKey** — channel.
  - **AzureIsle** — headland.
  - **AzureBay** — headland.
  - **BeaconKey** — lagoon.
  - **MaraHaven** — island.
  - **BeaconReef** — reef.
  - **AzureHaven** — headland.
  - **CoralIsle** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A10 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **PelotoniaTrench** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B10 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Ice 308** — village.
  - **Grey 308** — glacier.
  - **Grey 308** — sound.
  - **Grey 308** — glacier.
  - **Tern 308** — peak.
  - **South 308** — sound.
  - **Grey 308** — waterfall.
  - **Fjord 308** — fjord.
  - **Fjord 308** — hydro works.
  - **Tern 308** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C10 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Tern 308** — village.
  - **Fjord 308** — fjord.
  - **Fjord 308** — fjord.
  - **Fjord 308** — waterfall.
  - **Grey 308** — waterfall.
  - **Ice 308** — fjord.
  - **Fjord 308** — glacier.
  - **Grey 308** — peak.
  - **Grey 308** — tunnel.
  - **Ice 308** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D10 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Tern 308** — village.
  - **Fjord 308** — peak.
  - **Ice 308** — fjord.
  - **Grey 308** — waterfall.
  - **South 308** — glacier.
  - **Grey 308** — sound.
  - **Grey 308** — fjord.
  - **South 308** — fjord.
  - **Ice 308** — hydro works.
  - **Tern 308** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E10 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Grey 308** — village.
  - **Aurel 308** — pass.
  - **Aurel 308** — ridge.
  - **Serac 308** — pass.
  - **Grey 308** — ridge.
  - **Frost 308** — ridge.
  - **Aurel 308** — pass.
  - **Grey 308** — ridge.
  - **Frost 308** — ridge.
  - **Frost 308** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F10 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurel 308** — village.
  - **Frost 308** — pass.
  - **Aurel 308** — glacier.
  - **Serac 308** — glacier.
  - **White 308** — alpine lake.
  - **White 308** — ridge.
  - **Aurel 308** — alpine lake.
  - **Serac 308** — alpine lake.
  - **Aurel 308** — valley.
  - **White 308** — tunnel.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G10 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Vale 308** — town.
  - **Golden 308** — village.
  - **Meadow 308** — village.
  - **Meadow 308** — village.
  - **Vale 308** — river.
  - **Willow 308** — meadow.
  - **River 308** — wetland.
  - **River 308** — meadow.
  - **Meadow 308** — lake.
  - **Willow 308** — regional road.
  - **River 308** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H10 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Meadow 308** — town.
  - **Willow 308** — village.
  - **Willow 308** — village.
  - **River 308** — village.
  - **Meadow 308** — meadow.
  - **Meadow 308** — wetland.
  - **Golden 308** — lake.
  - **Willow 308** — river.
  - **Golden 308** — woodland.
  - **River 308** — regional road.
  - **Meadow 308** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I10 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurelia — 2.45m metro** — major city.
  - **Vale 308** — village.
  - **River 308** — village.
  - **River 308** — village.
  - **River 308** — village.
  - **Vale 308** — river.
  - **River 308** — river.
  - **Meadow 308** — river.
  - **Meadow 308** — meadow.
  - **Meadow 308** — lake.
  - **Meadow 308** — regional road.
  - **Golden 308** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J10 — Central Plains
- **Physical character:** fertile temperate lowland; elevation 40–850 m. Dominant region: Central Plains.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **River 308** — town.
  - **Willow 308** — village.
  - **Meadow 308** — village.
  - **Vale 308** — village.
  - **Willow 308** — woodland.
  - **Willow 308** — wetland.
  - **Golden 308** — wetland.
  - **Meadow 308** — river.
  - **Golden 308** — wetland.
  - **River 308** — regional road.
  - **Willow 308** — rail corridor.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K10 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Copper 308** — town.
  - **Sun 308** — village.
  - **Kaen 308** — escarpment.
  - **Amber 308** — escarpment.
  - **Amber 308** — escarpment.
  - **Kaen 308** — ridge.
  - **Kaen 308** — grassland.
  - **Copper 308** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L10 — Eastern Steppe
- **Physical character:** dry steppe; elevation 250–1,250 m. Dominant region: Eastern Steppe.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Kaen 308** — town.
  - **Sun 308** — village.
  - **Kaen 308** — escarpment.
  - **Copper 308** — escarpment.
  - **Sun 308** — grassland.
  - **Copper 308** — seasonal river.
  - **Copper 308** — seasonal river.
  - **Wind 308** — regional road.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M10 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mesa 308** — village.
  - **Mesa 308** — canyon.
  - **Dust 308** — natural arch.
  - **Copper 308** — wadi.
  - **Red 308** — salt flat.
  - **Salt 308** — natural arch.
  - **Dust 308** — canyon.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N10 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mesa 308** — village.
  - **Salt 308** — wadi.
  - **Red 308** — mesa.
  - **Copper 308** — canyon.
  - **Mesa 308** — wadi.
  - **Red 308** — mesa.
  - **Salt 308** — salt flat.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O10 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Copper 308** — village.
  - **Mesa 308** — mesa.
  - **Copper 308** — wadi.
  - **Red 308** — canyon.
  - **Red 308** — wadi.
  - **Salt 308** — salt flat.
  - **Copper 308** — mesa.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P10 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **MaraReef** — town.
  - **BeaconHaven** — village.
  - **TernIsle** — village.
  - **BeaconBay** — reef.
  - **BeaconIsle** — reef.
  - **AzureReef** — lagoon.
  - **TernReef** — reef.
  - **MaraIsle** — island.
  - **CoralKey** — channel.
  - **AzureKey** — headland.
  - **CoralBay** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A11 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **DeepRise** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B11 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 320** — village.
  - **South 320** — sound.
  - **Tern 320** — sound.
  - **Ice 320** — fjord.
  - **Grey 320** — glacier.
  - **Ice 320** — waterfall.
  - **South 320** — glacier.
  - **Ice 320** — glacier.
  - **Ice 320** — geothermal plant.
  - **South 320** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C11 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 320** — village.
  - **Fjord 320** — sound.
  - **Ice 320** — waterfall.
  - **Fjord 320** — peak.
  - **Grey 320** — waterfall.
  - **Tern 320** — sound.
  - **Tern 320** — waterfall.
  - **Tern 320** — peak.
  - **South 320** — viaduct.
  - **Ice 320** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D11 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Tern 320** — village.
  - **Tern 320** — sound.
  - **Tern 320** — waterfall.
  - **Tern 320** — fjord.
  - **Grey 320** — waterfall.
  - **Grey 320** — peak.
  - **Fjord 320** — waterfall.
  - **Grey 320** — fjord.
  - **Grey 320** — tunnel.
  - **South 320** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E11 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 320** — village.
  - **Fjord 320** — waterfall.
  - **Ice 320** — sound.
  - **Tern 320** — fjord.
  - **Tern 320** — waterfall.
  - **Fjord 320** — fjord.
  - **Tern 320** — glacier.
  - **Tern 320** — fjord.
  - **South 320** — geothermal plant.
  - **South 320** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F11 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurel 320** — village.
  - **Grey 320** — pass.
  - **Aurel 320** — glacier.
  - **Frost 320** — alpine lake.
  - **White 320** — pass.
  - **Aurel 320** — alpine lake.
  - **Aurel 320** — valley.
  - **Aurel 320** — peak.
  - **Frost 320** — pass.
  - **Aurel 320** — hydro works.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G11 — Great Range
- **Physical character:** alpine/glacial; elevation 700–4,372 m. Dominant region: Great Range.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Frost 320** — village.
  - **Grey 320** — valley.
  - **Aurel 320** — valley.
  - **Grey 320** — pass.
  - **Grey 320** — valley.
  - **White 320** — alpine lake.
  - **Serac 320** — glacier.
  - **Aurel 320** — peak.
  - **White 320** — valley.
  - **Grey 320** — viaduct.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H11 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **BayBridge** — town.
  - **AurelShore** — village.
  - **OlivePort** — village.
  - **AurelBay** — village.
  - **CedarShore** — coastal hills.
  - **AurelPort** — bay.
  - **OliveBay** — wetland.
  - **CedarBridge** — river.
  - **SouthPort** — coastal hills.
  - **OliveBridge** — regional road.
  - **BayBay** — rail corridor.
  - **OliveHaven** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I11 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **CedarBay** — town.
  - **AurelBridge** — village.
  - **SouthBridge** — village.
  - **BayShore** — village.
  - **BayPort** — estuary.
  - **SouthShore** — bay.
  - **CedarPort** — bay.
  - **CedarHaven** — estuary.
  - **OliveShore** — coastal hills.
  - **AurelHaven** — regional road.
  - **BayHaven** — rail corridor.
  - **Bay 343** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J11 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Southport — 280k** — major city.
  - **Aurel 343** — village.
  - **Cedar 343** — village.
  - **Bay 343** — village.
  - **Bay 343** — village.
  - **Aurel 343** — bay.
  - **Cedar 343** — estuary.
  - **South 343** — river.
  - **Cedar 343** — coastal hills.
  - **Aurel 343** — estuary.
  - **South 343** — regional road.
  - **Olive 343** — rail corridor.
  - **Olive 343** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K11 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 343** — town.
  - **Aurel 343** — village.
  - **Aurel 343** — village.
  - **Bay 343** — village.
  - **Olive 343** — river.
  - **Aurel 343** — estuary.
  - **Cedar 343** — river.
  - **Bay 343** — coastal hills.
  - **Olive 343** — estuary.
  - **South 343** — regional road.
  - **South 343** — rail corridor.
  - **Aurel 343** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L11 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Salt 343** — village.
  - **Red 343** — mesa.
  - **Mesa 343** — wadi.
  - **Copper 343** — canyon.
  - **Red 343** — wadi.
  - **Copper 343** — natural arch.
  - **Dust 343** — mesa.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M11 — Redlands
- **Physical character:** hot arid plateau; elevation 0–1,450 m. Dominant region: Redlands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Red 343** — village.
  - **Salt 343** — wadi.
  - **Dust 343** — salt flat.
  - **Red 343** — salt flat.
  - **Salt 343** — mesa.
  - **Red 343** — salt flat.
  - **Dust 343** — salt flat.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N11 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Azure 343** — town.
  - **Beacon 343** — village.
  - **Tern 343** — village.
  - **Coral 343** — reef.
  - **Azure 343** — lagoon.
  - **Beacon 343** — reef.
  - **Azure 343** — lagoon.
  - **Mara 343** — channel.
  - **Mara 343** — channel.
  - **Beacon 343** — channel.
  - **Mara 343** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O11 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Coral 343** — town.
  - **Beacon 343** — village.
  - **Azure 343** — village.
  - **Coral 343** — channel.
  - **Coral 343** — lagoon.
  - **Mara 343** — channel.
  - **Tern 343** — reef.
  - **Azure 343** — island.
  - **Coral 343** — headland.
  - **Mara 343** — channel.
  - **Coral 343** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P11 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Mara 343** — town.
  - **Mara 343** — village.
  - **Azure 343** — village.
  - **Beacon 343** — reef.
  - **Mara 343** — island.
  - **Coral 343** — channel.
  - **Tern 343** — channel.
  - **Beacon 343** — channel.
  - **Mara 343** — island.
  - **Beacon 343** — channel.
  - **Azure 343** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### A12 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **SouthShelf** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### B12 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **BlueBank** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### C12 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Fjord 345** — village.
  - **South 345** — waterfall.
  - **Fjord 345** — waterfall.
  - **Fjord 345** — fjord.
  - **Fjord 345** — fjord.
  - **Fjord 345** — glacier.
  - **Ice 345** — sound.
  - **South 345** — glacier.
  - **South 345** — viaduct.
  - **Tern 345** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### D12 — Southern Fjords
- **Physical character:** cool wet fjordland; elevation 0–2,900 m. Dominant region: Southern Fjords.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Fjord 345** — village.
  - **Ice 345** — fjord.
  - **South 345** — glacier.
  - **Ice 345** — waterfall.
  - **South 345** — sound.
  - **South 345** — waterfall.
  - **South 345** — waterfall.
  - **Fjord 345** — fjord.
  - **Grey 345** — geothermal plant.
  - **Ice 345** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### E12 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### F12 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:** intentionally sparse open ocean.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### G12 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurel 345** — town.
  - **Aurel 345** — village.
  - **South 345** — village.
  - **Aurel 345** — village.
  - **Olive 345** — river.
  - **Bay 345** — estuary.
  - **Bay 345** — bay.
  - **Bay 345** — wetland.
  - **Cedar 345** — estuary.
  - **Olive 345** — regional road.
  - **Aurel 345** — rail corridor.
  - **Cedar 345** — harbour.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### H12 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 345** — town.
  - **Bay 345** — village.
  - **Olive 345** — village.
  - **South 345** — village.
  - **South 345** — river.
  - **Olive 345** — wetland.
  - **Olive 345** — estuary.
  - **South 345** — estuary.
  - **Aurel 345** — wetland.
  - **Aurel 345** — regional road.
  - **Bay 345** — rail corridor.
  - **South 345** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### I12 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **South 345** — town.
  - **Aurel 345** — village.
  - **South 345** — village.
  - **South 345** — village.
  - **Bay 345** — bay.
  - **Bay 345** — estuary.
  - **Aurel 345** — bay.
  - **Aurel 345** — river.
  - **Cedar 345** — estuary.
  - **Aurel 345** — regional road.
  - **Cedar 345** — rail corridor.
  - **South 345** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### J12 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Olive 345** — town.
  - **Bay 345** — village.
  - **Olive 345** — village.
  - **Olive 345** — village.
  - **Aurel 345** — river.
  - **Aurel 345** — estuary.
  - **Aurel 345** — bay.
  - **South 345** — estuary.
  - **South 345** — river.
  - **Aurel 345** — regional road.
  - **Aurel 345** — rail corridor.
  - **Cedar 345** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### K12 — Southern Coast
- **Physical character:** mild maritime lowland; elevation 0–700 m. Dominant region: Southern Coast.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Aurel 345** — town.
  - **Olive 345** — village.
  - **Olive 345** — village.
  - **South 345** — village.
  - **Bay 345** — bay.
  - **Cedar 345** — bay.
  - **Bay 345** — wetland.
  - **Aurel 345** — wetland.
  - **Olive 345** — estuary.
  - **Aurel 345** — regional road.
  - **South 345** — rail corridor.
  - **Cedar 345** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### L12 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Coral 345** — town.
  - **Coral 345** — village.
  - **Coral 345** — village.
  - **Azure 345** — lagoon.
  - **Coral 345** — headland.
  - **Mara 345** — reef.
  - **Mara 345** — island.
  - **Coral 345** — lagoon.
  - **Azure 345** — lagoon.
  - **Tern 345** — channel.
  - **Beacon 345** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### M12 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Tern 345** — town.
  - **Azure 345** — village.
  - **Tern 345** — village.
  - **Coral 345** — island.
  - **Tern 345** — reef.
  - **Tern 345** — island.
  - **Azure 345** — island.
  - **Tern 345** — reef.
  - **Mara 345** — channel.
  - **Mara 345** — island.
  - **Mara 345** — ferry landing.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### N12 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Beacon 345** — town.
  - **Coral 345** — village.
  - **Tern 345** — village.
  - **Mara 345** — headland.
  - **Azure 345** — reef.
  - **Tern 345** — reef.
  - **Tern 345** — channel.
  - **Coral 345** — lagoon.
  - **Beacon 345** — lagoon.
  - **Coral 345** — reef.
  - **Azure 345** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### O12 — Southeastern Islands
- **Physical character:** warm archipelago; elevation 0–650 m. Dominant region: Southeastern Islands.
- **Continuity:** transition gradually into neighboring cells; continuous rivers/ranges/roads must share geometry at borders.
- **L2 named objects:**
  - **Coral 345** — town.
  - **Azure 345** — village.
  - **Coral 345** — village.
  - **Beacon 345** — reef.
  - **Azure 345** — headland.
  - **Mara 345** — headland.
  - **Tern 345** — lagoon.
  - **Azure 345** — headland.
  - **Beacon 345** — channel.
  - **Tern 345** — headland.
  - **Coral 345** — lighthouse.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

### P12 — Ocean
- **Physical character:** South Pacific marine cell. Bathymetry, currents and shelf/reef form must remain coherent with adjacent coastline.
- **L2 named objects:**
  - **Pelotonia 345** — marine feature.
- **Zoom:** all listed objects visible/selectable at L2 where appropriate; settlements and major natural/engineering features must expose L3; major landmarks may expose L4.

## 7. Codex implementation requirements

1. Reconcile this specification with existing `Pelotonia World 1.0`; never duplicate an existing object because this document repeats it.
2. Preserve all existing stable IDs. Assign stable IDs to every new object. Display names must remain independently editable.
3. Convert generated working objects into the repository's existing world-data schema rather than inventing a parallel schema.
4. Validate all 192 macro cells, parent references, region references, zoom ranges and geometry.
5. Build continuous national networks before finalising per-cell geometry: watersheds/rivers, mountain systems, major roads, rail, ferry links and settlement corridors.
6. A road/river/range leaving one cell must enter the appropriate adjacent cell. No discontinuous network fragments.
7. Do not make every cell equally busy. Dense urban cells may contain many more objects; wilderness and ocean cells should retain meaningful emptiness.
8. Expand major cities below Aurelia with their own L3 district structure when useful. Do not clone Aurelia's district layout.
9. Deep-zoom natural landmarks as well as cities: caldera, glaciers, major waterfalls, Red Canyon, Great Escarpment, islands, dams/bridges if canonised.
10. Do not invent historical/political lore merely to fill fields.
11. Do not add cycling routes or cycling-specific POIs.
12. The atlas renderer should ultimately be data-driven; this task is world content first.
13. Add tests for duplicate IDs, broken references, invalid grids, impossible zoom ranges, discontinuous network references and orphaned L3/L4 children.
14. Run lint/tests/full production build.
15. Work on the safe recovery/development branch; no destructive production database changes.

## 8. Detail-depth target

This specification deliberately supplies the national structure plus roughly 1,500 working named L2 objects. It is the **minimum complete-country pass**, not the end of worldbuilding.

When implementing, preserve the following depth principle:

- **L1:** national-scale geography, major cities and nationally significant infrastructure.
- **L2:** all macro cells have their own named physical/human objects.
- **L3:** every meaningful settlement and major natural site can reveal local substructure.
- **L4:** nationally/regionally important landmarks can reveal site-level components.

Aurelia is the reference vertical slice. Other major cities and signature natural sites should eventually reach comparable structural depth, but do not fabricate thousands of meaningless micro-objects merely to hit a quota.

## 9. Acceptance criteria

The implementation is acceptable when:
- all 192 cells exist and validate;
- every land cell has a distinct, named, explorable L2 identity;
- ocean cells are allowed to remain sparse but can contain marine/island features;
- existing World 1.0 objects are preserved;
- all new names can be changed without breaking references;
- cross-cell geography is coherent;
- Aurelia's existing L3/L4 content remains intact;
- the world model can later accept major additions (bridge, dam, new city, observatory, national park, etc.) primarily as data;
- no cycling-specific content has been introduced.
