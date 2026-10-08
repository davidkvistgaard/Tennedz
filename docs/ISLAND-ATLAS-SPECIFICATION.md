Add the following feature package to the existing Pelotonia development backlog. Preserve the priorities and recovery/stability work I have already given you; schedule this appropriately alongside those tasks.
Pelotonia is not merely the name of the cycling manager game. Pelotonia is a fictional sovereign island nation that exists on Earth in the South Pacific.
The game will use real-world countries, real-world-inspired professional cycling events and real nationalities, but Pelotonia gives us a fictional physical world where we can eventually create our own cities, landscapes, infrastructure, climate, events and extreme environments.
For this feature package, do not design cycling routes or cycling gameplay. Build Pelotonia as a country/world first.
The repository already contains Pelotonia World 1.0 with:
-  192 macro-grid cells
-  physical regions
-  mountains
-  lakes
-  river systems
-  natural formations
-  nine major cities
-  Aurelia districts
-  Aurelia landmarks
-  infrastructure concepts
-  stable IDs
-  editable working names
-  zoom-level metadata
Do not replace this architecture with a separate world model. Extend it.
The current rendered Pelotonia map is a visual reference, while the structured world data is the canonical source of truth.
Working names such as Aurelia, Mount Aurelia, Redlands, Emerald Coast, Lake Verdan etc. are intentionally editable. Stable IDs must therefore remain independent of names.
The unresolved P classification in 11 grid cells was an omission in the original specification.
Define it as a 13th physical region:
Stable ID: REG-NORTHERN-PLATEAU
 Working name: Northern Plateau
 Status: canonical_editable
It is elevated transitional country east of the Northern Highlands and north/northeast of the Central Plains:
-  approximately 600–1,400 m elevation
-  cooler and substantially drier than the western highlands
-  open grassland/heath
-  scattered forest
-  broad valleys and ridges rather than alpine terrain
-  upland lakes and river headwaters
-  regular winter snow
-  generally dry mild-to-warm summers at lower elevations
-  relatively low population density
Update the existing 11 P cells and all relevant validation/documentation/tests.
I want Pelotonia eventually to feel like a real explorable country.
The map must support genuine progressive zoom rather than merely enlarging one image.
Show Earth/world context with Pelotonia located in the South Pacific.
Pelotonia should eventually receive real Earth coordinates, but do not falsely represent arbitrary fictional image coordinates as WGS84. Choose and document a sensible South Pacific location if Earth positioning is required for implementation.
Show:
-  entire island
-  surrounding islands
-  major physical regions
-  Great Range
-  Aurelia Icefield
-  major peaks
-  major rivers
-  major lakes
-  Great Caldera
-  Great Escarpment
-  Red Canyon
-  major cities
-  nationally significant infrastructure
This view must remain readable and uncluttered.
Users can select/zoom into any of the A1–P12 macro-grid areas.
Additional details become visible:
-  smaller towns
-  secondary rivers
-  individual mountains
-  forests
-  beaches
-  wetlands
-  roads
-  rail
-  bridges
-  tunnels
-  local natural landmarks
-  urban footprints
The grid is an indexing/data system, not a visual Civilization-style tile system. Geographic features must cross cell boundaries naturally.
At this scale reveal:
-  city districts
-  neighborhoods
-  important streets
-  parks
-  stations
-  harbours
-  individual bridges
-  major public buildings
-  local landmarks
-  villages and local geography
Individual important sites can be explored:
-  Great Cathedral
-  stadiums
-  stations
-  dams
-  bridges
-  volcano observatories
-  museums
-  castles/citadels
-  parks
-  major natural sites
The architecture must allow deeper detail to be added later without rewriting the atlas.
Zooming must reveal new information, not simply make existing labels larger.
Example:
Whole island:
★ Aurelia
Regional zoom:
Aurelia urban footprint, harbour, river, airport, surrounding settlements.
City zoom:
Old Aurelia, Crown District, Central Aurelia, Grand Harbour, Eastbank, Westbank, University Quarter etc.
Local zoom:
streets, parks, squares, stations and landmarks.
Landmark zoom:
Great Cathedral precinct, plaza, gardens and building.
Implement this as a reusable visibility/zoom system driven by world data.
Do not attempt to manually create L4 detail for the entire country immediately.
Instead make Aurelia the first demonstration of the complete hierarchy.
Aurelia:
-  capital
-  ~2.45m metropolitan population
-  primarily I10/J10
-  south-central coast
-  large river/estuary
-  natural bay
-  hills north/west
-  major harbour
-  international airport
-  national transport connections
Existing working districts:
-  AUR-01 Old Aurelia
-  AUR-02 Crown District
-  AUR-03 Central Aurelia
-  AUR-04 Grand Harbour
-  AUR-05 Eastbank
-  AUR-06 Westbank
-  AUR-07 University Quarter
-  AUR-08 South Shore
-  AUR-09 Ironworks
-  AUR-10 North Gardens
-  AUR-11 Rivergate
-  AUR-12 Heights
-  AUR-13 Airport Coast
-  AUR-14 Outer Aurelia
Use the existing stable IDs.
The city should feel geographically coherent rather than like 14 arbitrary polygons.
AUR-LMK-001
Working name:
Great Cathedral of Aurelia
Working properties:
-  length ~188 m
-  width ~92 m
-  central tower/spire ~171 m
-  western towers ~143 m
-  nave internal height ~48 m
-  main plaza ~250 × 180 m
-  capacity >15,000
-  cathedral precinct ~35 hectares
-  elevated approximately 45 m above the river
-  cathedral gardens
-  plaza
-  associated cultural/religious buildings
At city scale it is an icon/landmark.
At local scale its footprint and precinct appear.
At site scale the cathedral, plaza, gardens and associated structures should be individually visible.
Do not invent extensive historical lore for it yet.
Preserve:
-  AUR-LMK-002 Parliament Complex
-  AUR-LMK-003 Aurelia Central Station
-  AUR-LMK-004 University of Aurelia
-  AUR-LMK-005 National Stadium
-  AUR-LMK-006 Old Citadel
-  AUR-LMK-007 Aurelia Tower
-  AUR-LMK-008 Grand Market
-  AUR-LMK-009 National Gardens
-  AUR-LMK-010 Harbour Arch
-  AUR-LMK-011 National Museum
-  AUR-LMK-012 reserved
Do not fill AUR-LMK-012 simply because it is empty.
This is extremely important.
We will continue inventing major ideas for Pelotonia.
Example:
The Southeastern Islands may eventually be connected to mainland Pelotonia by an extraordinary ~35–45 km bridge/tunnel/viaduct system.
If implemented, it should:
-  appear at L1 as nationally significant infrastructure
-  resolve into bridge/tunnel sections at L2
-  reveal junctions/artificial islands/service infrastructure at L3
-  support individual structures at L4
The same must be possible for future:
-  dams
-  reservoirs
-  canals
-  giant tunnels
-  new cities
-  ports
-  airports
-  observatories
-  national parks
-  unusual geological formations
-  major buildings
Do not hard-code the atlas around the features we currently know about.
New features should primarily be additions to world data, not require bespoke map code.
Preserve the existing physical-world logic.
Pelotonia should plausibly contain extreme diversity:
-  storm-battered northwest
-  extraordinarily wet Emerald Coast
-  rainforest
-  temperate Central Plains
-  huge alpine/glaciated Great Range
-  Aurelia Icefield
-  volcanic basin
-  geothermal areas
-  Northern Plateau
-  Eastern Steppe
-  extremely hot/dry Redlands
-  southern maritime lowlands
-  southern fjords
-  southeastern archipelago
Western mountain areas may receive ~5,000–7,000 mm annual precipitation.
Highest mountains can experience winter temperatures below −20°C.
Redlands may exceed 43°C and occasionally reach 45–48°C during extreme heat.
This diversity is intentional.
Pelotonia should be geographically extraordinary while remaining physically believable enough to exist on Earth.
Total population:
~12.1 million
Existing working major cities:
-  Aurelia — ~2.45m metro
-  Valedor — ~1.18m
-  Westhaven — ~760k
-  Rivermere — ~620k
-  Kaen — ~510k
-  Greenfall — ~390k
-  Northwatch — ~310k
-  Southport — ~280k
-  Ember — ~220k
There will later be ~20 regional cities, many smaller towns and hundreds of settlements.
Do not invent all of them now.
Settlement should follow geography and suitability rather than being evenly distributed.
The visual identity should derive from the existing Pelotonia terrain-map direction:
-  attractive topographic terrain
-  ocean depth
-  forests
-  snow/ice
-  arid terrain
-  rivers/lakes
-  restrained labels
-  terrain/land-cover legend
The atlas should feel like a premium game world map, not Google Maps and not a GIS admin interface.
It must remain visually compatible with Pelotonia's broader planned light white/grey/green visual identity.
Prioritize readability, atmosphere and exploration.
At minimum support:
-  smooth zoom
-  pan
-  clicking/selecting a macro-grid area
-  selecting cities/features
-  progressive label/detail visibility
-  breadcrumb/back navigation through zoom hierarchy
-  selected-feature information panel
-  mobile/responsive behavior
Ideally, clicking a visible feature should provide the natural next zoom/detail level.
Do not make users manually choose “L1/L2/L3/L4” unless useful for development/debugging.
The atlas must render from the existing versioned Pelotonia world data.
Avoid embedding world facts directly in UI components.
Stable IDs should drive references.
Names must remain editable.
Geometry should support points, lines, polygons and multi-geometries.
Major features may span multiple grid cells.
Add validation/tests for:
-  broken parent references
-  invalid geometries
-  duplicate IDs
-  impossible zoom ranges
-  invalid grid references
-  orphaned landmarks/districts
-  region/cell inconsistencies
This is important.
Although Pelotonia is a cycling manager game, do not add cycling routes, race stages, climbs, cycling landmarks or cycling-specific map logic in this feature package.
We are deliberately creating Pelotonia as a real country first.
Cycling will later use this world rather than define it.
You may make technical/spatial decisions necessary to produce a coherent prototype, particularly for Aurelia.
But do not generate hundreds of arbitrary:
-  town names
-  street names
-  historical facts
-  politicians
-  institutions
-  cultural lore
Empty space is intentional. We will continue designing Pelotonia over time.
When information is unknown, prefer stable placeholders/IDs or clearly mark it unresolved rather than inventing lore.
First inspect the existing Pelotonia World 1.0 implementation and current project architecture.
Then decide the appropriate mapping/rendering architecture yourself.
You may add appropriate open-source mapping/rendering dependencies if justified, but avoid unnecessary platform complexity or paid map services for a fictional island whose geography we own.
Build this incrementally and test it.
I want the first meaningful deliverable to be:
an interactive Pelotonia map where I can view the whole island, zoom/select into macro areas, zoom into Aurelia, see its districts, enter Old Aurelia and reach the Great Cathedral as a detailed landmark.
Other parts of Pelotonia may initially stop at L1/L2.
Run tests, linting and production build checks yourself.
Keep implementation on the safe recovery/development branch.
Do not make destructive production database changes.
I should be able to:
1.  Open the Pelotonia atlas.
2.  See the entire country.
3.  Zoom/pan naturally.
4.  See nationally significant geography and cities.
5.  Select a macro area.
6.  See additional local detail.
7.  Enter Aurelia.
8.  See its major districts and landmarks.
9.  Enter Old Aurelia.
10.  Select the Great Cathedral.
11.  See a detailed cathedral/site representation.
12.  Navigate naturally back outward.
13.  Add a new world feature later primarily through data rather than rewriting map UI.
The atlas should be visually attractive enough to feel like part of a game, not merely prove that the data model works.
When complete, report:
-  architecture chosen
-  files/components added
-  dependencies added
-  world-data changes
-  tests/build results
-  what is fully functional
-  what remains placeholder
-  screenshots if your environment supports them
-  any world-design decisions you had to make yourself
Do not reinterpret or rename existing world concepts without explaining why.
Tell it not to wait for every other task to finish before touching this, but also not to let this derail recovery:
Treat the Pelotonia Island Atlas as a major new feature package. Authentication, security, data integrity and the core playable race cycle remain prerequisites for production release, but you may develop the atlas independently on the safe development/recovery branch where it does not interfere with those recovery tasks.